import { Router, Request, Response } from 'express';
import * as bcrypt from 'bcrypt';
import * as jwt from 'jsonwebtoken';
import { v4 as uuidv4 } from 'uuid';
import { db } from '../database/database';
import {
  generateToken,
  generateRefreshToken,
  verifyToken,
  authenticateToken,
  AuthenticatedRequest
} from '../middleware/auth';
import { auditLog } from '../utils/audit';
import { createError } from '../middleware/errorHandler';

const router = Router();

// Register new user (for initial setup)
router.post('/register', async (req: Request, res: Response) => {
  try {
    const { username, email, password, firstName, lastName } = req.body;

    if (!username || !email || !password) {
      return res.status(400).json({ error: 'Missing required fields: username, email, password' });
    }

    // Check if user already exists
    const existingUser = await db.get(
      'SELECT id FROM users WHERE username = ? OR email = ?',
      [username, email]
    );

    if (existingUser) {
      return res.status(400).json({ error: 'User with this username or email already exists' });
    }

    // Check if this is the first user (gets admin role)
    const userCount = await db.get('SELECT COUNT(*) as count FROM users');
    const roleId = userCount.count === 0 ? 'admin' : 'viewer'; // First user is admin, others are viewers

    // Hash password
    const saltRounds = 10;
    const passwordHash = await bcrypt.hash(password, saltRounds);

    // Create user
    const userId = uuidv4();
    await db.run(`
      INSERT INTO users (id, username, email, password_hash, role_id, first_name, last_name, is_active, email_verified)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
    `, [userId, username, email, passwordHash, roleId, firstName || '', lastName || '', true, false]);

    // Get user with role information for response
    const user = await db.get(`
      SELECT u.*, r.permissions, r.name as role_name
      FROM users u
      JOIN roles r ON u.role_id = r.id
      WHERE u.id = ?
    `, [userId]);

    // Create session
    const sessionId = uuidv4();
    const expiresAt = new Date();
    expiresAt.setHours(expiresAt.getHours() + 24); // 24 hours

    await db.run(`
      INSERT INTO user_sessions (id, user_id, session_token, ip_address, user_agent, expires_at)
      VALUES (?, ?, ?, ?, ?, ?)
    `, [sessionId, userId, sessionId, req.ip, req.get('User-Agent'), expiresAt.toISOString()]);

    // Generate tokens
    const tokenPayload = {
      userId: user.id,
      username: user.username,
      email: user.email,
      roleId: user.role_id,
      sessionId
    };

    const accessToken = generateToken(tokenPayload);
    const refreshToken = generateRefreshToken(tokenPayload);

    // Update refresh token in session
    await db.run(
      'UPDATE user_sessions SET refresh_token = ? WHERE id = ?',
      [refreshToken, sessionId]
    );

    await auditLog(userId, 'user:create', 'user', userId, {
      username,
      email,
      role: roleId,
      registration_method: 'self_registration'
    }, req.ip, req.get('User-Agent'));

    res.status(201).json({
      success: true,
      message: 'User registered successfully',
      user: {
        id: user.id,
        username: user.username,
        email: user.email,
        firstName: user.first_name,
        lastName: user.last_name,
        role: {
          id: user.role_id,
          name: user.role_name,
          permissions: JSON.parse(user.permissions || '[]')
        }
      },
      tokens: {
        accessToken,
        refreshToken,
        expiresAt: expiresAt.toISOString()
      }
    });
  } catch (error) {
    console.error('Registration error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Login endpoint
router.post('/login', async (req: Request, res: Response) => {
  try {
    const { username, password, rememberMe = false } = req.body;

    if (!username || !password) {
      return res.status(400).json({ error: 'Username and password are required' });
    }

    // Get user with role information
    const user = await db.get(`
      SELECT u.*, r.permissions, r.name as role_name
      FROM users u
      JOIN roles r ON u.role_id = r.id
      WHERE (u.username = ? OR u.email = ?) AND u.is_active = 1
    `, [username, username]);

    if (!user) {
      await auditLog(null, 'auth:login_failed', 'user', username, {
        reason: 'user_not_found',
        username
      }, req.ip, req.get('User-Agent'));

      return res.status(401).json({ error: 'Invalid credentials' });
    }

    // Check password
    const isValidPassword = await bcrypt.compare(password, user.password_hash);
    if (!isValidPassword) {
      await auditLog(user.id, 'auth:login_failed', 'user', user.id, {
        reason: 'invalid_password',
        username
      }, req.ip, req.get('User-Agent'));

      return res.status(401).json({ error: 'Invalid credentials' });
    }

    // Create session
    const sessionId = uuidv4();
    const expiresAt = new Date();
    expiresAt.setHours(expiresAt.getHours() + (rememberMe ? 24 * 7 : 24)); // 7 days if remember me, 24 hours otherwise

    await db.run(`
      INSERT INTO user_sessions (id, user_id, session_token, ip_address, user_agent, expires_at)
      VALUES (?, ?, ?, ?, ?, ?)
    `, [sessionId, user.id, sessionId, req.ip, req.get('User-Agent'), expiresAt.toISOString()]);

    // Generate tokens
    const tokenPayload = {
      userId: user.id,
      username: user.username,
      email: user.email,
      roleId: user.role_id,
      sessionId
    };

    const accessToken = generateToken(tokenPayload);
    const refreshToken = generateRefreshToken(tokenPayload);

    // Update refresh token in session
    await db.run(
      'UPDATE user_sessions SET refresh_token = ? WHERE id = ?',
      [refreshToken, sessionId]
    );

    // Update user login info
    await db.run(
      'UPDATE users SET last_login = datetime("now"), login_count = login_count + 1 WHERE id = ?',
      [user.id]
    );

    await auditLog(user.id, 'auth:login_success', 'user', user.id, {
      username: user.username,
      role: user.role_id,
      session_id: sessionId
    }, req.ip, req.get('User-Agent'));

    res.json({
      success: true,
      user: {
        id: user.id,
        username: user.username,
        email: user.email,
        firstName: user.first_name,
        lastName: user.last_name,
        role: {
          id: user.role_id,
          name: user.role_name,
          permissions: JSON.parse(user.permissions || '[]')
        },
        avatarUrl: user.avatar_url
      },
      tokens: {
        accessToken,
        refreshToken,
        expiresAt: expiresAt.toISOString()
      }
    });

  } catch (error) {
    console.error('Login error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Refresh token endpoint
router.post('/refresh', async (req: Request, res: Response) => {
  try {
    const { refreshToken } = req.body;

    if (!refreshToken) {
      return res.status(400).json({ error: 'Refresh token is required' });
    }

    const decoded = verifyToken(refreshToken);

    // Check if session exists and is active
    const session = await db.get(`
      SELECT * FROM user_sessions
      WHERE id = ? AND refresh_token = ? AND is_active = 1 AND expires_at > datetime("now")
    `, [decoded.sessionId, refreshToken]);

    if (!session) {
      return res.status(401).json({ error: 'Invalid or expired refresh token' });
    }

    // Get user with role information
    const user = await db.get(`
      SELECT u.*, r.permissions, r.name as role_name
      FROM users u
      JOIN roles r ON u.role_id = r.id
      WHERE u.id = ? AND u.is_active = 1
    `, [decoded.userId]);

    if (!user) {
      return res.status(401).json({ error: 'User not found or inactive' });
    }

    // Generate new tokens
    const tokenPayload = {
      userId: user.id,
      username: user.username,
      email: user.email,
      roleId: user.role_id,
      sessionId: decoded.sessionId
    };

    const newAccessToken = generateToken(tokenPayload);
    const newRefreshToken = generateRefreshToken(tokenPayload);

    // Update refresh token in session
    await db.run(
      'UPDATE user_sessions SET refresh_token = ?, last_activity = datetime("now") WHERE id = ?',
      [newRefreshToken, decoded.sessionId]
    );

    res.json({
      success: true,
      tokens: {
        accessToken: newAccessToken,
        refreshToken: newRefreshToken,
        expiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString() // 24 hours
      }
    });

  } catch (error) {
    console.error('Refresh token error:', error);
    res.status(401).json({ error: 'Invalid refresh token' });
  }
});

// Logout endpoint
router.post('/logout', authenticateToken, async (req: AuthenticatedRequest, res: Response) => {
  try {
    if (req.user?.session_id) {
      // Deactivate session
      await db.run(
        'UPDATE user_sessions SET is_active = 0 WHERE id = ?',
        [req.user.session_id]
      );

      await auditLog(req.user.id, 'auth:logout', 'user', req.user.id, {
        session_id: req.user.session_id
      }, req.ip, req.get('User-Agent'));
    }

    res.json({ success: true, message: 'Logged out successfully' });
  } catch (error) {
    console.error('Logout error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Verify token
router.post('/verify', async (req, res, next) => {
  try {
    const token = req.header('Authorization')?.replace('Bearer ', '');

    if (!token) {
      throw createError('No token provided', 401);
    }

    const decoded = jwt.verify(token, process.env.JWT_SECRET || 'default-secret') as any;
    
    // Get user from database
    const user = await db.get(
      'SELECT id, username, email, role FROM users WHERE id = ?',
      [decoded.userId]
    );
    
    if (!user) {
      throw createError('Invalid token', 401);
    }

    res.json({
      valid: true,
      user,
    });
  } catch (error) {
    res.status(401).json({
      valid: false,
      error: 'Invalid token',
    });
  }
});

// Change password
router.post('/change-password', async (req, res, next) => {
  try {
    const token = req.header('Authorization')?.replace('Bearer ', '');
    const { currentPassword, newPassword } = req.body;

    if (!token) {
      throw createError('No token provided', 401);
    }

    if (!currentPassword || !newPassword) {
      throw createError('Missing required fields: currentPassword, newPassword', 400);
    }

    const decoded = jwt.verify(token, process.env.JWT_SECRET || 'default-secret') as any;
    
    // Get user from database
    const user = await db.get('SELECT * FROM users WHERE id = ?', [decoded.userId]);
    
    if (!user) {
      throw createError('User not found', 404);
    }

    // Verify current password
    const isValidPassword = await bcrypt.compare(currentPassword, user.password_hash);
    if (!isValidPassword) {
      throw createError('Current password is incorrect', 400);
    }

    // Hash new password
    const saltRounds = 10;
    const newPasswordHash = await bcrypt.hash(newPassword, saltRounds);

    // Update password
    await db.run(
      'UPDATE users SET password_hash = ? WHERE id = ?',
      [newPasswordHash, user.id]
    );

    res.json({
      message: 'Password changed successfully',
    });
  } catch (error) {
    next(error);
  }
});

// Get user profile
router.get('/profile', async (req, res, next) => {
  try {
    const token = req.header('Authorization')?.replace('Bearer ', '');

    if (!token) {
      throw createError('No token provided', 401);
    }

    const decoded = jwt.verify(token, process.env.JWT_SECRET || 'default-secret') as any;
    
    // Get user from database
    const user = await db.get(
      'SELECT id, username, email, role, created_at, last_login FROM users WHERE id = ?',
      [decoded.userId]
    );
    
    if (!user) {
      throw createError('User not found', 404);
    }

    res.json(user);
  } catch (error) {
    next(error);
  }
});

// Check if any users exist (for initial setup)
router.get('/setup-required', async (req, res, next) => {
  try {
    const userCount = await db.get('SELECT COUNT(*) as count FROM users');
    
    res.json({
      setupRequired: userCount.count === 0,
    });
  } catch (error) {
    next(error);
  }
});

export default router;
