import express from 'express';
import { v4 as uuidv4 } from 'uuid';
import { db } from '../database/database';
import { createError } from '../middleware/errorHandler';

const router = express.Router();

// Get template categories (must come before /:id route)
router.get('/categories', async (req, res, next) => {
  try {
    const categories = await db.all(`
      SELECT DISTINCT category, COUNT(*) as count
      FROM templates
      GROUP BY category
      ORDER BY category
    `);

    res.json(categories);
  } catch (error) {
    next(error);
  }
});

// Get all templates
router.get('/', async (req, res, next) => {
  try {
    const templates = await db.all(`
      SELECT id, name, description, category, variables, created_at, updated_at, usage_count
      FROM templates
      ORDER BY created_at DESC
    `);

    const formattedTemplates = templates.map(template => ({
      ...template,
      variables: JSON.parse(template.variables || '[]'),
    }));

    res.json(formattedTemplates);
  } catch (error) {
    next(error);
  }
});

// Get template by ID
router.get('/:id', async (req, res, next) => {
  try {
    const { id } = req.params;
    const template = await db.get('SELECT * FROM templates WHERE id = ?', [id]);

    if (!template) {
      throw createError('Template not found', 404);
    }

    res.json({
      ...template,
      variables: JSON.parse(template.variables || '[]'),
    });
  } catch (error) {
    next(error);
  }
});

// Create new template
router.post('/', async (req, res, next) => {
  try {
    const { name, description, category, terraformCode, variables } = req.body;

    if (!name || !terraformCode) {
      throw createError('Missing required fields: name, terraformCode', 400);
    }

    const templateId = uuidv4();
    
    await db.run(`
      INSERT INTO templates (id, name, description, category, terraform_code, variables)
      VALUES (?, ?, ?, ?, ?, ?)
    `, [
      templateId,
      name,
      description || '',
      category || 'Custom',
      terraformCode,
      JSON.stringify(variables || []),
    ]);

    const template = await db.get('SELECT * FROM templates WHERE id = ?', [templateId]);

    res.status(201).json({
      ...template,
      variables: JSON.parse(template.variables || '[]'),
    });
  } catch (error) {
    next(error);
  }
});

// Update template
router.put('/:id', async (req, res, next) => {
  try {
    const { id } = req.params;
    const { name, description, category, terraformCode, variables } = req.body;

    const existingTemplate = await db.get('SELECT id FROM templates WHERE id = ?', [id]);
    if (!existingTemplate) {
      throw createError('Template not found', 404);
    }

    await db.run(`
      UPDATE templates 
      SET name = ?, description = ?, category = ?, terraform_code = ?, variables = ?, updated_at = datetime('now')
      WHERE id = ?
    `, [
      name,
      description,
      category,
      terraformCode,
      JSON.stringify(variables || []),
      id,
    ]);

    const template = await db.get('SELECT * FROM templates WHERE id = ?', [id]);

    res.json({
      ...template,
      variables: JSON.parse(template.variables || '[]'),
    });
  } catch (error) {
    next(error);
  }
});

// Delete template
router.delete('/:id', async (req, res, next) => {
  try {
    const { id } = req.params;

    const existingTemplate = await db.get('SELECT id FROM templates WHERE id = ?', [id]);
    if (!existingTemplate) {
      throw createError('Template not found', 404);
    }

    // Check if template is being used in any deployments
    const deployments = await db.get('SELECT COUNT(*) as count FROM deployments WHERE template_id = ?', [id]);
    if (deployments.count > 0) {
      throw createError('Cannot delete template that is being used in deployments', 400);
    }

    await db.run('DELETE FROM templates WHERE id = ?', [id]);

    res.json({
      message: 'Template deleted successfully',
    });
  } catch (error) {
    next(error);
  }
});

// Increment template usage count
router.post('/:id/use', async (req, res, next) => {
  try {
    const { id } = req.params;

    await db.run(`
      UPDATE templates 
      SET usage_count = usage_count + 1, updated_at = datetime('now')
      WHERE id = ?
    `, [id]);

    res.json({
      message: 'Template usage count updated',
    });
  } catch (error) {
    next(error);
  }
});



export default router;
