import { Request, Response, NextFunction } from 'express';
import * as jwt from 'jsonwebtoken';
import { db } from '../database/database';

const JWT_SECRET = process.env.JWT_SECRET || 'your-super-secret-jwt-key-change-in-production';
const JWT_EXPIRES_IN = process.env.JWT_EXPIRES_IN || '24h';
const REFRESH_TOKEN_EXPIRES_IN = process.env.REFRESH_TOKEN_EXPIRES_IN || '7d';

export interface AuthenticatedRequest extends Request {
  user?: {
    id: string;
    username: string;
    email: string;
    role_id: string;
    permissions: string[];
    session_id: string;
  };
}

export interface JWTPayload {
  userId: string;
  username: string;
  email: string;
  roleId: string;
  sessionId: string;
  iat?: number;
  exp?: number;
}

// Generate JWT token
export function generateToken(payload: Omit<JWTPayload, 'iat' | 'exp'>): string {
  return jwt.sign(payload, JWT_SECRET, { expiresIn: JWT_EXPIRES_IN as jwt.SignOptions['expiresIn'] });
}

// Generate refresh token
export function generateRefreshToken(payload: Omit<JWTPayload, 'iat' | 'exp'>): string {
  return jwt.sign(payload, JWT_SECRET, { expiresIn: REFRESH_TOKEN_EXPIRES_IN as jwt.SignOptions['expiresIn'] });
}

// Verify JWT token
export function verifyToken(token: string): JWTPayload {
  return jwt.verify(token, JWT_SECRET) as JWTPayload;
}

// Authentication middleware
export async function authenticateToken(req: AuthenticatedRequest, res: Response, next: NextFunction) {
  try {
    const authHeader = req.headers.authorization;
    const token = authHeader && authHeader.split(' ')[1]; // Bearer TOKEN

    if (!token) {
      return res.status(401).json({ error: 'Access token required' });
    }

    const decoded = verifyToken(token);

    // Check if session is still active
    const session = await db.get(
      'SELECT * FROM user_sessions WHERE id = ? AND is_active = 1 AND expires_at > datetime("now")',
      [decoded.sessionId]
    );

    if (!session) {
      return res.status(401).json({ error: 'Session expired or invalid' });
    }

    // Get user with role permissions
    const user = await db.get(`
      SELECT u.*, r.permissions
      FROM users u
      JOIN roles r ON u.role_id = r.id
      WHERE u.id = ? AND u.is_active = 1
    `, [decoded.userId]);

    if (!user) {
      return res.status(401).json({ error: 'User not found or inactive' });
    }

    // Update last activity
    await db.run(
      'UPDATE user_sessions SET last_activity = datetime("now") WHERE id = ?',
      [decoded.sessionId]
    );

    // Attach user info to request
    req.user = {
      id: user.id,
      username: user.username,
      email: user.email,
      role_id: user.role_id,
      permissions: JSON.parse(user.permissions || '[]'),
      session_id: decoded.sessionId
    };

    next();
  } catch (error) {
    console.error('Authentication error:', error);
    return res.status(401).json({ error: 'Invalid token' });
  }
}

// Optional authentication middleware (doesn't fail if no token)
export async function optionalAuth(req: AuthenticatedRequest, res: Response, next: NextFunction) {
  try {
    const authHeader = req.headers.authorization;
    const token = authHeader && authHeader.split(' ')[1];

    if (token) {
      const decoded = verifyToken(token);

      const session = await db.get(
        'SELECT * FROM user_sessions WHERE id = ? AND is_active = 1 AND expires_at > datetime("now")',
        [decoded.sessionId]
      );

      if (session) {
        const user = await db.get(`
          SELECT u.*, r.permissions
          FROM users u
          JOIN roles r ON u.role_id = r.id
          WHERE u.id = ? AND u.is_active = 1
        `, [decoded.userId]);

        if (user) {
          req.user = {
            id: user.id,
            username: user.username,
            email: user.email,
            role_id: user.role_id,
            permissions: JSON.parse(user.permissions || '[]'),
            session_id: decoded.sessionId
          };
        }
      }
    }
  } catch (error) {
    // Silently continue without authentication
  }

  next();
}

// Permission checking middleware
export function requirePermission(permission: string) {
  return (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
    if (!req.user) {
      return res.status(401).json({ error: 'Authentication required' });
    }

    if (!req.user.permissions.includes(permission)) {
      return res.status(403).json({
        error: 'Insufficient permissions',
        required: permission,
        userPermissions: req.user.permissions
      });
    }

    next();
  };
}

// Role checking middleware
export function requireRole(role: string) {
  return (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
    if (!req.user) {
      return res.status(401).json({ error: 'Authentication required' });
    }

    if (req.user.role_id !== role) {
      return res.status(403).json({
        error: 'Insufficient role',
        required: role,
        userRole: req.user.role_id
      });
    }

    next();
  };
}

// Multiple permissions check (user needs ALL permissions)
export function requireAllPermissions(permissions: string[]) {
  return (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
    if (!req.user) {
      return res.status(401).json({ error: 'Authentication required' });
    }

    const missingPermissions = permissions.filter(p => !req.user!.permissions.includes(p));

    if (missingPermissions.length > 0) {
      return res.status(403).json({
        error: 'Insufficient permissions',
        missing: missingPermissions,
        userPermissions: req.user.permissions
      });
    }

    next();
  };
}

// Any permission check (user needs ANY of the permissions)
export function requireAnyPermission(permissions: string[]) {
  return (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
    if (!req.user) {
      return res.status(401).json({ error: 'Authentication required' });
    }

    const hasPermission = permissions.some(p => req.user!.permissions.includes(p));

    if (!hasPermission) {
      return res.status(403).json({
        error: 'Insufficient permissions',
        required: permissions,
        userPermissions: req.user.permissions
      });
    }

    next();
  };
}

// Legacy middleware for backward compatibility
export const authMiddleware = authenticateToken;
