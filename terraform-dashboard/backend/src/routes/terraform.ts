import express from 'express';
import { terraformService } from '../services/terraformService';
import { AuthenticatedRequest } from '../middleware/auth';
import { createError } from '../middleware/errorHandler';

const router = express.Router();

// Plan deployment
router.post('/plan', async (req: AuthenticatedRequest, res, next) => {
  try {
    const { templateId, name, environment, variables } = req.body;

    if (!templateId || !name || !environment) {
      throw createError('Missing required fields: templateId, name, environment', 400);
    }

    const operationId = await terraformService.plan({
      templateId,
      name,
      environment,
      variables: variables || {},
    });

    res.json({
      operationId,
      message: 'Plan operation started',
    });
  } catch (error) {
    next(error);
  }
});

// Apply deployment
router.post('/apply', async (req: AuthenticatedRequest, res, next) => {
  try {
    const { templateId, name, environment, variables } = req.body;

    if (!templateId || !name || !environment) {
      throw createError('Missing required fields: templateId, name, environment', 400);
    }

    const operationId = await terraformService.apply({
      templateId,
      name,
      environment,
      variables: variables || {},
    });

    res.json({
      operationId,
      message: 'Apply operation started',
    });
  } catch (error) {
    next(error);
  }
});

// Destroy deployment
router.post('/destroy', async (req: AuthenticatedRequest, res, next) => {
  try {
    const { deploymentName } = req.body;

    if (!deploymentName) {
      throw createError('Missing required field: deploymentName', 400);
    }

    const operationId = await terraformService.destroy(deploymentName);

    res.json({
      operationId,
      message: 'Destroy operation started',
    });
  } catch (error) {
    next(error);
  }
});

// Get operation status
router.get('/operations/:operationId', async (req: AuthenticatedRequest, res, next) => {
  try {
    const { operationId } = req.params;
    const operation = terraformService.getOperation(operationId);

    if (!operation) {
      throw createError('Operation not found', 404);
    }

    res.json(operation);
  } catch (error) {
    next(error);
  }
});

// Get all operations
router.get('/operations', async (req: AuthenticatedRequest, res, next) => {
  try {
    const operations = terraformService.getAllOperations();
    res.json(operations);
  } catch (error) {
    next(error);
  }
});

export default router;
