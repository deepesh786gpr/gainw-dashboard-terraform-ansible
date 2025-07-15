import { db } from '../database/database';

export interface AuditLogEntry {
  id?: number;
  user_id?: string;
  action: string;
  resource_type?: string;
  resource_id?: string;
  details?: any;
  ip_address?: string;
  user_agent?: string;
  success?: boolean;
  error_message?: string;
  created_at?: string;
}

/**
 * Log an audit event to the database
 */
export async function auditLog(
  userId: string | null,
  action: string,
  resourceType?: string,
  resourceId?: string,
  details?: any,
  ipAddress?: string,
  userAgent?: string,
  success: boolean = true,
  errorMessage?: string
): Promise<void> {
  try {
    await db.run(`
      INSERT INTO audit_log (
        user_id, action, resource_type, resource_id, details, 
        ip_address, user_agent, success, error_message
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
    `, [
      userId,
      action,
      resourceType,
      resourceId,
      details ? JSON.stringify(details) : null,
      ipAddress,
      userAgent,
      success ? 1 : 0,
      errorMessage
    ]);
  } catch (error) {
    console.error('Failed to write audit log:', error);
    // Don't throw error to avoid breaking the main operation
  }
}

/**
 * Get audit logs with filtering and pagination
 */
export async function getAuditLogs(options: {
  userId?: string;
  action?: string;
  resourceType?: string;
  resourceId?: string;
  startDate?: string;
  endDate?: string;
  success?: boolean;
  limit?: number;
  offset?: number;
}): Promise<AuditLogEntry[]> {
  let query = `
    SELECT 
      al.*,
      u.username,
      u.email
    FROM audit_log al
    LEFT JOIN users u ON al.user_id = u.id
    WHERE 1=1
  `;
  
  const params: any[] = [];

  if (options.userId) {
    query += ' AND al.user_id = ?';
    params.push(options.userId);
  }

  if (options.action) {
    query += ' AND al.action LIKE ?';
    params.push(`%${options.action}%`);
  }

  if (options.resourceType) {
    query += ' AND al.resource_type = ?';
    params.push(options.resourceType);
  }

  if (options.resourceId) {
    query += ' AND al.resource_id = ?';
    params.push(options.resourceId);
  }

  if (options.startDate) {
    query += ' AND al.created_at >= ?';
    params.push(options.startDate);
  }

  if (options.endDate) {
    query += ' AND al.created_at <= ?';
    params.push(options.endDate);
  }

  if (options.success !== undefined) {
    query += ' AND al.success = ?';
    params.push(options.success ? 1 : 0);
  }

  query += ' ORDER BY al.created_at DESC';

  if (options.limit) {
    query += ' LIMIT ?';
    params.push(options.limit);
  }

  if (options.offset) {
    query += ' OFFSET ?';
    params.push(options.offset);
  }

  const logs = await db.all(query, params);
  
  return logs.map(log => ({
    ...log,
    details: log.details ? JSON.parse(log.details) : null,
    success: log.success === 1
  }));
}

/**
 * Get audit log statistics
 */
export async function getAuditStats(options: {
  userId?: string;
  startDate?: string;
  endDate?: string;
}): Promise<{
  totalEvents: number;
  successfulEvents: number;
  failedEvents: number;
  topActions: Array<{ action: string; count: number }>;
  topUsers: Array<{ username: string; count: number }>;
}> {
  let whereClause = 'WHERE 1=1';
  const params: any[] = [];

  if (options.userId) {
    whereClause += ' AND al.user_id = ?';
    params.push(options.userId);
  }

  if (options.startDate) {
    whereClause += ' AND al.created_at >= ?';
    params.push(options.startDate);
  }

  if (options.endDate) {
    whereClause += ' AND al.created_at <= ?';
    params.push(options.endDate);
  }

  // Total events
  const totalResult = await db.get(`
    SELECT COUNT(*) as total FROM audit_log al ${whereClause}
  `, params);

  // Successful events
  const successResult = await db.get(`
    SELECT COUNT(*) as total FROM audit_log al ${whereClause} AND al.success = 1
  `, params);

  // Failed events
  const failedResult = await db.get(`
    SELECT COUNT(*) as total FROM audit_log al ${whereClause} AND al.success = 0
  `, params);

  // Top actions
  const topActions = await db.all(`
    SELECT al.action, COUNT(*) as count 
    FROM audit_log al ${whereClause}
    GROUP BY al.action 
    ORDER BY count DESC 
    LIMIT 10
  `, params);

  // Top users
  const topUsers = await db.all(`
    SELECT u.username, COUNT(*) as count 
    FROM audit_log al 
    LEFT JOIN users u ON al.user_id = u.id 
    ${whereClause} AND u.username IS NOT NULL
    GROUP BY u.username 
    ORDER BY count DESC 
    LIMIT 10
  `, params);

  return {
    totalEvents: totalResult.total,
    successfulEvents: successResult.total,
    failedEvents: failedResult.total,
    topActions,
    topUsers
  };
}

/**
 * Clean up old audit logs (for maintenance)
 */
export async function cleanupAuditLogs(olderThanDays: number = 90): Promise<number> {
  const cutoffDate = new Date();
  cutoffDate.setDate(cutoffDate.getDate() - olderThanDays);

  const result = await db.run(
    'DELETE FROM audit_log WHERE created_at < ?',
    [cutoffDate.toISOString()]
  );

  return result.changes || 0;
}

/**
 * Common audit actions for easy reference
 */
export const AUDIT_ACTIONS = {
  // Authentication
  AUTH_LOGIN_SUCCESS: 'auth:login_success',
  AUTH_LOGIN_FAILED: 'auth:login_failed',
  AUTH_LOGOUT: 'auth:logout',
  AUTH_LOGOUT_ALL: 'auth:logout_all',
  AUTH_TOKEN_REFRESH: 'auth:token_refresh',
  AUTH_PASSWORD_CHANGE: 'auth:password_change',

  // User management
  USER_CREATE: 'user:create',
  USER_UPDATE: 'user:update',
  USER_DELETE: 'user:delete',
  USER_ACTIVATE: 'user:activate',
  USER_DEACTIVATE: 'user:deactivate',

  // Template management
  TEMPLATE_CREATE: 'template:create',
  TEMPLATE_UPDATE: 'template:update',
  TEMPLATE_DELETE: 'template:delete',
  TEMPLATE_VIEW: 'template:view',

  // Deployment management
  DEPLOYMENT_CREATE: 'deployment:create',
  DEPLOYMENT_UPDATE: 'deployment:update',
  DEPLOYMENT_DELETE: 'deployment:delete',
  DEPLOYMENT_EXECUTE: 'deployment:execute',
  DEPLOYMENT_APPROVE: 'deployment:approve',
  DEPLOYMENT_REJECT: 'deployment:reject',

  // Instance management
  INSTANCE_START: 'instance:start',
  INSTANCE_STOP: 'instance:stop',
  INSTANCE_RESTART: 'instance:restart',
  INSTANCE_TERMINATE: 'instance:terminate',
  INSTANCE_SCHEDULE: 'instance:schedule',

  // Settings
  SETTINGS_UPDATE: 'settings:update',
  SETTINGS_VIEW: 'settings:view',

  // GitHub integration
  GITHUB_TOKEN_ADD: 'github:token_add',
  GITHUB_TOKEN_UPDATE: 'github:token_update',
  GITHUB_TOKEN_DELETE: 'github:token_delete',
  GITHUB_REPO_IMPORT: 'github:repo_import',

  // System
  SYSTEM_BACKUP: 'system:backup',
  SYSTEM_RESTORE: 'system:restore',
  SYSTEM_MAINTENANCE: 'system:maintenance'
} as const;
