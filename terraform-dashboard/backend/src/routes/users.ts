import { Router, Request, Response } from 'express';
import bcrypt from 'bcrypt';
import { v4 as uuidv4 } from 'uuid';
import { db } from '../database/database';
import { 
  authenticateToken,
  requirePermission,
  requireRole,
  AuthenticatedRequest 
} from '../middleware/auth';
import { auditLog, AUDIT_ACTIONS } from '../utils/audit';

const router = Router();

// Get all users (admin only)
router.get('/', authenticateToken, requirePermission('users:read'), async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { page = 1, limit = 20, search, role, active } = req.query;
    const offset = (Number(page) - 1) * Number(limit);

    let query = `
      SELECT 
        u.id, u.username, u.email, u.first_name, u.last_name, 
        u.role_id, u.avatar_url, u.is_active, u.email_verified,
        u.last_login, u.login_count, u.created_at, u.updated_at,
        r.name as role_name, r.description as role_description
      FROM users u
      JOIN roles r ON u.role_id = r.id
      WHERE 1=1
    `;
    
    const params: any[] = [];

    if (search) {
      query += ' AND (u.username LIKE ? OR u.email LIKE ? OR u.first_name LIKE ? OR u.last_name LIKE ?)';
      const searchTerm = `%${search}%`;
      params.push(searchTerm, searchTerm, searchTerm, searchTerm);
    }

    if (role) {
      query += ' AND u.role_id = ?';
      params.push(role);
    }

    if (active !== undefined) {
      query += ' AND u.is_active = ?';
      params.push(active === 'true' ? 1 : 0);
    }

    // Get total count
    const countQuery = query.replace(/SELECT.*FROM/, 'SELECT COUNT(*) as total FROM');
    const totalResult = await db.get(countQuery, params);
    const total = totalResult.total;

    // Get paginated results
    query += ' ORDER BY u.created_at DESC LIMIT ? OFFSET ?';
    params.push(Number(limit), offset);

    const users = await db.all(query, params);

    res.json({
      success: true,
      users,
      pagination: {
        page: Number(page),
        limit: Number(limit),
        total,
        pages: Math.ceil(total / Number(limit))
      }
    });

  } catch (error) {
    console.error('Get users error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Get user by ID
router.get('/:userId', authenticateToken, requirePermission('users:read'), async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { userId } = req.params;

    const user = await db.get(`
      SELECT 
        u.id, u.username, u.email, u.first_name, u.last_name, 
        u.role_id, u.avatar_url, u.is_active, u.email_verified,
        u.last_login, u.login_count, u.created_at, u.updated_at,
        r.name as role_name, r.description as role_description, r.permissions
      FROM users u
      JOIN roles r ON u.role_id = r.id
      WHERE u.id = ?
    `, [userId]);

    if (!user) {
      return res.status(404).json({ error: 'User not found' });
    }

    // Get user's active sessions
    const sessions = await db.all(`
      SELECT id, ip_address, user_agent, created_at, last_activity, expires_at
      FROM user_sessions 
      WHERE user_id = ? AND is_active = 1 AND expires_at > datetime("now")
      ORDER BY last_activity DESC
    `, [userId]);

    // Get user's GitHub tokens count
    const tokensResult = await db.get(
      'SELECT COUNT(*) as count FROM user_tokens WHERE user_id = ? AND token_type = ? AND is_active = 1',
      [userId, 'github']
    );

    res.json({
      success: true,
      user: {
        ...user,
        permissions: JSON.parse(user.permissions || '[]'),
        sessions,
        github_tokens_count: tokensResult.count
      }
    });

  } catch (error) {
    console.error('Get user error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Create new user (admin only)
router.post('/', authenticateToken, requirePermission('users:write'), async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { username, email, password, firstName, lastName, roleId, isActive = true } = req.body;

    if (!username || !email || !password || !roleId) {
      return res.status(400).json({ error: 'Missing required fields: username, email, password, roleId' });
    }

    // Check if user already exists
    const existingUser = await db.get(
      'SELECT id FROM users WHERE username = ? OR email = ?',
      [username, email]
    );

    if (existingUser) {
      return res.status(400).json({ error: 'User with this username or email already exists' });
    }

    // Verify role exists
    const role = await db.get('SELECT id FROM roles WHERE id = ?', [roleId]);
    if (!role) {
      return res.status(400).json({ error: 'Invalid role ID' });
    }

    // Hash password
    const saltRounds = 10;
    const passwordHash = await bcrypt.hash(password, saltRounds);

    // Create user
    const userId = uuidv4();
    await db.run(`
      INSERT INTO users (
        id, username, email, password_hash, role_id, 
        first_name, last_name, is_active, email_verified
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
    `, [userId, username, email, passwordHash, roleId, firstName || '', lastName || '', isActive ? 1 : 0, false]);

    await auditLog(req.user!.id, AUDIT_ACTIONS.USER_CREATE, 'user', userId, {
      username,
      email,
      role_id: roleId,
      created_by: req.user!.username
    }, req.ip, req.get('User-Agent'));

    res.status(201).json({
      success: true,
      message: 'User created successfully',
      user: {
        id: userId,
        username,
        email,
        firstName,
        lastName,
        roleId,
        isActive
      }
    });

  } catch (error) {
    console.error('Create user error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Update user
router.put('/:userId', authenticateToken, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { userId } = req.params;
    const { username, email, firstName, lastName, roleId, isActive } = req.body;

    // Check if user exists
    const existingUser = await db.get('SELECT * FROM users WHERE id = ?', [userId]);
    if (!existingUser) {
      return res.status(404).json({ error: 'User not found' });
    }

    // Check permissions - users can update themselves, admins can update anyone
    const canUpdate = req.user!.id === userId || req.user!.permissions.includes('users:write');
    if (!canUpdate) {
      return res.status(403).json({ error: 'Insufficient permissions to update this user' });
    }

    // If updating role or active status, require admin permissions
    if ((roleId !== undefined || isActive !== undefined) && !req.user!.permissions.includes('users:write')) {
      return res.status(403).json({ error: 'Admin permissions required to update role or active status' });
    }

    let updates: any = {
      updated_at: new Date().toISOString()
    };

    if (username && username !== existingUser.username) {
      // Check if username is already taken
      const usernameConflict = await db.get(
        'SELECT id FROM users WHERE username = ? AND id != ?',
        [username, userId]
      );
      if (usernameConflict) {
        return res.status(400).json({ error: 'Username already taken' });
      }
      updates.username = username;
    }

    if (email && email !== existingUser.email) {
      // Check if email is already taken
      const emailConflict = await db.get(
        'SELECT id FROM users WHERE email = ? AND id != ?',
        [email, userId]
      );
      if (emailConflict) {
        return res.status(400).json({ error: 'Email already taken' });
      }
      updates.email = email;
      updates.email_verified = false; // Reset email verification
    }

    if (firstName !== undefined) updates.first_name = firstName;
    if (lastName !== undefined) updates.last_name = lastName;
    
    if (roleId !== undefined) {
      // Verify role exists
      const role = await db.get('SELECT id FROM roles WHERE id = ?', [roleId]);
      if (!role) {
        return res.status(400).json({ error: 'Invalid role ID' });
      }
      updates.role_id = roleId;
    }

    if (isActive !== undefined) {
      updates.is_active = isActive ? 1 : 0;
      
      // If deactivating user, also deactivate their sessions
      if (!isActive) {
        await db.run(
          'UPDATE user_sessions SET is_active = 0 WHERE user_id = ?',
          [userId]
        );
      }
    }

    // Build update query
    const updateFields = Object.keys(updates).map(key => `${key} = ?`).join(', ');
    const updateValues = Object.values(updates);

    await db.run(
      `UPDATE users SET ${updateFields} WHERE id = ?`,
      [...updateValues, userId]
    );

    await auditLog(req.user!.id, AUDIT_ACTIONS.USER_UPDATE, 'user', userId, {
      changes: Object.keys(updates),
      updated_by: req.user!.username,
      target_user: existingUser.username
    }, req.ip, req.get('User-Agent'));

    res.json({
      success: true,
      message: 'User updated successfully'
    });

  } catch (error) {
    console.error('Update user error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Delete user (admin only)
router.delete('/:userId', authenticateToken, requirePermission('users:delete'), async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { userId } = req.params;

    // Prevent self-deletion
    if (req.user!.id === userId) {
      return res.status(400).json({ error: 'Cannot delete your own account' });
    }

    // Check if user exists
    const existingUser = await db.get('SELECT * FROM users WHERE id = ?', [userId]);
    if (!existingUser) {
      return res.status(404).json({ error: 'User not found' });
    }

    // Soft delete - deactivate user and sessions
    await db.run('UPDATE users SET is_active = 0, updated_at = datetime("now") WHERE id = ?', [userId]);
    await db.run('UPDATE user_sessions SET is_active = 0 WHERE user_id = ?', [userId]);
    await db.run('UPDATE user_tokens SET is_active = 0 WHERE user_id = ?', [userId]);

    await auditLog(req.user!.id, AUDIT_ACTIONS.USER_DELETE, 'user', userId, {
      deleted_user: existingUser.username,
      deleted_by: req.user!.username
    }, req.ip, req.get('User-Agent'));

    res.json({
      success: true,
      message: 'User deleted successfully'
    });

  } catch (error) {
    console.error('Delete user error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Change user password
router.post('/:userId/change-password', authenticateToken, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { userId } = req.params;
    const { currentPassword, newPassword } = req.body;

    if (!newPassword) {
      return res.status(400).json({ error: 'New password is required' });
    }

    // Check permissions - users can change their own password, admins can change anyone's
    const canChangePassword = req.user!.id === userId || req.user!.permissions.includes('users:write');
    if (!canChangePassword) {
      return res.status(403).json({ error: 'Insufficient permissions to change this password' });
    }

    // Get user
    const user = await db.get('SELECT * FROM users WHERE id = ?', [userId]);
    if (!user) {
      return res.status(404).json({ error: 'User not found' });
    }

    // If user is changing their own password, verify current password
    if (req.user!.id === userId && currentPassword) {
      const isValidPassword = await bcrypt.compare(currentPassword, user.password_hash);
      if (!isValidPassword) {
        return res.status(400).json({ error: 'Current password is incorrect' });
      }
    }

    // Hash new password
    const saltRounds = 10;
    const newPasswordHash = await bcrypt.hash(newPassword, saltRounds);

    // Update password
    await db.run(
      'UPDATE users SET password_hash = ?, updated_at = datetime("now") WHERE id = ?',
      [newPasswordHash, userId]
    );

    // Invalidate all sessions for this user (force re-login)
    await db.run('UPDATE user_sessions SET is_active = 0 WHERE user_id = ?', [userId]);

    await auditLog(req.user!.id, AUDIT_ACTIONS.AUTH_PASSWORD_CHANGE, 'user', userId, {
      changed_by: req.user!.username,
      target_user: user.username,
      self_change: req.user!.id === userId
    }, req.ip, req.get('User-Agent'));

    res.json({
      success: true,
      message: 'Password changed successfully. Please log in again.'
    });

  } catch (error) {
    console.error('Change password error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

export default router;
