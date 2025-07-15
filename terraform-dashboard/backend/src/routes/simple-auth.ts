import express from 'express';
import * as bcrypt from 'bcrypt';
import * as jwt from 'jsonwebtoken';
import { v4 as uuidv4 } from 'uuid';
import { db } from '../database/database';

const router = express.Router();

// Login endpoint
router.post('/login', async (req, res) => {
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
      return res.status(401).json({ error: 'Invalid credentials' });
    }

    // Check password
    const isValidPassword = await bcrypt.compare(password, user.password_hash);
    if (!isValidPassword) {
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

    const accessToken = jwt.sign(tokenPayload, process.env.JWT_SECRET || 'default-secret', { expiresIn: '24h' });
    const refreshToken = jwt.sign(tokenPayload, process.env.JWT_SECRET || 'default-secret', { expiresIn: '7d' });

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

// Get current user info
router.get('/me', async (req, res) => {
  try {
    const authHeader = req.headers.authorization;
    const token = authHeader && authHeader.split(' ')[1];

    if (!token) {
      return res.status(401).json({ error: 'Access token required' });
    }

    const decoded = jwt.verify(token, process.env.JWT_SECRET || 'default-secret') as any;
    
    // Check if session is still active
    const session = await db.get(
      'SELECT * FROM user_sessions WHERE id = ? AND is_active = 1 AND expires_at > datetime("now")',
      [decoded.sessionId]
    );

    if (!session) {
      return res.status(401).json({ error: 'Session expired or invalid' });
    }

    // Get user with role information
    const user = await db.get(`
      SELECT u.*, r.permissions, r.name as role_name, r.description as role_description
      FROM users u 
      JOIN roles r ON u.role_id = r.id 
      WHERE u.id = ?
    `, [decoded.userId]);

    if (!user) {
      return res.status(404).json({ error: 'User not found' });
    }

    res.json({
      success: true,
      user: {
        id: user.id,
        username: user.username,
        email: user.email,
        firstName: user.first_name,
        lastName: user.last_name,
        avatarUrl: user.avatar_url,
        emailVerified: user.email_verified,
        lastLogin: user.last_login,
        loginCount: user.login_count,
        createdAt: user.created_at,
        role: {
          id: user.role_id,
          name: user.role_name,
          description: user.role_description,
          permissions: JSON.parse(user.permissions || '[]')
        }
      }
    });

  } catch (error) {
    console.error('Get user info error:', error);
    res.status(401).json({ error: 'Invalid token' });
  }
});

// Logout endpoint
router.post('/logout', async (req, res) => {
  try {
    const authHeader = req.headers.authorization;
    const token = authHeader && authHeader.split(' ')[1];

    if (token) {
      try {
        const decoded = jwt.verify(token, process.env.JWT_SECRET || 'default-secret') as any;
        
        // Deactivate session
        await db.run(
          'UPDATE user_sessions SET is_active = 0 WHERE id = ?',
          [decoded.sessionId]
        );
      } catch (error) {
        // Token might be invalid, but we still want to return success
      }
    }

    res.json({ success: true, message: 'Logged out successfully' });
  } catch (error) {
    console.error('Logout error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Register new user (for initial setup)
router.post('/register', async (req, res) => {
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

    res.status(201).json({
      success: true,
      message: 'User registered successfully',
      user: {
        id: userId,
        username,
        email,
        firstName,
        lastName,
        roleId
      }
    });
  } catch (error) {
    console.error('Registration error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Check if any users exist (for initial setup)
router.get('/setup-required', async (req, res) => {
  try {
    const userCount = await db.get('SELECT COUNT(*) as count FROM users');
    
    res.json({
      setupRequired: userCount.count === 0,
    });
  } catch (error) {
    console.error('Setup check error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

export default router;
