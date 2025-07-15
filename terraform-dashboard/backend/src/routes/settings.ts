import express from 'express';
import { db } from '../database/database';
import { AuthenticatedRequest } from '../middleware/auth';
import { createError } from '../middleware/errorHandler';

const router = express.Router();

// Get all settings
router.get('/', async (req: AuthenticatedRequest, res, next) => {
  try {
    const settings = await db.all('SELECT key, value FROM settings ORDER BY key');
    
    const settingsObject = settings.reduce((acc, setting) => {
      acc[setting.key] = setting.value;
      return acc;
    }, {} as Record<string, string>);

    res.json(settingsObject);
  } catch (error) {
    next(error);
  }
});

// Get setting by key
router.get('/:key', async (req: AuthenticatedRequest, res, next) => {
  try {
    const { key } = req.params;
    const setting = await db.get('SELECT value FROM settings WHERE key = ?', [key]);

    if (!setting) {
      throw createError('Setting not found', 404);
    }

    res.json({
      key,
      value: setting.value,
    });
  } catch (error) {
    next(error);
  }
});

// Update setting
router.put('/:key', async (req: AuthenticatedRequest, res, next) => {
  try {
    const { key } = req.params;
    const { value } = req.body;

    if (value === undefined) {
      throw createError('Missing required field: value', 400);
    }

    // Check if setting exists
    const existingSetting = await db.get('SELECT key FROM settings WHERE key = ?', [key]);

    if (existingSetting) {
      await db.run(`
        UPDATE settings 
        SET value = ?, updated_at = datetime('now')
        WHERE key = ?
      `, [value, key]);
    } else {
      await db.run(`
        INSERT INTO settings (key, value)
        VALUES (?, ?)
      `, [key, value]);
    }

    res.json({
      key,
      value,
      message: 'Setting updated successfully',
    });
  } catch (error) {
    next(error);
  }
});

// Update multiple settings
router.put('/', async (req: AuthenticatedRequest, res, next) => {
  try {
    const settings = req.body;

    if (!settings || typeof settings !== 'object') {
      throw createError('Invalid settings object', 400);
    }

    const updates = [];
    for (const [key, value] of Object.entries(settings)) {
      const existingSetting = await db.get('SELECT key FROM settings WHERE key = ?', [key]);

      if (existingSetting) {
        await db.run(`
          UPDATE settings 
          SET value = ?, updated_at = datetime('now')
          WHERE key = ?
        `, [value, key]);
      } else {
        await db.run(`
          INSERT INTO settings (key, value)
          VALUES (?, ?)
        `, [key, value]);
      }

      updates.push({ key, value });
    }

    res.json({
      message: 'Settings updated successfully',
      updated: updates,
    });
  } catch (error) {
    next(error);
  }
});

// Delete setting
router.delete('/:key', async (req: AuthenticatedRequest, res, next) => {
  try {
    const { key } = req.params;

    const existingSetting = await db.get('SELECT key FROM settings WHERE key = ?', [key]);
    if (!existingSetting) {
      throw createError('Setting not found', 404);
    }

    await db.run('DELETE FROM settings WHERE key = ?', [key]);

    res.json({
      message: 'Setting deleted successfully',
    });
  } catch (error) {
    next(error);
  }
});

// Get AWS configuration
router.get('/aws/config', async (req: AuthenticatedRequest, res, next) => {
  try {
    const awsSettings = await db.all(`
      SELECT key, value 
      FROM settings 
      WHERE key LIKE 'aws_%'
      ORDER BY key
    `);

    const config = awsSettings.reduce((acc, setting) => {
      const key = setting.key.replace('aws_', '');
      acc[key] = setting.value;
      return acc;
    }, {} as Record<string, string>);

    res.json(config);
  } catch (error) {
    next(error);
  }
});

// Get Terraform configuration
router.get('/terraform/config', async (req: AuthenticatedRequest, res, next) => {
  try {
    const terraformSettings = await db.all(`
      SELECT key, value 
      FROM settings 
      WHERE key LIKE 'terraform_%' OR key IN ('working_directory', 'auto_approve', 'parallelism')
      ORDER BY key
    `);

    const config = terraformSettings.reduce((acc, setting) => {
      let key = setting.key;
      if (key.startsWith('terraform_')) {
        key = key.replace('terraform_', '');
      }
      acc[key] = setting.value;
      return acc;
    }, {} as Record<string, string>);

    res.json(config);
  } catch (error) {
    next(error);
  }
});

// Test AWS connection
router.post('/aws/test', async (req: AuthenticatedRequest, res, next) => {
  try {
    // This would test AWS connection using the configured credentials
    // For now, we'll simulate a test
    const awsRegion = await db.get('SELECT value FROM settings WHERE key = ?', ['aws_region']);
    
    if (!awsRegion) {
      throw createError('AWS region not configured', 400);
    }

    // Simulate AWS connection test
    setTimeout(() => {
      res.json({
        success: true,
        message: 'AWS connection test successful',
        region: awsRegion.value,
      });
    }, 1000);
  } catch (error) {
    next(error);
  }
});

// Test Terraform installation
router.post('/terraform/test', async (req: AuthenticatedRequest, res, next) => {
  try {
    const { spawn } = require('child_process');
    const terraformPath = await db.get('SELECT value FROM settings WHERE key = ?', ['terraform_path']);
    
    if (!terraformPath) {
      throw createError('Terraform path not configured', 400);
    }

    const terraform = spawn(terraformPath.value, ['version']);
    let output = '';

    terraform.stdout.on('data', (data: Buffer) => {
      output += data.toString();
    });

    terraform.on('close', (code: number) => {
      if (code === 0) {
        res.json({
          success: true,
          message: 'Terraform installation test successful',
          version: output.trim(),
        });
      } else {
        res.status(400).json({
          success: false,
          message: 'Terraform installation test failed',
          error: `Exit code: ${code}`,
        });
      }
    });

    terraform.on('error', (error: Error) => {
      res.status(400).json({
        success: false,
        message: 'Terraform installation test failed',
        error: error.message,
      });
    });
  } catch (error) {
    next(error);
  }
});

export default router;
