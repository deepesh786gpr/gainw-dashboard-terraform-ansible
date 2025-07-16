import express from 'express';
import { v4 as uuidv4 } from 'uuid';
import { spawn } from 'child_process';
import fs from 'fs/promises';
import path from 'path';
import { db } from '../database/database';
import { createError } from '../middleware/errorHandler';
import {
  authenticateToken,
  optionalAuth,
  requirePermission,
  AuthenticatedRequest
} from '../middleware/auth';
import { auditLog, AUDIT_ACTIONS } from '../utils/audit';

// Mock WebSocket service for real-time updates
const mockWebSocketService = {
  sendToRoom: (room: string, message: any) => {
    console.log(`WebSocket broadcast to ${room}:`, message);
  },
  notifyDeploymentUpdate: (deploymentId: string, status: string, details?: any) => {
    console.log(`Deployment ${deploymentId} status: ${status}`, details);
  }
};

const router = express.Router();

// Create new deployment
router.post('/', authenticateToken, requirePermission('deployments:write'), async (req: AuthenticatedRequest, res, next) => {
  try {
    const { name, templateId, environment, variables } = req.body;

    if (!name || !templateId || !environment) {
      throw createError('Missing required fields: name, templateId, environment', 400);
    }

    // Check if template exists
    const template = await db.get('SELECT * FROM templates WHERE id = ?', [templateId]);
    if (!template) {
      throw createError('Template not found', 404);
    }

    // Check if deployment name already exists and auto-increment if needed
    let finalName = name;
    let counter = 1;
    let existingDeployment = await db.get('SELECT id FROM deployments WHERE name = ?', [finalName]);

    while (existingDeployment) {
      finalName = `${name}-${counter}`;
      existingDeployment = await db.get('SELECT id FROM deployments WHERE name = ?', [finalName]);
      counter++;

      // Prevent infinite loop
      if (counter > 100) {
        throw createError('Unable to generate unique deployment name', 400);
      }
    }

    const deploymentId = uuidv4();

    // Create deployment record with final name
    await db.run(`
      INSERT INTO deployments (id, name, template_id, user_id, environment, variables, status, last_action_by)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?)
    `, [
      deploymentId,
      finalName,
      templateId,
      req.user!.id,
      environment,
      JSON.stringify(variables || {}),
      'planning',
      req.user!.id
    ]);

    // Log deployment creation
    await auditLog(req.user!.id, AUDIT_ACTIONS.DEPLOYMENT_CREATE, 'deployment', deploymentId, {
      deployment_name: finalName,
      template_id: templateId,
      template_name: template.name,
      environment,
      variables_count: Object.keys(variables || {}).length
    }, req.ip, req.get('User-Agent'));

    // Start deployment process asynchronously
    setImmediate(() => {
      executeDeployment(deploymentId, template, variables || {});
    });

    const deployment = await db.get(`
      SELECT d.*, t.name as template_name
      FROM deployments d
      LEFT JOIN templates t ON d.template_id = t.id
      WHERE d.id = ?
    `, [deploymentId]);

    res.status(201).json({
      ...deployment,
      variables: JSON.parse(deployment.variables || '{}'),
      logs: JSON.parse(deployment.logs || '[]'),
    });
  } catch (error) {
    next(error);
  }
});

// Get all deployments
router.get('/', optionalAuth, async (req: AuthenticatedRequest, res, next) => {
  try {
    let query = `
      SELECT d.*, t.name as template_name, u.username as created_by_username
      FROM deployments d
      LEFT JOIN templates t ON d.template_id = t.id
      LEFT JOIN users u ON d.user_id = u.id
    `;

    const params: any[] = [];

    // If user is authenticated but not admin, only show their deployments
    if (req.user && !req.user.permissions.includes('deployments:read')) {
      query += ' WHERE d.user_id = ?';
      params.push(req.user.id);
    }

    query += ' ORDER BY d.created_at DESC';

    const deployments = await db.all(query, params);

    const formattedDeployments = deployments.map(deployment => ({
      ...deployment,
      variables: JSON.parse(deployment.variables || '{}'),
      logs: JSON.parse(deployment.logs || '[]'),
    }));

    res.json(formattedDeployments);
  } catch (error) {
    next(error);
  }
});

// Get deployment by ID
router.get('/:id', async (req, res, next) => {
  try {
    const { id } = req.params;
    const deployment = await db.get(`
      SELECT d.*, t.name as template_name, t.terraform_code
      FROM deployments d
      LEFT JOIN templates t ON d.template_id = t.id
      WHERE d.id = ?
    `, [id]);

    if (!deployment) {
      throw createError('Deployment not found', 404);
    }

    res.json({
      ...deployment,
      variables: JSON.parse(deployment.variables || '{}'),
      logs: JSON.parse(deployment.logs || '[]'),
    });
  } catch (error) {
    next(error);
  }
});

// Get deployment by name
router.get('/name/:name', async (req, res, next) => {
  try {
    const { name } = req.params;
    const deployment = await db.get(`
      SELECT d.*, t.name as template_name
      FROM deployments d
      LEFT JOIN templates t ON d.template_id = t.id
      WHERE d.name = ?
    `, [name]);

    if (!deployment) {
      throw createError('Deployment not found', 404);
    }

    res.json({
      ...deployment,
      variables: JSON.parse(deployment.variables || '{}'),
      logs: JSON.parse(deployment.logs || '[]'),
    });
  } catch (error) {
    next(error);
  }
});

// Update deployment status
router.patch('/:id/status', async (req, res, next) => {
  try {
    const { id } = req.params;
    const { status, logs } = req.body;

    if (!status) {
      throw createError('Missing required field: status', 400);
    }

    const updateData: any[] = [status];
    let query = 'UPDATE deployments SET status = ?, updated_at = datetime(\'now\')';

    if (logs) {
      query += ', logs = ?';
      updateData.push(JSON.stringify(logs));
    }

    query += ' WHERE id = ?';
    updateData.push(id);

    await db.run(query, updateData);

    const deployment = await db.get('SELECT * FROM deployments WHERE id = ?', [id]);

    res.json({
      ...deployment,
      variables: JSON.parse(deployment.variables || '{}'),
      logs: JSON.parse(deployment.logs || '[]'),
    });
  } catch (error) {
    next(error);
  }
});

// Delete/Destroy deployment
router.delete('/:id', async (req, res, next) => {
  try {
    const { id } = req.params;

    const existingDeployment = await db.get('SELECT * FROM deployments WHERE id = ?', [id]);
    if (!existingDeployment) {
      throw createError('Deployment not found', 404);
    }

    // Update deployment status to destroying
    await db.run(`
      UPDATE deployments
      SET status = ?, updated_at = datetime('now')
      WHERE id = ?
    `, ['destroying', id]);

    // Start destruction process asynchronously
    setImmediate(() => {
      executeDestruction(id, existingDeployment);
    });

    res.json({
      message: 'Deployment destruction initiated',
      status: 'destroying'
    });
  } catch (error) {
    next(error);
  }
});

// Get deployment statistics
router.get('/stats/overview', async (req, res, next) => {
  try {
    const stats = await db.all(`
      SELECT 
        COUNT(*) as total,
        SUM(CASE WHEN status = 'success' THEN 1 ELSE 0 END) as successful,
        SUM(CASE WHEN status = 'error' THEN 1 ELSE 0 END) as failed,
        SUM(CASE WHEN status = 'applying' OR status = 'planning' THEN 1 ELSE 0 END) as active,
        environment,
        COUNT(*) as count
      FROM deployments
      GROUP BY environment
    `);

    const totalStats = await db.get(`
      SELECT 
        COUNT(*) as total,
        SUM(CASE WHEN status = 'success' THEN 1 ELSE 0 END) as successful,
        SUM(CASE WHEN status = 'error' THEN 1 ELSE 0 END) as failed,
        SUM(CASE WHEN status = 'applying' OR status = 'planning' THEN 1 ELSE 0 END) as active
      FROM deployments
    `);

    res.json({
      total: totalStats,
      byEnvironment: stats,
    });
  } catch (error) {
    next(error);
  }
});

// Get recent deployments
router.get('/recent', async (req, res, next) => {
  try {
    const limit = parseInt((req.query.limit as string) || '10');
    
    const deployments = await db.all(`
      SELECT d.*, t.name as template_name
      FROM deployments d
      LEFT JOIN templates t ON d.template_id = t.id
      ORDER BY d.updated_at DESC
      LIMIT ?
    `, [limit]);

    const formattedDeployments = deployments.map(deployment => ({
      ...deployment,
      variables: JSON.parse(deployment.variables || '{}'),
    }));

    res.json(formattedDeployments);
  } catch (error) {
    next(error);
  }
});

// Execute deployment with real-time updates
async function executeDeployment(deploymentId: string, template: any, variables: any) {
  const workspaceDir = path.join(process.cwd(), 'terraform-workspace', deploymentId);
  const logs: string[] = [];

  try {
    // Create workspace directory
    await fs.mkdir(workspaceDir, { recursive: true });

    // Update status to planning
    await updateDeploymentStatus(deploymentId, 'planning', ['Starting deployment...']);

    // Generate Terraform files
    const terraformCode = generateTerraformCode(template.terraform_code, variables);

    // The generateTerraformCode function now handles deduplication internally
    // So we don't need to add separate variable declarations
    await fs.writeFile(path.join(workspaceDir, 'main.tf'), terraformCode);

    // Generate variables file
    const variablesContent = generateVariablesFile(variables);
    await fs.writeFile(path.join(workspaceDir, 'terraform.tfvars'), variablesContent);

    logs.push('Generated Terraform configuration files');
    await updateDeploymentStatus(deploymentId, 'planning', logs);

    // Terraform init
    logs.push('Running terraform init...');
    await updateDeploymentStatus(deploymentId, 'planning', logs);

    await runTerraformCommand(workspaceDir, 'init', logs);

    // Terraform plan
    logs.push('Running terraform plan...');
    await updateDeploymentStatus(deploymentId, 'planning', logs);

    await runTerraformCommand(workspaceDir, 'plan', logs);

    // Terraform apply
    logs.push('Running terraform apply...');
    await updateDeploymentStatus(deploymentId, 'applying', logs);

    await runTerraformCommand(workspaceDir, 'apply', logs, ['-auto-approve']);

    logs.push('Deployment completed successfully!');
    await updateDeploymentStatus(deploymentId, 'success', logs);

  } catch (error: any) {
    logs.push(`Error: ${error.message}`);
    await updateDeploymentStatus(deploymentId, 'error', logs);
  }
}

// Update deployment status with real-time notifications
async function updateDeploymentStatus(deploymentId: string, status: string, logs: string[]) {
  await db.run(`
    UPDATE deployments
    SET status = ?, logs = ?, updated_at = datetime('now')
    WHERE id = ?
  `, [status, JSON.stringify(logs), deploymentId]);

  // Send real-time update
  mockWebSocketService.notifyDeploymentUpdate(deploymentId, status, { logs });
  mockWebSocketService.sendToRoom(`deployment:${deploymentId}`, {
    type: 'deployment_status_update',
    payload: { deploymentId, status, logs },
    timestamp: new Date().toISOString(),
  });
}

// Generate variable declarations from template variables
function generateVariableDeclarations(templateVariables: any[]): string {
  if (!templateVariables || !Array.isArray(templateVariables)) {
    return '';
  }

  const reservedVariables = ['aws_region', 'environment'];
  const userTemplateVariables = templateVariables.filter(v => !reservedVariables.includes(v.name));

  const variableDeclarations = userTemplateVariables.map(variable => {
    let declaration = `variable "${variable.name}" {
  type        = ${variable.type}
  description = "${variable.description || `Variable ${variable.name}`}"`;

    if (variable.default !== undefined && variable.default !== null && variable.default !== '') {
      // Handle different default value types
      let defaultValue = variable.default;
      if (variable.type === 'string' && typeof defaultValue === 'string' && !defaultValue.startsWith('"')) {
        defaultValue = `"${defaultValue}"`;
      }
      declaration += `\n  default     = ${defaultValue}`;
    }

    declaration += '\n}';
    return declaration;
  }).join('\n\n');

  return variableDeclarations;
}

// Deduplicate Terraform declarations
function deduplicateTerraformCode(code: string): string {
  const lines = code.split('\n');
  const seenVariables = new Set<string>();
  const seenDataSources = new Set<string>();
  const seenOutputs = new Set<string>();
  const seenResources = new Set<string>();
  const filteredLines: string[] = [];

  let currentBlock = '';
  let currentBlockName = '';
  let blockStartIndex = -1;
  let braceCount = 0;
  let inBlock = false;

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    const trimmedLine = line.trim();

    // Skip empty lines and comments outside blocks
    if (!inBlock && (trimmedLine === '' || trimmedLine.startsWith('#'))) {
      filteredLines.push(line);
      continue;
    }

    // Detect start of blocks
    if (!inBlock && (
      trimmedLine.startsWith('variable ') ||
      trimmedLine.startsWith('data ') ||
      trimmedLine.startsWith('output ') ||
      trimmedLine.startsWith('resource ')
    )) {
      inBlock = true;
      blockStartIndex = i;
      braceCount = 0;

      // Extract block type and name
      const match = trimmedLine.match(/^(variable|data|output|resource)\s+"?([^"\s{]+)"?(?:\s+"([^"]+)")?/);
      if (match) {
        const blockType = match[1];
        const blockName = match[2];
        const resourceType = match[3];

        if (blockType === 'variable') {
          currentBlockName = `variable.${blockName}`;
        } else if (blockType === 'data') {
          currentBlockName = `data.${blockName}.${resourceType || 'default'}`;
        } else if (blockType === 'output') {
          currentBlockName = `output.${blockName}`;
        } else if (blockType === 'resource') {
          currentBlockName = `resource.${blockName}.${resourceType || 'default'}`;
        }
      }

      currentBlock = line + '\n';
    } else if (inBlock) {
      currentBlock += line + '\n';
    } else {
      // Line outside any block
      filteredLines.push(line);
      continue;
    }

    // Count braces to detect end of block
    if (inBlock) {
      for (const char of line) {
        if (char === '{') braceCount++;
        if (char === '}') braceCount--;
      }

      // End of block detected
      if (braceCount === 0 && trimmedLine.includes('}')) {
        inBlock = false;

        // Check if we've seen this block before
        const blockType = currentBlockName.split('.')[0];
        let isDuplicate = false;

        if (blockType === 'variable' && seenVariables.has(currentBlockName)) {
          isDuplicate = true;
        } else if (blockType === 'data' && seenDataSources.has(currentBlockName)) {
          isDuplicate = true;
        } else if (blockType === 'output' && seenOutputs.has(currentBlockName)) {
          isDuplicate = true;
        } else if (blockType === 'resource' && seenResources.has(currentBlockName)) {
          isDuplicate = true;
        }

        if (!isDuplicate) {
          // Add to seen sets
          if (blockType === 'variable') seenVariables.add(currentBlockName);
          else if (blockType === 'data') seenDataSources.add(currentBlockName);
          else if (blockType === 'output') seenOutputs.add(currentBlockName);
          else if (blockType === 'resource') seenResources.add(currentBlockName);

          // Add the block to filtered lines
          filteredLines.push(...currentBlock.split('\n').slice(0, -1));
        }

        // Reset for next block
        currentBlock = '';
        currentBlockName = '';
        blockStartIndex = -1;
      }
    }
  }

  return filteredLines.join('\n');
}

// Generate Terraform code with variables
function generateTerraformCode(templateCode: string, variables: any): string {
  // First, deduplicate the template code
  let code = deduplicateTerraformCode(templateCode);

  // Add Terraform and provider configuration
  const terraformConfig = `terraform {
  required_version = ">= 1.0"
  required_providers {
    aws = {
      source  = "hashicorp/aws"
      version = "~> 5.0"
    }
  }
}

provider "aws" {
  region = var.aws_region

  default_tags {
    tags = {
      Environment = var.environment
      ManagedBy   = "terraform-dashboard"
      Project     = "terraform-dashboard"
    }
  }
}`;

  // Add required AWS variables
  const awsVariables = `variable "aws_region" {
  type        = string
  description = "AWS region"
  default     = "us-east-1"
}

variable "environment" {
  type        = string
  description = "Environment name"
  default     = "dev"
}`;

  return `${terraformConfig}\n\n${awsVariables}\n\n${code}`;
}

// Generate variables file
function generateVariablesFile(variables: any): string {
  // Add default AWS variables
  const allVariables = {
    aws_region: process.env.AWS_DEFAULT_REGION || 'us-east-1',
    environment: 'dev',
    ...variables
  };

  return Object.entries(allVariables).map(([key, value]) => {
    if (Array.isArray(value)) {
      const arrayValues = value.map(v => `"${v}"`).join(', ');
      return `${key} = [${arrayValues}]`;
    } else if (typeof value === 'string') {
      return `${key} = "${value}"`;
    } else if (typeof value === 'boolean') {
      return `${key} = ${value}`;
    } else if (typeof value === 'number') {
      return `${key} = ${value}`;
    }
    return `${key} = ${JSON.stringify(value)}`;
  }).join('\n');
}

// Run Terraform command with real-time output
async function runTerraformCommand(
  workingDir: string,
  command: string,
  logs: string[],
  extraArgs: string[] = []
): Promise<void> {
  return new Promise((resolve, reject) => {
    const args = [command, ...extraArgs];

    // Prepare environment variables with AWS credentials
    const env: Record<string, string> = {
      ...process.env,
      AWS_PROFILE: process.env.AWS_PROFILE || 'default',
      AWS_REGION: process.env.AWS_REGION || process.env.AWS_DEFAULT_REGION || 'us-east-1',
      AWS_DEFAULT_REGION: process.env.AWS_DEFAULT_REGION || process.env.AWS_REGION || 'us-east-1',
    };

    // If AWS credentials are available in environment, pass them through
    if (process.env.AWS_ACCESS_KEY_ID) {
      env.AWS_ACCESS_KEY_ID = process.env.AWS_ACCESS_KEY_ID;
    }
    if (process.env.AWS_SECRET_ACCESS_KEY) {
      env.AWS_SECRET_ACCESS_KEY = process.env.AWS_SECRET_ACCESS_KEY;
    }
    if (process.env.AWS_SESSION_TOKEN) {
      env.AWS_SESSION_TOKEN = process.env.AWS_SESSION_TOKEN;
    }

    const terraformProcess = spawn('terraform', args, {
      cwd: workingDir,
      stdio: ['pipe', 'pipe', 'pipe'],
      env: env,
    });

    terraformProcess.stdout.on('data', (data) => {
      const output = data.toString().trim();
      if (output) {
        logs.push(output);
        console.log(`[${command}] ${output}`);
      }
    });

    terraformProcess.stderr.on('data', (data) => {
      const output = data.toString().trim();
      if (output) {
        logs.push(`ERROR: ${output}`);
        console.error(`[${command}] ${output}`);
      }
    });

    terraformProcess.on('close', (code) => {
      if (code === 0) {
        logs.push(`terraform ${command} completed successfully`);
        resolve();
      } else {
        reject(new Error(`terraform ${command} failed with exit code ${code}`));
      }
    });

    terraformProcess.on('error', (error) => {
      reject(error);
    });
  });
}

// Execute deployment destruction with real-time updates
async function executeDestruction(deploymentId: string, deployment: any) {
  const workspaceDir = path.join(process.cwd(), 'terraform-workspace', deploymentId);
  const logs: string[] = [];

  try {
    // Check if workspace directory exists
    const workspaceExists = await fs.access(workspaceDir).then(() => true).catch(() => false);

    if (!workspaceExists) {
      logs.push('No Terraform workspace found - marking as destroyed');
      await updateDeploymentStatus(deploymentId, 'destroyed', logs);
      return;
    }

    // Update status to destroying
    await updateDeploymentStatus(deploymentId, 'destroying', ['Starting destruction...']);

    // Initialize Terraform first (required for destroy)
    logs.push('Running terraform init...');
    await updateDeploymentStatus(deploymentId, 'destroying', logs);
    await runTerraformCommand(workspaceDir, 'init', logs);

    logs.push('Running terraform destroy...');
    await updateDeploymentStatus(deploymentId, 'destroying', logs);

    // Run terraform destroy
    await runTerraformCommand(workspaceDir, 'destroy', logs, ['-auto-approve']);

    logs.push('Infrastructure destroyed successfully');
    await updateDeploymentStatus(deploymentId, 'destroyed', logs);

    // Clean up workspace directory
    try {
      await fs.rm(workspaceDir, { recursive: true, force: true });
      logs.push('Workspace cleaned up');
    } catch (cleanupError) {
      console.error('Failed to clean up workspace:', cleanupError);
      logs.push('Warning: Failed to clean up workspace directory');
    }

    await updateDeploymentStatus(deploymentId, 'destroyed', logs);

  } catch (error: any) {
    console.error('Destruction failed:', error);
    logs.push(`Error: ${error.message}`);
    await updateDeploymentStatus(deploymentId, 'destroy_failed', logs);
  }
}

// Cleanup old failed deployments (optional endpoint)
router.delete('/cleanup', async (req, res, next) => {
  try {
    const { olderThanDays = 7 } = req.query;

    // Delete deployments older than specified days with error status
    const result = await db.run(`
      DELETE FROM deployments
      WHERE status = 'error'
      AND datetime(created_at) < datetime('now', '-${olderThanDays} days')
    `);

    res.json({
      message: `Cleaned up ${result.changes} old failed deployments`,
      deletedCount: result.changes
    });
  } catch (error) {
    next(error);
  }
});

export default router;
