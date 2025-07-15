import { Router, Request, Response } from 'express';
import { v4 as uuidv4 } from 'uuid';
import { db } from '../database/database';
import { 
  authenticateToken,
  requirePermission,
  AuthenticatedRequest 
} from '../middleware/auth';
import { auditLog, AUDIT_ACTIONS } from '../utils/audit';

const router = Router();

// Available permissions in the system
const AVAILABLE_PERMISSIONS = [
  // User management
  'users:read', 'users:write', 'users:delete',
  
  // Role management
  'roles:read', 'roles:write', 'roles:delete',
  
  // Template management
  'templates:read', 'templates:write', 'templates:delete',
  
  // Deployment management
  'deployments:read', 'deployments:write', 'deployments:delete', 'deployments:execute',
  
  // Instance management
  'instances:read', 'instances:write', 'instances:start', 'instances:stop', 'instances:terminate',
  
  // Settings management
  'settings:read', 'settings:write',
  
  // Audit logs
  'audit:read',
  
  // GitHub integration
  'github:read', 'github:write',
  
  // AWS integration
  'aws:read', 'aws:write'
];

// Get all roles
router.get('/', authenticateToken, requirePermission('roles:read'), async (req: AuthenticatedRequest, res: Response) => {
  try {
    const roles = await db.all(`
      SELECT 
        r.*,
        COUNT(u.id) as user_count
      FROM roles r
      LEFT JOIN users u ON r.id = u.role_id AND u.is_active = 1
      GROUP BY r.id
      ORDER BY r.created_at ASC
    `);

    const rolesWithPermissions = roles.map(role => ({
      ...role,
      permissions: JSON.parse(role.permissions || '[]'),
      is_system_role: role.is_system_role === 1
    }));

    res.json({
      success: true,
      roles: rolesWithPermissions
    });

  } catch (error) {
    console.error('Get roles error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Get available permissions
router.get('/permissions', authenticateToken, requirePermission('roles:read'), async (req: AuthenticatedRequest, res: Response) => {
  try {
    // Group permissions by category
    const permissionGroups = {
      'User Management': AVAILABLE_PERMISSIONS.filter(p => p.startsWith('users:')),
      'Role Management': AVAILABLE_PERMISSIONS.filter(p => p.startsWith('roles:')),
      'Template Management': AVAILABLE_PERMISSIONS.filter(p => p.startsWith('templates:')),
      'Deployment Management': AVAILABLE_PERMISSIONS.filter(p => p.startsWith('deployments:')),
      'Instance Management': AVAILABLE_PERMISSIONS.filter(p => p.startsWith('instances:')),
      'Settings Management': AVAILABLE_PERMISSIONS.filter(p => p.startsWith('settings:')),
      'Audit Logs': AVAILABLE_PERMISSIONS.filter(p => p.startsWith('audit:')),
      'GitHub Integration': AVAILABLE_PERMISSIONS.filter(p => p.startsWith('github:')),
      'AWS Integration': AVAILABLE_PERMISSIONS.filter(p => p.startsWith('aws:'))
    };

    res.json({
      success: true,
      permissions: AVAILABLE_PERMISSIONS,
      permissionGroups
    });

  } catch (error) {
    console.error('Get permissions error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Get role by ID
router.get('/:roleId', authenticateToken, requirePermission('roles:read'), async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { roleId } = req.params;

    const role = await db.get(`
      SELECT 
        r.*,
        COUNT(u.id) as user_count
      FROM roles r
      LEFT JOIN users u ON r.id = u.role_id AND u.is_active = 1
      WHERE r.id = ?
      GROUP BY r.id
    `, [roleId]);

    if (!role) {
      return res.status(404).json({ error: 'Role not found' });
    }

    // Get users with this role
    const users = await db.all(`
      SELECT id, username, email, first_name, last_name, is_active, created_at
      FROM users 
      WHERE role_id = ? AND is_active = 1
      ORDER BY username ASC
    `, [roleId]);

    res.json({
      success: true,
      role: {
        ...role,
        permissions: JSON.parse(role.permissions || '[]'),
        is_system_role: role.is_system_role === 1,
        users
      }
    });

  } catch (error) {
    console.error('Get role error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Create new role
router.post('/', authenticateToken, requirePermission('roles:write'), async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { name, description, permissions } = req.body;

    if (!name || !permissions || !Array.isArray(permissions)) {
      return res.status(400).json({ error: 'Missing required fields: name, permissions (array)' });
    }

    // Validate permissions
    const invalidPermissions = permissions.filter(p => !AVAILABLE_PERMISSIONS.includes(p));
    if (invalidPermissions.length > 0) {
      return res.status(400).json({ 
        error: 'Invalid permissions', 
        invalid: invalidPermissions,
        available: AVAILABLE_PERMISSIONS
      });
    }

    // Check if role name already exists
    const existingRole = await db.get('SELECT id FROM roles WHERE name = ?', [name]);
    if (existingRole) {
      return res.status(400).json({ error: 'Role with this name already exists' });
    }

    // Create role
    const roleId = uuidv4();
    await db.run(`
      INSERT INTO roles (id, name, description, permissions, is_system_role)
      VALUES (?, ?, ?, ?, ?)
    `, [roleId, name, description || '', JSON.stringify(permissions), false]);

    await auditLog(req.user!.id, AUDIT_ACTIONS.USER_CREATE, 'role', roleId, {
      role_name: name,
      permissions,
      created_by: req.user!.username
    }, req.ip, req.get('User-Agent'));

    res.status(201).json({
      success: true,
      message: 'Role created successfully',
      role: {
        id: roleId,
        name,
        description,
        permissions,
        is_system_role: false
      }
    });

  } catch (error) {
    console.error('Create role error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Update role
router.put('/:roleId', authenticateToken, requirePermission('roles:write'), async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { roleId } = req.params;
    const { name, description, permissions } = req.body;

    // Get existing role
    const existingRole = await db.get('SELECT * FROM roles WHERE id = ?', [roleId]);
    if (!existingRole) {
      return res.status(404).json({ error: 'Role not found' });
    }

    // Prevent modification of system roles
    if (existingRole.is_system_role) {
      return res.status(400).json({ error: 'Cannot modify system roles' });
    }

    let updates: any = {
      updated_at: new Date().toISOString()
    };

    if (name && name !== existingRole.name) {
      // Check if new name already exists
      const nameConflict = await db.get(
        'SELECT id FROM roles WHERE name = ? AND id != ?',
        [name, roleId]
      );
      if (nameConflict) {
        return res.status(400).json({ error: 'Role name already exists' });
      }
      updates.name = name;
    }

    if (description !== undefined) {
      updates.description = description;
    }

    if (permissions && Array.isArray(permissions)) {
      // Validate permissions
      const invalidPermissions = permissions.filter(p => !AVAILABLE_PERMISSIONS.includes(p));
      if (invalidPermissions.length > 0) {
        return res.status(400).json({ 
          error: 'Invalid permissions', 
          invalid: invalidPermissions,
          available: AVAILABLE_PERMISSIONS
        });
      }
      updates.permissions = JSON.stringify(permissions);
    }

    // Build update query
    const updateFields = Object.keys(updates).map(key => `${key} = ?`).join(', ');
    const updateValues = Object.values(updates);

    await db.run(
      `UPDATE roles SET ${updateFields} WHERE id = ?`,
      [...updateValues, roleId]
    );

    await auditLog(req.user!.id, AUDIT_ACTIONS.USER_UPDATE, 'role', roleId, {
      role_name: name || existingRole.name,
      changes: Object.keys(updates),
      updated_by: req.user!.username
    }, req.ip, req.get('User-Agent'));

    res.json({
      success: true,
      message: 'Role updated successfully'
    });

  } catch (error) {
    console.error('Update role error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Delete role
router.delete('/:roleId', authenticateToken, requirePermission('roles:delete'), async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { roleId } = req.params;

    // Get existing role
    const existingRole = await db.get('SELECT * FROM roles WHERE id = ?', [roleId]);
    if (!existingRole) {
      return res.status(404).json({ error: 'Role not found' });
    }

    // Prevent deletion of system roles
    if (existingRole.is_system_role) {
      return res.status(400).json({ error: 'Cannot delete system roles' });
    }

    // Check if role is in use
    const usersWithRole = await db.get(
      'SELECT COUNT(*) as count FROM users WHERE role_id = ? AND is_active = 1',
      [roleId]
    );

    if (usersWithRole.count > 0) {
      return res.status(400).json({ 
        error: 'Cannot delete role that is assigned to users',
        users_count: usersWithRole.count
      });
    }

    // Delete role
    await db.run('DELETE FROM roles WHERE id = ?', [roleId]);

    await auditLog(req.user!.id, AUDIT_ACTIONS.USER_DELETE, 'role', roleId, {
      role_name: existingRole.name,
      deleted_by: req.user!.username
    }, req.ip, req.get('User-Agent'));

    res.json({
      success: true,
      message: 'Role deleted successfully'
    });

  } catch (error) {
    console.error('Delete role error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Get role usage statistics
router.get('/:roleId/stats', authenticateToken, requirePermission('roles:read'), async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { roleId } = req.params;

    // Get role
    const role = await db.get('SELECT * FROM roles WHERE id = ?', [roleId]);
    if (!role) {
      return res.status(404).json({ error: 'Role not found' });
    }

    // Get user statistics
    const userStats = await db.get(`
      SELECT 
        COUNT(*) as total_users,
        COUNT(CASE WHEN is_active = 1 THEN 1 END) as active_users,
        COUNT(CASE WHEN last_login IS NOT NULL THEN 1 END) as users_with_login
      FROM users 
      WHERE role_id = ?
    `, [roleId]);

    // Get recent activity
    const recentActivity = await db.all(`
      SELECT 
        al.action,
        al.created_at,
        u.username
      FROM audit_log al
      JOIN users u ON al.user_id = u.id
      WHERE u.role_id = ?
      ORDER BY al.created_at DESC
      LIMIT 10
    `, [roleId]);

    res.json({
      success: true,
      role: {
        ...role,
        permissions: JSON.parse(role.permissions || '[]'),
        is_system_role: role.is_system_role === 1
      },
      stats: userStats,
      recentActivity
    });

  } catch (error) {
    console.error('Get role stats error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

export default router;
export { AVAILABLE_PERMISSIONS };
