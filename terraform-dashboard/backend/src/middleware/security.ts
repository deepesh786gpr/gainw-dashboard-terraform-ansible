import { Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';
import bcrypt from 'bcrypt';
import helmet from 'helmet';
import rateLimit from 'express-rate-limit';
import { createError } from './errorHandler';
import { logger, auditLogger } from '../utils/logger';

// Enhanced authentication interface
export interface AuthenticatedRequest extends Request {
  user?: {
    id: string;
    username: string;
    email: string;
    role: string;
    permissions: string[];
  };
  requestId?: string;
}

// JWT token management
export class TokenManager {
  private static readonly ACCESS_TOKEN_EXPIRY = '15m';
  private static readonly REFRESH_TOKEN_EXPIRY = '7d';
  private static readonly JWT_SECRET = process.env.JWT_SECRET || 'default-secret';
  private static readonly REFRESH_SECRET = process.env.REFRESH_SECRET || 'default-refresh-secret';

  static generateTokens(user: any) {
    const payload = {
      userId: user.id,
      username: user.username,
      role: user.role,
      permissions: user.permissions || [],
    };

    const accessToken = jwt.sign(payload, this.JWT_SECRET, {
      expiresIn: this.ACCESS_TOKEN_EXPIRY,
      issuer: 'terraform-dashboard',
      audience: 'terraform-dashboard-users',
    });

    const refreshToken = jwt.sign(
      { userId: user.id },
      this.REFRESH_SECRET,
      { expiresIn: this.REFRESH_TOKEN_EXPIRY }
    );

    return { accessToken, refreshToken };
  }

  static verifyAccessToken(token: string) {
    return jwt.verify(token, this.JWT_SECRET) as any;
  }

  static verifyRefreshToken(token: string) {
    return jwt.verify(token, this.REFRESH_SECRET) as any;
  }
}

// Password utilities
export class PasswordManager {
  private static readonly SALT_ROUNDS = 12;

  static async hash(password: string): Promise<string> {
    return bcrypt.hash(password, this.SALT_ROUNDS);
  }

  static async verify(password: string, hash: string): Promise<boolean> {
    return bcrypt.compare(password, hash);
  }

  static validateStrength(password: string): { valid: boolean; errors: string[] } {
    const errors: string[] = [];

    if (password.length < 8) {
      errors.push('Password must be at least 8 characters long');
    }
    if (!/[A-Z]/.test(password)) {
      errors.push('Password must contain at least one uppercase letter');
    }
    if (!/[a-z]/.test(password)) {
      errors.push('Password must contain at least one lowercase letter');
    }
    if (!/\d/.test(password)) {
      errors.push('Password must contain at least one number');
    }
    if (!/[!@#$%^&*(),.?":{}|<>]/.test(password)) {
      errors.push('Password must contain at least one special character');
    }

    return { valid: errors.length === 0, errors };
  }
}

// Authentication middleware
export const authenticate = async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
  try {
    const authHeader = req.headers.authorization;
    
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      throw createError('No token provided', 401, 'NO_TOKEN');
    }

    const token = authHeader.substring(7);
    const decoded = TokenManager.verifyAccessToken(token);

    // Add user info to request
    req.user = {
      id: decoded.userId,
      username: decoded.username,
      role: decoded.role,
      permissions: decoded.permissions || [],
    };

    // Log authentication
    auditLogger.log('TOKEN_VERIFIED', decoded.userId, {
      ip: req.ip,
      userAgent: req.get('User-Agent'),
    });

    next();
  } catch (error: any) {
    if (error.name === 'TokenExpiredError') {
      throw createError('Token expired', 401, 'TOKEN_EXPIRED');
    }
    if (error.name === 'JsonWebTokenError') {
      throw createError('Invalid token', 401, 'INVALID_TOKEN');
    }
    throw createError('Authentication failed', 401, 'AUTH_FAILED');
  }
};

// Authorization middleware
export const authorize = (requiredPermissions: string[] = [], requiredRole?: string) => {
  return (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
    if (!req.user) {
      throw createError('User not authenticated', 401, 'NOT_AUTHENTICATED');
    }

    // Check role if specified
    if (requiredRole && req.user.role !== requiredRole && req.user.role !== 'admin') {
      auditLogger.log('AUTHORIZATION_FAILED', req.user.id, {
        requiredRole,
        userRole: req.user.role,
        resource: req.path,
      });
      throw createError('Insufficient role permissions', 403, 'INSUFFICIENT_ROLE');
    }

    // Check permissions
    if (requiredPermissions.length > 0) {
      const hasPermission = requiredPermissions.every(permission =>
        req.user!.permissions.includes(permission) || req.user!.role === 'admin'
      );

      if (!hasPermission) {
        auditLogger.log('AUTHORIZATION_FAILED', req.user.id, {
          requiredPermissions,
          userPermissions: req.user.permissions,
          resource: req.path,
        });
        throw createError('Insufficient permissions', 403, 'INSUFFICIENT_PERMISSIONS');
      }
    }

    next();
  };
};

// Rate limiting configurations
export const rateLimiters = {
  general: rateLimit({
    windowMs: 15 * 60 * 1000, // 15 minutes
    max: 100, // limit each IP to 100 requests per windowMs
    message: 'Too many requests from this IP',
    standardHeaders: true,
    legacyHeaders: false,
  }),

  auth: rateLimit({
    windowMs: 15 * 60 * 1000, // 15 minutes
    max: 5, // limit each IP to 5 auth requests per windowMs
    message: 'Too many authentication attempts',
    skipSuccessfulRequests: true,
  }),

  deployment: rateLimit({
    windowMs: 60 * 1000, // 1 minute
    max: 10, // limit each IP to 10 deployment requests per minute
    message: 'Too many deployment requests',
  }),
};

// Security headers middleware
export const securityHeaders = helmet({
  contentSecurityPolicy: {
    directives: {
      defaultSrc: ["'self'"],
      styleSrc: ["'self'", "'unsafe-inline'", "https://fonts.googleapis.com"],
      fontSrc: ["'self'", "https://fonts.gstatic.com"],
      imgSrc: ["'self'", "data:", "https:"],
      scriptSrc: ["'self'"],
      connectSrc: ["'self'", "ws:", "wss:"],
    },
  },
  hsts: {
    maxAge: 31536000,
    includeSubDomains: true,
    preload: true,
  },
});

// Request ID middleware
export const requestId = (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
  req.requestId = req.headers['x-request-id'] as string || 
    `req_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  
  res.setHeader('X-Request-ID', req.requestId);
  next();
};

// IP whitelist middleware
export const ipWhitelist = (allowedIPs: string[]) => {
  return (req: Request, res: Response, next: NextFunction) => {
    const clientIP = req.ip || req.connection.remoteAddress;
    
    if (allowedIPs.length > 0 && !allowedIPs.includes(clientIP || '')) {
      logger.warn('IP access denied', { ip: clientIP, url: req.url });
      throw createError('Access denied from this IP', 403, 'IP_BLOCKED');
    }
    
    next();
  };
};

// Session management
export class SessionManager {
  private static activeSessions = new Map<string, { userId: string; lastActivity: Date }>();

  static addSession(sessionId: string, userId: string) {
    this.activeSessions.set(sessionId, {
      userId,
      lastActivity: new Date(),
    });
  }

  static removeSession(sessionId: string) {
    this.activeSessions.delete(sessionId);
  }

  static isSessionActive(sessionId: string): boolean {
    const session = this.activeSessions.get(sessionId);
    if (!session) return false;

    // Check if session is expired (24 hours)
    const now = new Date();
    const sessionAge = now.getTime() - session.lastActivity.getTime();
    const maxAge = 24 * 60 * 60 * 1000; // 24 hours

    if (sessionAge > maxAge) {
      this.removeSession(sessionId);
      return false;
    }

    // Update last activity
    session.lastActivity = now;
    return true;
  }

  static getUserSessions(userId: string): string[] {
    const sessions: string[] = [];
    for (const [sessionId, session] of this.activeSessions.entries()) {
      if (session.userId === userId) {
        sessions.push(sessionId);
      }
    }
    return sessions;
  }
}

// Input sanitization middleware
export const sanitizeInput = (req: Request, res: Response, next: NextFunction) => {
  const sanitize = (obj: any): any => {
    if (typeof obj === 'string') {
      return obj.trim().replace(/[<>]/g, '');
    }
    if (Array.isArray(obj)) {
      return obj.map(sanitize);
    }
    if (typeof obj === 'object' && obj !== null) {
      const sanitized: any = {};
      for (const [key, value] of Object.entries(obj)) {
        sanitized[key] = sanitize(value);
      }
      return sanitized;
    }
    return obj;
  };

  req.body = sanitize(req.body);
  req.query = sanitize(req.query);
  next();
};
