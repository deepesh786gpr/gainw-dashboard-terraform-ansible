import { Router, Request, Response } from 'express';
import CryptoJS from 'crypto-js';
import { v4 as uuidv4 } from 'uuid';
import { db } from '../database/database';
import { 
  authenticateToken,
  requirePermission,
  AuthenticatedRequest 
} from '../middleware/auth';
import { auditLog, AUDIT_ACTIONS } from '../utils/audit';

const router = Router();

// Encryption key for GitHub tokens (should be in environment variables)
const ENCRYPTION_KEY = process.env.GITHUB_TOKEN_ENCRYPTION_KEY || 'your-super-secret-encryption-key-change-in-production';

/**
 * Encrypt a GitHub token
 */
function encryptToken(token: string): string {
  return CryptoJS.AES.encrypt(token, ENCRYPTION_KEY).toString();
}

/**
 * Decrypt a GitHub token
 */
function decryptToken(encryptedToken: string): string {
  const bytes = CryptoJS.AES.decrypt(encryptedToken, ENCRYPTION_KEY);
  return bytes.toString(CryptoJS.enc.Utf8);
}

/**
 * Validate GitHub token by making a test API call
 */
async function validateGitHubToken(token: string): Promise<{ valid: boolean; user?: any; scopes?: string[]; error?: string }> {
  try {
    const response = await fetch('https://api.github.com/user', {
      headers: {
        'Authorization': `token ${token}`,
        'User-Agent': 'Terraform-Dashboard'
      }
    });

    if (!response.ok) {
      return { valid: false, error: `GitHub API error: ${response.status} ${response.statusText}` };
    }

    const user = await response.json();
    const scopes = response.headers.get('X-OAuth-Scopes')?.split(', ') || [];

    return { valid: true, user, scopes };
  } catch (error) {
    return { valid: false, error: `Network error: ${error.message}` };
  }
}

// Get all GitHub tokens for the current user
router.get('/', authenticateToken, requirePermission('github:read'), async (req: AuthenticatedRequest, res: Response) => {
  try {
    const tokens = await db.all(`
      SELECT id, token_name, token_metadata, expires_at, last_used, is_active, created_at, updated_at
      FROM user_tokens 
      WHERE user_id = ? AND token_type = 'github' AND is_active = 1
      ORDER BY created_at DESC
    `, [req.user!.id]);

    const tokensWithMetadata = tokens.map(token => ({
      ...token,
      metadata: token.token_metadata ? JSON.parse(token.token_metadata) : null
    }));

    res.json({
      success: true,
      tokens: tokensWithMetadata
    });

  } catch (error) {
    console.error('Get GitHub tokens error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Add a new GitHub token
router.post('/', authenticateToken, requirePermission('github:write'), async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { token, name, description } = req.body;

    if (!token || !name) {
      return res.status(400).json({ error: 'Token and name are required' });
    }

    // Validate the GitHub token
    const validation = await validateGitHubToken(token);
    if (!validation.valid) {
      return res.status(400).json({ 
        error: 'Invalid GitHub token', 
        details: validation.error 
      });
    }

    // Check if user already has a token with this name
    const existingToken = await db.get(
      'SELECT id FROM user_tokens WHERE user_id = ? AND token_type = ? AND token_name = ? AND is_active = 1',
      [req.user!.id, 'github', name]
    );

    if (existingToken) {
      return res.status(400).json({ error: 'A GitHub token with this name already exists' });
    }

    // Encrypt the token
    const encryptedToken = encryptToken(token);

    // Store token metadata
    const metadata = {
      github_user: validation.user,
      scopes: validation.scopes,
      description: description || '',
      added_at: new Date().toISOString()
    };

    const tokenId = uuidv4();
    await db.run(`
      INSERT INTO user_tokens (
        id, user_id, token_type, token_name, encrypted_token, 
        token_metadata, is_active
      ) VALUES (?, ?, ?, ?, ?, ?, ?)
    `, [
      tokenId,
      req.user!.id,
      'github',
      name,
      encryptedToken,
      JSON.stringify(metadata),
      true
    ]);

    await auditLog(req.user!.id, AUDIT_ACTIONS.GITHUB_TOKEN_ADD, 'github_token', tokenId, {
      token_name: name,
      github_user: validation.user?.login,
      scopes: validation.scopes
    }, req.ip, req.get('User-Agent'));

    res.status(201).json({
      success: true,
      message: 'GitHub token added successfully',
      token: {
        id: tokenId,
        name,
        metadata,
        created_at: new Date().toISOString()
      }
    });

  } catch (error) {
    console.error('Add GitHub token error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Update a GitHub token
router.put('/:tokenId', authenticateToken, requirePermission('github:write'), async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { tokenId } = req.params;
    const { token, name, description } = req.body;

    // Get existing token
    const existingToken = await db.get(
      'SELECT * FROM user_tokens WHERE id = ? AND user_id = ? AND token_type = ? AND is_active = 1',
      [tokenId, req.user!.id, 'github']
    );

    if (!existingToken) {
      return res.status(404).json({ error: 'GitHub token not found' });
    }

    let updates: any = {
      updated_at: new Date().toISOString()
    };

    // If new token provided, validate and encrypt it
    if (token) {
      const validation = await validateGitHubToken(token);
      if (!validation.valid) {
        return res.status(400).json({ 
          error: 'Invalid GitHub token', 
          details: validation.error 
        });
      }

      updates.encrypted_token = encryptToken(token);
      
      // Update metadata with new token info
      const existingMetadata = existingToken.token_metadata ? JSON.parse(existingToken.token_metadata) : {};
      updates.token_metadata = JSON.stringify({
        ...existingMetadata,
        github_user: validation.user,
        scopes: validation.scopes,
        description: description || existingMetadata.description || '',
        updated_at: new Date().toISOString()
      });
    }

    // Update name if provided
    if (name && name !== existingToken.token_name) {
      // Check if another token with this name exists
      const nameConflict = await db.get(
        'SELECT id FROM user_tokens WHERE user_id = ? AND token_type = ? AND token_name = ? AND id != ? AND is_active = 1',
        [req.user!.id, 'github', name, tokenId]
      );

      if (nameConflict) {
        return res.status(400).json({ error: 'A GitHub token with this name already exists' });
      }

      updates.token_name = name;
    }

    // Update description only if no new token provided
    if (!token && description !== undefined) {
      const existingMetadata = existingToken.token_metadata ? JSON.parse(existingToken.token_metadata) : {};
      updates.token_metadata = JSON.stringify({
        ...existingMetadata,
        description,
        updated_at: new Date().toISOString()
      });
    }

    // Build update query
    const updateFields = Object.keys(updates).map(key => `${key} = ?`).join(', ');
    const updateValues = Object.values(updates);

    await db.run(
      `UPDATE user_tokens SET ${updateFields} WHERE id = ?`,
      [...updateValues, tokenId]
    );

    await auditLog(req.user!.id, AUDIT_ACTIONS.GITHUB_TOKEN_UPDATE, 'github_token', tokenId, {
      token_name: name || existingToken.token_name,
      changes: Object.keys(updates)
    }, req.ip, req.get('User-Agent'));

    res.json({
      success: true,
      message: 'GitHub token updated successfully'
    });

  } catch (error) {
    console.error('Update GitHub token error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Delete a GitHub token
router.delete('/:tokenId', authenticateToken, requirePermission('github:write'), async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { tokenId } = req.params;

    // Get existing token
    const existingToken = await db.get(
      'SELECT * FROM user_tokens WHERE id = ? AND user_id = ? AND token_type = ? AND is_active = 1',
      [tokenId, req.user!.id, 'github']
    );

    if (!existingToken) {
      return res.status(404).json({ error: 'GitHub token not found' });
    }

    // Soft delete the token
    await db.run(
      'UPDATE user_tokens SET is_active = 0, updated_at = datetime("now") WHERE id = ?',
      [tokenId]
    );

    await auditLog(req.user!.id, AUDIT_ACTIONS.GITHUB_TOKEN_DELETE, 'github_token', tokenId, {
      token_name: existingToken.token_name
    }, req.ip, req.get('User-Agent'));

    res.json({
      success: true,
      message: 'GitHub token deleted successfully'
    });

  } catch (error) {
    console.error('Delete GitHub token error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Test a GitHub token
router.post('/:tokenId/test', authenticateToken, requirePermission('github:read'), async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { tokenId } = req.params;

    // Get the token
    const tokenRecord = await db.get(
      'SELECT * FROM user_tokens WHERE id = ? AND user_id = ? AND token_type = ? AND is_active = 1',
      [tokenId, req.user!.id, 'github']
    );

    if (!tokenRecord) {
      return res.status(404).json({ error: 'GitHub token not found' });
    }

    // Decrypt and test the token
    const token = decryptToken(tokenRecord.encrypted_token);
    const validation = await validateGitHubToken(token);

    // Update last_used timestamp
    await db.run(
      'UPDATE user_tokens SET last_used = datetime("now") WHERE id = ?',
      [tokenId]
    );

    res.json({
      success: true,
      valid: validation.valid,
      user: validation.user,
      scopes: validation.scopes,
      error: validation.error
    });

  } catch (error) {
    console.error('Test GitHub token error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

export default router;
export { encryptToken, decryptToken, validateGitHubToken };
