import express from 'express';
import cors from 'cors';
import * as bcrypt from 'bcrypt';
import * as jwt from 'jsonwebtoken';
import { v4 as uuidv4 } from 'uuid';
import { initializeSimpleDatabase, db } from './simple-database';
import { spawn } from 'child_process';
import * as fs from 'fs';
import * as path from 'path';
import {
  EC2Client,
  DescribeInstancesCommand,
  StartInstancesCommand,
  StopInstancesCommand,
  RebootInstancesCommand,
  DescribeVpcsCommand,
  DescribeSubnetsCommand,
  DescribeRouteTablesCommand,
  DescribeInternetGatewaysCommand,
  DescribeNatGatewaysCommand,
  DescribeSecurityGroupsCommand,
  DescribeNetworkAclsCommand,
  DescribeVpcEndpointsCommand
} from '@aws-sdk/client-ec2';
import { EKSClient, ListClustersCommand, DescribeClusterCommand, ListNodegroupsCommand, DescribeNodegroupCommand } from '@aws-sdk/client-eks';

const app = express();
const PORT = parseInt(process.env.PORT || '5000', 10);

// Initialize AWS clients
const ec2Client = new EC2Client({
  region: process.env.AWS_REGION || 'us-east-1'
});

const eksClient = new EKSClient({
  region: process.env.AWS_REGION || 'us-east-1'
});

// Middleware
app.use(cors({
  origin: [
    'http://localhost:3006',
    'http://192.168.31.94:3006',
    'http://localhost:3000',
    'http://192.168.31.94:3000',
    'http://localhost:8080',
    'http://192.168.31.94:8080',
    'null', // For file:// protocol
    'file://' // For local file access
  ],
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization', 'X-Requested-With'],
}));
app.use(express.json());

// Health check
app.get('/health', (req, res) => {
  res.json({ status: 'OK', message: 'Server is running' });
});

app.get('/api/health', (req, res) => {
  res.json({ status: 'OK', message: 'Terraform Dashboard API is running' });
});

// Login endpoint
app.post('/api/auth/login', async (req, res) => {
  try {
    const { username, password, rememberMe = false } = req.body;

    if (!username || !password) {
      return res.status(400).json({ error: 'Username and password are required' });
    }

    // Get user with role information
    const user = await db.get(`
      SELECT u.*, r.permissions, r.name as role_name
      FROM users u 
      JOIN roles r ON u.role_id = r.id 
      WHERE (u.username = ? OR u.email = ?) AND u.is_active = 1
    `, [username, username]);

    if (!user) {
      return res.status(401).json({ error: 'Invalid credentials' });
    }

    // Check password
    const isValidPassword = await bcrypt.compare(password, user.password_hash);
    if (!isValidPassword) {
      return res.status(401).json({ error: 'Invalid credentials' });
    }

    // Create session
    const sessionId = uuidv4();
    const expiresAt = new Date();
    expiresAt.setHours(expiresAt.getHours() + (rememberMe ? 24 * 7 : 24));

    await db.run(`
      INSERT INTO user_sessions (id, user_id, session_token, ip_address, user_agent, expires_at)
      VALUES (?, ?, ?, ?, ?, ?)
    `, [sessionId, user.id, sessionId, req.ip, req.get('User-Agent'), expiresAt.toISOString()]);

    // Generate tokens
    const tokenPayload = {
      userId: user.id,
      username: user.username,
      email: user.email,
      roleId: user.role_id,
      sessionId
    };

    const accessToken = jwt.sign(tokenPayload, 'default-secret', { expiresIn: '24h' });
    const refreshToken = jwt.sign(tokenPayload, 'default-secret', { expiresIn: '7d' });

    // Update refresh token in session
    await db.run(
      'UPDATE user_sessions SET refresh_token = ? WHERE id = ?',
      [refreshToken, sessionId]
    );

    // Update user login info
    await db.run(
      'UPDATE users SET last_login = datetime("now"), login_count = login_count + 1 WHERE id = ?',
      [user.id]
    );

    res.json({
      success: true,
      user: {
        id: user.id,
        username: user.username,
        email: user.email,
        firstName: user.first_name,
        lastName: user.last_name,
        role: {
          id: user.role_id,
          name: user.role_name,
          permissions: JSON.parse(user.permissions || '[]')
        },
        avatarUrl: user.avatar_url
      },
      tokens: {
        accessToken,
        refreshToken,
        expiresAt: expiresAt.toISOString()
      }
    });

  } catch (error) {
    console.error('Login error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Get current user info
app.get('/api/auth/me', async (req, res) => {
  try {
    const authHeader = req.headers.authorization;
    const token = authHeader && authHeader.split(' ')[1];

    if (!token) {
      return res.status(401).json({ error: 'Access token required' });
    }

    const decoded = jwt.verify(token, 'default-secret') as any;
    
    // Get user with role information
    const user = await db.get(`
      SELECT u.*, r.permissions, r.name as role_name, r.description as role_description
      FROM users u 
      JOIN roles r ON u.role_id = r.id 
      WHERE u.id = ?
    `, [decoded.userId]);

    if (!user) {
      return res.status(404).json({ error: 'User not found' });
    }

    res.json({
      success: true,
      user: {
        id: user.id,
        username: user.username,
        email: user.email,
        firstName: user.first_name,
        lastName: user.last_name,
        avatarUrl: user.avatar_url,
        emailVerified: user.email_verified,
        lastLogin: user.last_login,
        loginCount: user.login_count,
        createdAt: user.created_at,
        role: {
          id: user.role_id,
          name: user.role_name,
          description: user.role_description,
          permissions: JSON.parse(user.permissions || '[]')
        }
      }
    });

  } catch (error) {
    console.error('Get user info error:', error);
    res.status(401).json({ error: 'Invalid token' });
  }
});

// Logout endpoint
app.post('/api/auth/logout', async (req, res) => {
  try {
    const authHeader = req.headers.authorization;
    const token = authHeader && authHeader.split(' ')[1];

    if (token) {
      try {
        const decoded = jwt.verify(token, 'default-secret') as any;
        
        // Deactivate session
        await db.run(
          'UPDATE user_sessions SET is_active = 0 WHERE id = ?',
          [decoded.sessionId]
        );
      } catch (error) {
        // Token might be invalid, but we still want to return success
      }
    }

    res.json({ success: true, message: 'Logged out successfully' });
  } catch (error) {
    console.error('Logout error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Simple API routes for demo
app.get('/api/templates', async (req, res) => {
  try {
    const templates = await db.all('SELECT * FROM templates ORDER BY category, name');

    const formattedTemplates = templates.map(template => ({
      id: template.id,
      name: template.name,
      description: template.description,
      category: template.category,
      variables: JSON.parse(template.variables || '[]'),
      terraformCode: template.terraform_code,
      template_type: template.template_type || 'terraform',
      createdAt: template.created_at,
      updatedAt: template.updated_at
    }));

    res.json(formattedTemplates);
  } catch (error) {
    console.error('Error fetching templates:', error);
    // Fallback to hardcoded templates if database fails
    res.json([
    {
      id: '1',
      name: 'EC2 Instance',
      description: 'Deploy a single EC2 instance with security group',
      category: 'Compute',
      variables: [
        { name: 'name', type: 'string', description: 'Instance name', required: true },
        { name: 'instance_type', type: 'string', description: 'Instance type', required: true, default: 't3.micro', options: ['t3.micro', 't3.small', 't3.medium', 't3.large', 't3.xlarge', 'm5.large', 'm5.xlarge', 'c5.large', 'c5.xlarge'] },
        { name: 'ami_id', type: 'string', description: 'AMI ID (leave empty for latest Amazon Linux 2)', required: false, default: '' },
        { name: 'key_name', type: 'string', description: 'EC2 Key Pair name', required: false, default: '' },
        { name: 'vpc_security_group_ids', type: 'list', description: 'List of security group IDs', required: false, default: [] },
        { name: 'subnet_id', type: 'string', description: 'Subnet ID', required: false, default: '' },
        { name: 'associate_public_ip_address', type: 'boolean', description: 'Associate a public IP address', required: false, default: true },
        { name: 'environment', type: 'string', description: 'Environment tag', required: false, default: 'dev', options: ['dev', 'staging', 'prod'] }
      ]
    },
    {
      id: '2',
      name: 'EKS Cluster',
      description: 'Deploy a comprehensive Amazon EKS cluster with VPC, node groups, and security configurations',
      category: 'Container',
      variables: [
        { name: 'cluster_name', type: 'string', description: 'Name of the EKS cluster', required: true },
        { name: 'kubernetes_version', type: 'string', description: 'Kubernetes version', required: false, default: '1.28', options: ['1.24', '1.25', '1.26', '1.27', '1.28', '1.29'] },
        { name: 'vpc_cidr', type: 'string', description: 'CIDR block for VPC', required: false, default: '10.0.0.0/16' },
        { name: 'node_instance_types', type: 'list', description: 'Instance types for EKS node group', required: false, default: ['t3.medium'], options: ['t3.small', 't3.medium', 't3.large', 't3.xlarge', 'm5.large', 'm5.xlarge', 'm5.2xlarge', 'c5.large', 'c5.xlarge', 'c5.2xlarge'] },
        { name: 'desired_capacity', type: 'number', description: 'Desired number of worker nodes', required: false, default: 2 },
        { name: 'max_capacity', type: 'number', description: 'Maximum number of worker nodes', required: false, default: 4 },
        { name: 'min_capacity', type: 'number', description: 'Minimum number of worker nodes', required: false, default: 1 },
        { name: 'environment', type: 'string', description: 'Environment name', required: false, default: 'dev', options: ['dev', 'staging', 'prod'] }
      ]
    },
    {
      id: '3',
      name: 'Lambda Function',
      description: 'Deploy a comprehensive AWS Lambda function with IAM roles, environment variables, and optional API Gateway integration',
      category: 'Serverless',
      variables: [
        { name: 'function_name', type: 'string', description: 'A unique name for your Lambda Function', required: true },
        { name: 'handler', type: 'string', description: 'The function entrypoint in your code', required: false, default: 'index.handler' },
        { name: 'runtime', type: 'string', description: 'The runtime environment for the Lambda function', required: false, default: 'python3.9', options: ['python3.8', 'python3.9', 'python3.10', 'python3.11', 'nodejs16.x', 'nodejs18.x', 'nodejs20.x', 'java8', 'java11', 'java17', 'java21', 'dotnet6', 'dotnet8', 'go1.x', 'ruby3.2'] },
        { name: 'timeout', type: 'number', description: 'The amount of time your Lambda Function has to run in seconds', required: false, default: 3 },
        { name: 'memory_size', type: 'number', description: 'Amount of memory in MB your Lambda Function can use at runtime', required: false, default: 128 },
        { name: 'environment_variables', type: 'object', description: 'Environment variables for the Lambda function', required: false, default: {} },
        { name: 'environment', type: 'string', description: 'Environment name', required: false, default: 'dev', options: ['dev', 'staging', 'prod'] }
      ]
    },
    {
      id: '4',
      name: 'RDS Database',
      description: 'Deploy a comprehensive Amazon RDS database instance with security groups, parameter groups, and backup configurations',
      category: 'Database',
      variables: [
        { name: 'identifier', type: 'string', description: 'The name of the RDS instance', required: true },
        { name: 'engine', type: 'string', description: 'The database engine', required: false, default: 'mysql', options: ['mysql', 'postgres', 'mariadb', 'oracle-ee', 'oracle-se2', 'sqlserver-ex', 'sqlserver-web', 'sqlserver-se', 'sqlserver-ee'] },
        { name: 'engine_version', type: 'string', description: 'The engine version to use', required: false, default: '8.0' },
        { name: 'instance_class', type: 'string', description: 'The instance type of the RDS instance', required: false, default: 'db.t3.micro', options: ['db.t3.micro', 'db.t3.small', 'db.t3.medium', 'db.t3.large', 'db.m5.large', 'db.m5.xlarge', 'db.m5.2xlarge', 'db.r5.large', 'db.r5.xlarge'] },
        { name: 'allocated_storage', type: 'number', description: 'The allocated storage in gigabytes', required: false, default: 20 },
        { name: 'storage_type', type: 'string', description: 'One of standard (magnetic), gp2 (general purpose SSD), or io1 (provisioned IOPS SSD)', required: false, default: 'gp2', options: ['standard', 'gp2', 'gp3', 'io1', 'io2'] },
        { name: 'db_name', type: 'string', description: 'The name of the database to create when the DB instance is created', required: false, default: '' },
        { name: 'username', type: 'string', description: 'Username for the master DB user', required: true },
        { name: 'manage_master_user_password', type: 'boolean', description: 'Set to true to allow RDS to manage the master user password in Secrets Manager', required: false, default: true },
        { name: 'environment', type: 'string', description: 'Environment name', required: false, default: 'dev', options: ['dev', 'staging', 'prod'] }
      ]
    },
    {
      id: '5',
      name: 'S3 Bucket',
      description: 'Create an S3 bucket with encryption, versioning, and access controls',
      category: 'Storage',
      variables: [
        { name: 'bucket_name', type: 'string', description: 'S3 bucket name (must be globally unique)', required: true },
        { name: 'versioning_enabled', type: 'boolean', description: 'Enable S3 bucket versioning', required: false, default: true },
        { name: 'encryption_algorithm', type: 'string', description: 'Server-side encryption algorithm', required: false, default: 'AES256', options: ['AES256', 'aws:kms'] },
        { name: 'bucket_key_enabled', type: 'boolean', description: 'Whether to use S3 Bucket Keys for SSE-KMS', required: false, default: true },
        { name: 'block_public_access', type: 'boolean', description: 'Block all public access to the bucket', required: false, default: true },
        { name: 'lifecycle_enabled', type: 'boolean', description: 'Enable lifecycle management', required: false, default: false },
        { name: 'environment', type: 'string', description: 'Environment name', required: false, default: 'dev', options: ['dev', 'staging', 'prod'] }
      ]
    },
    {
      id: '6',
      name: 'VPC Network',
      description: 'Create a VPC with public and private subnets, internet gateway, and NAT gateway',
      category: 'Network',
      variables: [
        { name: 'vpc_name', type: 'string', description: 'Name of the VPC', required: true },
        { name: 'vpc_cidr', type: 'string', description: 'CIDR block for VPC', required: false, default: '10.0.0.0/16' },
        { name: 'availability_zones', type: 'list', description: 'List of availability zones', required: false, default: ['us-east-1a', 'us-east-1b'] },
        { name: 'public_subnet_cidrs', type: 'list', description: 'CIDR blocks for public subnets', required: false, default: ['10.0.1.0/24', '10.0.2.0/24'] },
        { name: 'private_subnet_cidrs', type: 'list', description: 'CIDR blocks for private subnets', required: false, default: ['10.0.10.0/24', '10.0.20.0/24'] },
        { name: 'enable_nat_gateway', type: 'boolean', description: 'Enable NAT Gateway for private subnets', required: false, default: true },
        { name: 'enable_vpn_gateway', type: 'boolean', description: 'Enable VPN Gateway', required: false, default: false },
        { name: 'environment', type: 'string', description: 'Environment name', required: false, default: 'dev', options: ['dev', 'staging', 'prod'] }
      ]
    }
    ]);
  }
});

// Deployments endpoints
app.get('/api/deployments', async (req, res) => {
  try {
    const deployments = await db.all(`
      SELECT d.*, t.name as template_name, u.username as created_by_username
      FROM deployments d
      LEFT JOIN templates t ON d.template_id = t.id
      LEFT JOIN users u ON d.user_id = u.id
      ORDER BY d.created_at DESC
    `);

    const formattedDeployments = deployments.map(deployment => ({
      id: deployment.id,
      name: deployment.name,
      templateId: deployment.template_id,
      templateName: deployment.template_name || 'Unknown Template',
      status: deployment.status,
      environment: deployment.environment,
      variables: JSON.parse(deployment.variables || '{}'),
      terraformState: deployment.terraform_state,
      logs: deployment.logs,
      workspacePath: deployment.workspace_path,
      lastAction: deployment.last_action,
      lastActionBy: deployment.last_action_by,
      createdBy: deployment.created_by_username,
      createdAt: deployment.created_at,
      updatedAt: deployment.updated_at
    }));

    res.json(formattedDeployments);
  } catch (error) {
    console.error('Error fetching deployments:', error);
    res.status(500).json({ error: 'Failed to fetch deployments' });
  }
});

app.post('/api/deployments', async (req, res) => {
  try {
    const authHeader = req.headers.authorization;
    const token = authHeader && authHeader.split(' ')[1];

    if (!token) {
      return res.status(401).json({ error: 'Access token required' });
    }

    const decoded = jwt.verify(token, 'default-secret') as any;
    const userId = decoded.userId;

    const { name, templateId, environment, variables } = req.body;

    if (!name || !templateId) {
      return res.status(400).json({ error: 'Name and template ID are required' });
    }

    // Check if template exists
    const template = await db.get('SELECT * FROM templates WHERE id = ?', [templateId]);
    if (!template) {
      return res.status(404).json({ error: 'Template not found' });
    }

    // Generate deployment ID
    const deploymentId = `deploy-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;

    // Create deployment record
    await db.run(`
      INSERT INTO deployments (
        id, name, template_id, user_id, status, environment,
        variables, last_action, last_action_by
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
    `, [
      deploymentId,
      name,
      templateId,
      userId,
      'pending',
      environment || 'dev',
      JSON.stringify(variables || {}),
      'created',
      userId
    ]);

    // Get the created deployment with template info
    const newDeployment = await db.get(`
      SELECT d.*, t.name as template_name, u.username as created_by_username
      FROM deployments d
      LEFT JOIN templates t ON d.template_id = t.id
      LEFT JOIN users u ON d.user_id = u.id
      WHERE d.id = ?
    `, [deploymentId]);

    const formattedDeployment = {
      id: newDeployment.id,
      name: newDeployment.name,
      templateId: newDeployment.template_id,
      templateName: newDeployment.template_name,
      status: newDeployment.status,
      environment: newDeployment.environment,
      variables: JSON.parse(newDeployment.variables || '{}'),
      terraformState: newDeployment.terraform_state,
      logs: newDeployment.logs,
      workspacePath: newDeployment.workspace_path,
      lastAction: newDeployment.last_action,
      lastActionBy: newDeployment.last_action_by,
      createdBy: newDeployment.created_by_username,
      createdAt: newDeployment.created_at,
      updatedAt: newDeployment.updated_at
    };

    res.status(201).json({
      success: true,
      deployment: formattedDeployment,
      message: 'Deployment created successfully'
    });

    // Start the deployment process asynchronously
    console.log(`🚀 Starting deployment process for: ${deploymentId}`);
    processDeployment(deploymentId).catch(error => {
      console.error(`❌ Deployment process failed for ${deploymentId}:`, error);
    });

  } catch (error) {
    console.error('Error creating deployment:', error);
    res.status(500).json({ error: 'Failed to create deployment' });
  }
});

// Get specific deployment
app.get('/api/deployments/:id', async (req, res) => {
  try {
    const { id } = req.params;

    const deployment = await db.get(`
      SELECT d.*, t.name as template_name, u.username as created_by_username
      FROM deployments d
      LEFT JOIN templates t ON d.template_id = t.id
      LEFT JOIN users u ON d.user_id = u.id
      WHERE d.id = ?
    `, [id]);

    if (!deployment) {
      return res.status(404).json({ error: 'Deployment not found' });
    }

    const formattedDeployment = {
      id: deployment.id,
      name: deployment.name,
      templateId: deployment.template_id,
      templateName: deployment.template_name,
      status: deployment.status,
      environment: deployment.environment,
      variables: JSON.parse(deployment.variables || '{}'),
      terraformState: deployment.terraform_state,
      logs: deployment.logs,
      workspacePath: deployment.workspace_path,
      lastAction: deployment.last_action,
      lastActionBy: deployment.last_action_by,
      createdBy: deployment.created_by_username,
      createdAt: deployment.created_at,
      updatedAt: deployment.updated_at
    };

    res.json(formattedDeployment);
  } catch (error) {
    console.error('Error fetching deployment:', error);
    res.status(500).json({ error: 'Failed to fetch deployment' });
  }
});

// Update deployment status
app.put('/api/deployments/:id', async (req, res) => {
  try {
    const authHeader = req.headers.authorization;
    const token = authHeader && authHeader.split(' ')[1];

    if (!token) {
      return res.status(401).json({ error: 'Access token required' });
    }

    const decoded = jwt.verify(token, 'default-secret') as any;
    const userId = decoded.userId;

    const { id } = req.params;
    const { status, logs, terraformState, lastAction } = req.body;

    // Check if deployment exists
    const deployment = await db.get('SELECT * FROM deployments WHERE id = ?', [id]);
    if (!deployment) {
      return res.status(404).json({ error: 'Deployment not found' });
    }

    // Update deployment
    await db.run(`
      UPDATE deployments
      SET status = ?, logs = ?, terraform_state = ?, last_action = ?,
          last_action_by = ?, updated_at = datetime('now')
      WHERE id = ?
    `, [
      status || deployment.status,
      logs || deployment.logs,
      terraformState || deployment.terraform_state,
      lastAction || deployment.last_action,
      userId,
      id
    ]);

    // Get updated deployment
    const updatedDeployment = await db.get(`
      SELECT d.*, t.name as template_name, u.username as created_by_username
      FROM deployments d
      LEFT JOIN templates t ON d.template_id = t.id
      LEFT JOIN users u ON d.user_id = u.id
      WHERE d.id = ?
    `, [id]);

    const formattedDeployment = {
      id: updatedDeployment.id,
      name: updatedDeployment.name,
      templateId: updatedDeployment.template_id,
      templateName: updatedDeployment.template_name,
      status: updatedDeployment.status,
      environment: updatedDeployment.environment,
      variables: JSON.parse(updatedDeployment.variables || '{}'),
      terraformState: updatedDeployment.terraform_state,
      logs: updatedDeployment.logs,
      workspacePath: updatedDeployment.workspace_path,
      lastAction: updatedDeployment.last_action,
      lastActionBy: updatedDeployment.last_action_by,
      createdBy: updatedDeployment.created_by_username,
      createdAt: updatedDeployment.created_at,
      updatedAt: updatedDeployment.updated_at
    };

    res.json({
      success: true,
      deployment: formattedDeployment,
      message: 'Deployment updated successfully'
    });

  } catch (error) {
    console.error('Error updating deployment:', error);
    res.status(500).json({ error: 'Failed to update deployment' });
  }
});

// Destroy deployment infrastructure
app.post('/api/deployments/:id/destroy', async (req, res) => {
  try {
    const authHeader = req.headers.authorization;
    const token = authHeader && authHeader.split(' ')[1];

    if (!token) {
      return res.status(401).json({ error: 'Access token required' });
    }

    const decoded = jwt.verify(token, 'default-secret') as any;
    const userId = decoded.userId;

    const { id } = req.params;

    // Check if deployment exists
    const deployment = await db.get('SELECT * FROM deployments WHERE id = ?', [id]);
    if (!deployment) {
      return res.status(404).json({ error: 'Deployment not found' });
    }

    // Update status to destroying
    await db.run(`
      UPDATE deployments
      SET status = 'destroying', last_action = 'terraform_destroy_initiated',
          last_action_by = ?, updated_at = datetime('now')
      WHERE id = ?
    `, [userId, id]);

    res.json({
      success: true,
      message: 'Destroy process initiated'
    });

    // Start the destroy process asynchronously
    console.log(`🗑️ Starting destroy process for: ${id}`);
    processDestroy(id).catch(error => {
      console.error(`❌ Destroy process failed for ${id}:`, error);
    });

  } catch (error) {
    console.error('Error initiating destroy:', error);
    res.status(500).json({ error: 'Failed to initiate destroy' });
  }
});

// Delete deployment record (after destroy)
app.delete('/api/deployments/:id', async (req, res) => {
  try {
    const authHeader = req.headers.authorization;
    const token = authHeader && authHeader.split(' ')[1];

    if (!token) {
      return res.status(401).json({ error: 'Access token required' });
    }

    const { id } = req.params;

    // Check if deployment exists
    const deployment = await db.get('SELECT * FROM deployments WHERE id = ?', [id]);
    if (!deployment) {
      return res.status(404).json({ error: 'Deployment not found' });
    }

    // Only allow deletion if deployment is destroyed or failed
    if (deployment.status !== 'destroyed' && deployment.status !== 'failed') {
      return res.status(400).json({
        error: 'Deployment must be destroyed before deletion. Use /destroy endpoint first.'
      });
    }

    // Delete deployment record
    await db.run('DELETE FROM deployments WHERE id = ?', [id]);

    res.json({
      success: true,
      message: 'Deployment record deleted successfully'
    });

  } catch (error) {
    console.error('Error deleting deployment:', error);
    res.status(500).json({ error: 'Failed to delete deployment' });
  }
});

// Instances endpoints - Real AWS EC2 instances
// Get EKS clusters endpoint
app.get('/api/clusters', async (req, res) => {
  try {
    console.log('🔍 Fetching EKS clusters...');
    
    // Try to get real clusters from AWS
    try {
      const listCommand = new ListClustersCommand({});
      const listResult = await eksClient.send(listCommand);
      
      const clusters = [];
      
      // Get details for each cluster
      if (listResult.clusters && listResult.clusters.length > 0) {
        for (const clusterName of listResult.clusters) {
          const describeCommand = new DescribeClusterCommand({ name: clusterName });
          const clusterDetails = await eksClient.send(describeCommand);
          
          if (clusterDetails.cluster) {
            // Get nodegroups for this cluster
            const nodeGroupsCommand = new ListNodegroupsCommand({ clusterName });
            const nodeGroupsResult = await eksClient.send(nodeGroupsCommand);
            const nodeGroups = [];
            
            if (nodeGroupsResult.nodegroups) {
              for (const nodeGroupName of nodeGroupsResult.nodegroups) {
                const nodeGroupCommand = new DescribeNodegroupCommand({
                  clusterName,
                  nodegroupName: nodeGroupName
                });
                const nodeGroupDetails = await eksClient.send(nodeGroupCommand);
                
                if (nodeGroupDetails.nodegroup) {
                  nodeGroups.push({
                    name: nodeGroupDetails.nodegroup.nodegroupName,
                    status: nodeGroupDetails.nodegroup.status,
                    instanceTypes: nodeGroupDetails.nodegroup.instanceTypes,
                    desiredSize: nodeGroupDetails.nodegroup.scalingConfig?.desiredSize,
                    minSize: nodeGroupDetails.nodegroup.scalingConfig?.minSize,
                    maxSize: nodeGroupDetails.nodegroup.scalingConfig?.maxSize,
                    amiType: nodeGroupDetails.nodegroup.amiType,
                    capacityType: nodeGroupDetails.nodegroup.capacityType
                  });
                }
              }
            }
            
            // Extract environment tag
            const tags = clusterDetails.cluster.tags || {};
            const environment = tags['Environment'] || tags['environment'] || 'production';
            
            clusters.push({
              id: clusterDetails.cluster.name,
              name: clusterDetails.cluster.name,
              status: clusterDetails.cluster.status,
              version: clusterDetails.cluster.version,
              platformVersion: clusterDetails.cluster.platformVersion,
              endpoint: clusterDetails.cluster.endpoint,
              createdAt: clusterDetails.cluster.createdAt?.toISOString(),
              region: process.env.AWS_REGION || 'us-east-1',
              environment,
              nodeGroups,
              tags
            });
          }
        }
      }
      
      console.log(`Found ${clusters.length} real EKS clusters`);
      return res.json(clusters);
    } catch (awsError) {
      console.log('⚠️ AWS credentials not available for EKS or no clusters found, returning mock data');
      console.error('Error details:', awsError);
      
      // Return mock data if AWS credentials are not available or no clusters found
      const mockClusters = [
        {
          id: 'eks-prod-cluster',
          name: 'production-cluster',
          status: 'ACTIVE',
          version: '1.28',
          platformVersion: 'eks.8',
          endpoint: 'https://A1B2C3D4E5F6.gr7.us-east-1.eks.amazonaws.com',
          createdAt: '2024-01-15T10:30:00Z',
          region: 'us-east-1',
          environment: 'production',
          nodeGroups: [
            {
              name: 'worker-nodes',
              status: 'ACTIVE',
              instanceTypes: ['t3.medium', 't3.large'],
              desiredSize: 3,
              minSize: 1,
              maxSize: 10,
              amiType: 'AL2_x86_64',
              capacityType: 'ON_DEMAND'
            }
          ],
          tags: {
            Environment: 'production',
            ManagedBy: 'terraform'
          }
        },
        {
          id: 'eks-dev-cluster',
          name: 'development-cluster',
          status: 'ACTIVE',
          version: '1.27',
          platformVersion: 'eks.7',
          endpoint: 'https://G7H8I9J0K1L2.gr7.us-west-2.eks.amazonaws.com',
          createdAt: '2024-01-10T08:15:00Z',
          region: 'us-west-2',
          environment: 'development',
          nodeGroups: [
            {
              name: 'dev-nodes',
              status: 'ACTIVE',
              instanceTypes: ['t3.small'],
              desiredSize: 2,
              minSize: 1,
              maxSize: 5,
              amiType: 'AL2_x86_64',
              capacityType: 'SPOT'
            }
          ],
          tags: {
            Environment: 'development',
            ManagedBy: 'terraform'
          }
        }
      ];
      
      return res.json(mockClusters);
    }
  } catch (error) {
    console.error('Error in /api/clusters endpoint:', error);
    res.status(500).json({ error: 'Failed to fetch clusters' });
  }
});

app.get('/api/instances', async (req, res) => {
  try {
    console.log('🔍 Fetching real EC2 instances from AWS...');

    const command = new DescribeInstancesCommand({});
    const response = await ec2Client.send(command);

    const instances: any[] = [];

    if (response.Reservations) {
      for (const reservation of response.Reservations) {
        if (reservation.Instances) {
          for (const instance of reservation.Instances) {
            // Skip terminated instances
            if (instance.State?.Name === 'terminated') {
              continue;
            }

            // Extract instance name from tags
            const nameTag = instance.Tags?.find(tag => tag.Key === 'Name');
            const environmentTag = instance.Tags?.find(tag => tag.Key === 'Environment');
            const managedByTag = instance.Tags?.find(tag => tag.Key === 'ManagedBy');

            const instanceTags: Record<string, string> = {};

            // Add all tags
            if (instance.Tags) {
              for (const tag of instance.Tags) {
                if (tag.Key && tag.Value) {
                  instanceTags[tag.Key] = tag.Value;
                }
              }
            }

            const formattedInstance = {
              id: instance.InstanceId || 'unknown',
              name: nameTag?.Value || instance.InstanceId || 'unnamed',
              type: instance.InstanceType || 'unknown',
              state: instance.State?.Name || 'unknown',
              publicIp: instance.PublicIpAddress || '',
              privateIp: instance.PrivateIpAddress || '',
              availabilityZone: instance.Placement?.AvailabilityZone || '',
              environment: environmentTag?.Value || 'untagged',
              launchTime: instance.LaunchTime?.toISOString() || '',
              managedBy: managedByTag?.Value || 'manual',
              tags: instanceTags
            };

            instances.push(formattedInstance);
          }
        }
      }
    }

    console.log(`✅ Found ${instances.length} EC2 instances`);
    res.json(instances);

  } catch (error) {
    console.error('❌ Error fetching EC2 instances:', error);

    // If AWS credentials are not configured, return helpful message
    if (error instanceof Error && error.message.includes('credentials')) {
      res.status(500).json({
        error: 'AWS credentials not configured. Please configure AWS credentials to view real EC2 instances.',
        instances: [],
        message: 'Configure AWS credentials using AWS CLI: aws configure'
      });
    } else {
      res.status(500).json({
        error: 'Failed to fetch EC2 instances',
        instances: [],
        details: error instanceof Error ? error.message : 'Unknown error'
      });
    }
  }
});

// Instance control endpoints
app.post('/api/instances/:id/start', async (req, res) => {
  try {
    const { id } = req.params;
    console.log(`🚀 Starting EC2 instance: ${id}`);

    const command = new StartInstancesCommand({
      InstanceIds: [id]
    });

    const response = await ec2Client.send(command);

    if (response.StartingInstances && response.StartingInstances.length > 0) {
      const instance = response.StartingInstances[0];
      res.json({
        success: true,
        message: `Instance ${id} start initiated`,
        instance: {
          id: instance.InstanceId,
          currentState: instance.CurrentState?.Name,
          previousState: instance.PreviousState?.Name
        }
      });
    } else {
      res.status(400).json({ error: 'Failed to start instance' });
    }

  } catch (error) {
    console.error('❌ Error starting instance:', error);
    res.status(500).json({
      error: 'Failed to start instance',
      details: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

app.post('/api/instances/:id/stop', async (req, res) => {
  try {
    const { id } = req.params;
    console.log(`🛑 Stopping EC2 instance: ${id}`);

    const command = new StopInstancesCommand({
      InstanceIds: [id]
    });

    const response = await ec2Client.send(command);

    if (response.StoppingInstances && response.StoppingInstances.length > 0) {
      const instance = response.StoppingInstances[0];
      res.json({
        success: true,
        message: `Instance ${id} stop initiated`,
        instance: {
          id: instance.InstanceId,
          currentState: instance.CurrentState?.Name,
          previousState: instance.PreviousState?.Name
        }
      });
    } else {
      res.status(400).json({ error: 'Failed to stop instance' });
    }

  } catch (error) {
    console.error('❌ Error stopping instance:', error);
    res.status(500).json({
      error: 'Failed to stop instance',
      details: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

app.post('/api/instances/:id/restart', async (req, res) => {
  try {
    const { id } = req.params;
    console.log(`🔄 Restarting EC2 instance: ${id}`);

    const command = new RebootInstancesCommand({
      InstanceIds: [id]
    });

    await ec2Client.send(command);

    res.json({
      success: true,
      message: `Instance ${id} restart initiated`,
      instance: {
        id: id,
        action: 'reboot'
      }
    });

  } catch (error) {
    console.error('❌ Error restarting instance:', error);
    res.status(500).json({
      error: 'Failed to restart instance',
      details: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

// Instance details endpoint
app.get('/api/instances/:id/details', async (req, res) => {
  try {
    const { id } = req.params;
    console.log(`🔍 Fetching details for EC2 instance: ${id}`);

    const command = new DescribeInstancesCommand({
      InstanceIds: [id]
    });

    const response = await ec2Client.send(command);

    if (response.Reservations && response.Reservations.length > 0) {
      const instance = response.Reservations[0].Instances?.[0];

      if (instance) {
        const instanceTags: Record<string, string> = {};
        if (instance.Tags) {
          for (const tag of instance.Tags) {
            if (tag.Key && tag.Value) {
              instanceTags[tag.Key] = tag.Value;
            }
          }
        }

        const detailedInstance = {
          id: instance.InstanceId,
          name: instanceTags.Name || instance.InstanceId || 'unnamed',
          type: instance.InstanceType,
          state: instance.State?.Name,
          publicIp: instance.PublicIpAddress || '',
          privateIp: instance.PrivateIpAddress || '',
          availabilityZone: instance.Placement?.AvailabilityZone || '',
          vpcId: instance.VpcId || '',
          subnetId: instance.SubnetId || '',
          securityGroups: instance.SecurityGroups?.map(sg => ({
            id: sg.GroupId,
            name: sg.GroupName
          })) || [],
          keyName: instance.KeyName || '',
          launchTime: instance.LaunchTime?.toISOString() || '',
          architecture: instance.Architecture || '',
          platform: instance.Platform || 'linux',
          monitoring: instance.Monitoring?.State || 'disabled',
          tags: instanceTags
        };

        res.json(detailedInstance);
      } else {
        res.status(404).json({ error: 'Instance not found' });
      }
    } else {
      res.status(404).json({ error: 'Instance not found' });
    }

  } catch (error) {
    console.error('❌ Error fetching instance details:', error);
    res.status(500).json({
      error: 'Failed to fetch instance details',
      details: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

// GitHub tokens endpoints
app.get('/api/github/tokens', async (req, res) => {
  try {
    const authHeader = req.headers.authorization;
    const token = authHeader && authHeader.split(' ')[1];

    if (!token) {
      return res.status(401).json({ error: 'Access token required' });
    }

    const decoded = jwt.verify(token, 'default-secret') as any;
    const userId = decoded.userId;

    const tokens = await db.all(`
      SELECT id, token_name, token_metadata, expires_at, last_used, is_active, created_at
      FROM user_tokens
      WHERE user_id = ? AND token_type = 'github' AND is_active = 1
      ORDER BY created_at DESC
    `, [userId]);

    const formattedTokens = tokens.map(token => {
      const metadata = JSON.parse(token.token_metadata || '{}');
      return {
        id: token.id,
        token_name: token.token_name,
        metadata: metadata,
        expires_at: token.expires_at,
        last_used: token.last_used,
        is_active: token.is_active,
        created_at: token.created_at
      };
    });

    res.json(formattedTokens);
  } catch (error) {
    console.error('Error fetching GitHub tokens:', error);
    res.status(500).json({ error: 'Failed to fetch GitHub tokens' });
  }
});

app.post('/api/github/tokens', async (req, res) => {
  try {
    const authHeader = req.headers.authorization;
    const token = authHeader && authHeader.split(' ')[1];

    if (!token) {
      return res.status(401).json({ error: 'Access token required' });
    }

    const decoded = jwt.verify(token, 'default-secret') as any;
    const userId = decoded.userId;

    const { name, token: githubToken, description, skipValidation } = req.body;

    if (!name || !githubToken) {
      return res.status(400).json({ error: 'Name and token are required' });
    }

    // Skip validation if requested (for testing purposes)
    if (skipValidation) {
      console.log('⚠️ Skipping GitHub token validation (testing mode)');

      const tokenId = `token-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;

      const metadata = {
        description: description || '',
        github_user: {
          login: 'test-user',
          name: 'Test User',
          avatar_url: 'https://github.com/identicons/test.png',
          id: 'test-id'
        },
        scopes: ['repo', 'user'],
        validated_at: new Date().toISOString(),
        validation_skipped: true
      };

      await db.run(`
        INSERT INTO user_tokens (
          id, user_id, token_type, token_name, encrypted_token, token_metadata, is_active
        ) VALUES (?, ?, ?, ?, ?, ?, ?)
      `, [
        tokenId,
        userId,
        'github',
        name,
        githubToken,
        JSON.stringify(metadata),
        1
      ]);

      return res.status(201).json({
        success: true,
        message: 'GitHub token added (validation skipped)',
        tokenId,
        user: {
          login: 'test-user',
          name: 'Test User',
          avatar_url: 'https://github.com/identicons/test.png'
        }
      });
    }

    // Validate GitHub token by making a request to GitHub API
    console.log('🔍 Validating GitHub token...');
    try {
      const githubResponse = await fetch('https://api.github.com/user', {
        headers: {
          'Authorization': `token ${githubToken}`,
          'User-Agent': 'Terraform-Dashboard'
        }
      });

      if (!githubResponse.ok) {
        console.log('❌ GitHub token validation failed:', githubResponse.status, githubResponse.statusText);

        let errorMessage = 'Invalid GitHub token. ';

        switch (githubResponse.status) {
          case 401:
            errorMessage += 'The token is invalid or expired. Please create a new Personal Access Token from GitHub Settings > Developer settings > Personal access tokens.';
            break;
          case 403:
            errorMessage += 'The token has insufficient permissions or rate limit exceeded. Please check your token scopes.';
            break;
          case 404:
            errorMessage += 'GitHub API endpoint not found. Please check your network connection.';
            break;
          default:
            errorMessage += `GitHub API returned status ${githubResponse.status}. Please try again.`;
        }

        return res.status(400).json({
          error: errorMessage,
          details: {
            status: githubResponse.status,
            statusText: githubResponse.statusText
          }
        });
      }

      const githubUser = await githubResponse.json() as any;
      console.log('✅ GitHub token validated for user:', githubUser.login);

      // Get token scopes from headers
      const scopes = githubResponse.headers.get('x-oauth-scopes')?.split(', ') || [];

      // In a real implementation, you would encrypt the token
      const tokenId = `token-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;

      const metadata = {
        description: description || '',
        github_user: {
          login: githubUser.login,
          name: githubUser.name,
          avatar_url: githubUser.avatar_url,
          id: githubUser.id
        },
        scopes: scopes,
        validated_at: new Date().toISOString()
      };

      await db.run(`
        INSERT INTO user_tokens (
          id, user_id, token_type, token_name, encrypted_token, token_metadata, is_active
        ) VALUES (?, ?, ?, ?, ?, ?, ?)
      `, [
        tokenId,
        userId,
        'github',
        name,
        githubToken, // In production, this should be encrypted
        JSON.stringify(metadata),
        1
      ]);

      res.status(201).json({
        success: true,
        message: 'GitHub token added and validated successfully',
        tokenId,
        user: {
          login: githubUser.login,
          name: githubUser.name,
          avatar_url: githubUser.avatar_url
        }
      });

    } catch (validationError) {
      console.error('❌ GitHub token validation error:', validationError);
      return res.status(400).json({
        error: 'Failed to validate GitHub token. Please check your token and try again.'
      });
    }

  } catch (error) {
    console.error('Error adding GitHub token:', error);
    res.status(500).json({ error: 'Failed to add GitHub token' });
  }
});

// Delete GitHub token
app.delete('/api/github/tokens/:id', async (req, res) => {
  try {
    const authHeader = req.headers.authorization;
    const token = authHeader && authHeader.split(' ')[1];

    if (!token) {
      return res.status(401).json({ error: 'Access token required' });
    }

    const decoded = jwt.verify(token, 'default-secret') as any;
    const userId = decoded.userId;
    const { id } = req.params;

    // Check if token exists and belongs to user
    const existingToken = await db.get(`
      SELECT * FROM user_tokens
      WHERE id = ? AND user_id = ? AND token_type = 'github'
    `, [id, userId]);

    if (!existingToken) {
      return res.status(404).json({ error: 'GitHub token not found' });
    }

    // Delete the token
    await db.run('DELETE FROM user_tokens WHERE id = ? AND user_id = ?', [id, userId]);

    res.json({
      success: true,
      message: 'GitHub token deleted successfully'
    });

  } catch (error) {
    console.error('Error deleting GitHub token:', error);
    res.status(500).json({ error: 'Failed to delete GitHub token' });
  }
});

// Test GitHub token
app.post('/api/github/tokens/:id/test', async (req, res) => {
  try {
    const authHeader = req.headers.authorization;
    const token = authHeader && authHeader.split(' ')[1];

    if (!token) {
      return res.status(401).json({ error: 'Access token required' });
    }

    const decoded = jwt.verify(token, 'default-secret') as any;
    const userId = decoded.userId;
    const { id } = req.params;

    // Get the token
    const tokenRecord = await db.get(`
      SELECT * FROM user_tokens
      WHERE id = ? AND user_id = ? AND token_type = 'github'
    `, [id, userId]);

    if (!tokenRecord) {
      return res.status(404).json({ error: 'GitHub token not found' });
    }

    // Test the token by making a request to GitHub API
    try {
      const githubResponse = await fetch('https://api.github.com/user', {
        headers: {
          'Authorization': `token ${tokenRecord.encrypted_token}`,
          'User-Agent': 'Terraform-Dashboard'
        }
      });

      if (githubResponse.ok) {
        const userData = await githubResponse.json() as any;

        // Update last used timestamp
        await db.run(`
          UPDATE user_tokens
          SET last_used = datetime('now')
          WHERE id = ?
        `, [id]);

        res.json({
          valid: true,
          user: {
            login: userData.login,
            name: userData.name,
            avatar_url: userData.avatar_url
          },
          message: 'Token is valid and working'
        });
      } else {
        res.json({
          valid: false,
          error: 'Token is invalid or expired'
        });
      }
    } catch (testError) {
      res.json({
        valid: false,
        error: 'Failed to test token'
      });
    }

  } catch (error) {
    console.error('Error testing GitHub token:', error);
    res.status(500).json({ error: 'Failed to test GitHub token' });
  }
});

// Instance scheduling endpoints
app.get('/api/instances/:id/schedule', async (req, res) => {
  try {
    const { id } = req.params;
    console.log(`📅 Fetching scheduled actions for instance: ${id}`);

    // Get scheduled actions from database
    const scheduledActions = await db.all(`
      SELECT * FROM scheduled_actions
      WHERE instance_id = ? AND is_active = 1
      ORDER BY scheduled_time ASC
    `, [id]);

    const formattedActions = scheduledActions.map(action => ({
      id: action.id,
      action: action.action,
      scheduledTime: action.scheduled_time,
      recurring: action.recurring === 1,
      enabled: action.is_active === 1,
      created_at: action.created_at
    }));

    console.log(`✅ Found ${formattedActions.length} scheduled actions for instance ${id}`);
    res.json(formattedActions);

  } catch (error) {
    console.error('❌ Error fetching scheduled actions:', error);
    res.status(500).json({
      error: 'Failed to fetch scheduled actions',
      details: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

app.post('/api/instances/:id/schedule', async (req, res) => {
  try {
    const { id } = req.params;
    const { action, scheduledTime, recurring } = req.body;

    if (!action || !scheduledTime) {
      return res.status(400).json({ error: 'Action and scheduled time are required' });
    }

    if (!['start', 'stop'].includes(action)) {
      return res.status(400).json({ error: 'Action must be either "start" or "stop"' });
    }

    console.log(`📅 Creating scheduled action for instance ${id}: ${action} at ${scheduledTime}`);

    // Verify instance exists
    const command = new DescribeInstancesCommand({
      InstanceIds: [id]
    });

    try {
      await ec2Client.send(command);
    } catch (awsError) {
      return res.status(404).json({ error: 'Instance not found' });
    }

    // Create scheduled action ID
    const scheduleId = `schedule-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;

    // Save to database
    await db.run(`
      INSERT INTO scheduled_actions (
        id, instance_id, action, scheduled_time, recurring, is_active, created_at, updated_at
      ) VALUES (?, ?, ?, ?, ?, ?, datetime('now'), datetime('now'))
    `, [
      scheduleId,
      id,
      action,
      scheduledTime,
      recurring ? 1 : 0,
      1
    ]);

    console.log(`✅ Scheduled action created: ${scheduleId}`);

    res.json({
      success: true,
      scheduleId: scheduleId,
      message: `Successfully scheduled ${action} for instance ${id}`,
      scheduledAction: {
        id: scheduleId,
        action: action,
        scheduledTime: scheduledTime,
        recurring: recurring,
        enabled: true
      }
    });

  } catch (error) {
    console.error('❌ Error creating scheduled action:', error);
    res.status(500).json({
      error: 'Failed to create scheduled action',
      details: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

app.delete('/api/instances/:id/schedule/:scheduleId', async (req, res) => {
  try {
    const { id, scheduleId } = req.params;
    console.log(`🗑️ Deleting scheduled action: ${scheduleId} for instance: ${id}`);

    // Check if scheduled action exists
    const existingAction = await db.get(`
      SELECT * FROM scheduled_actions
      WHERE id = ? AND instance_id = ?
    `, [scheduleId, id]);

    if (!existingAction) {
      return res.status(404).json({ error: 'Scheduled action not found' });
    }

    // Delete the scheduled action
    await db.run(`
      DELETE FROM scheduled_actions
      WHERE id = ? AND instance_id = ?
    `, [scheduleId, id]);

    console.log(`✅ Scheduled action deleted: ${scheduleId}`);

    res.json({
      success: true,
      message: 'Scheduled action deleted successfully'
    });

  } catch (error) {
    console.error('❌ Error deleting scheduled action:', error);
    res.status(500).json({
      error: 'Failed to delete scheduled action',
      details: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

// GitHub Import endpoints
app.post('/api/github/validate-token', async (req, res) => {
  try {
    const { token } = req.body;

    if (!token) {
      return res.status(400).json({ error: 'Token is required' });
    }

    console.log('🔍 Validating GitHub token for import...');

    // Test the token by making a request to GitHub API
    const githubResponse = await fetch('https://api.github.com/user', {
      headers: {
        'Authorization': `token ${token}`,
        'User-Agent': 'Terraform-Dashboard'
      }
    });

    if (!githubResponse.ok) {
      console.log('❌ GitHub token validation failed:', githubResponse.status);
      return res.status(400).json({
        valid: false,
        error: 'Invalid GitHub token. Please check your token and try again.'
      });
    }

    const userData = await githubResponse.json() as any;
    console.log('✅ GitHub token validated for user:', userData.login);

    res.json({
      valid: true,
      user: {
        login: userData.login,
        name: userData.name,
        avatar_url: userData.avatar_url,
        id: userData.id
      }
    });

  } catch (error) {
    console.error('❌ GitHub token validation error:', error);
    res.status(500).json({
      valid: false,
      error: 'Failed to validate GitHub token'
    });
  }
});

app.get('/api/github/search', async (req, res) => {
  try {
    const { q, limit = 20, token } = req.query;

    if (!token) {
      return res.status(400).json({ error: 'GitHub token is required' });
    }

    if (!q) {
      return res.status(400).json({ error: 'Search query is required' });
    }

    console.log('🔍 Searching GitHub repositories:', q);

    const searchUrl = `https://api.github.com/search/repositories?q=${encodeURIComponent(q as string)}&sort=stars&order=desc&per_page=${limit}`;

    const githubResponse = await fetch(searchUrl, {
      headers: {
        'Authorization': `token ${token}`,
        'User-Agent': 'Terraform-Dashboard',
        'Accept': 'application/vnd.github.v3+json'
      }
    });

    if (!githubResponse.ok) {
      console.log('❌ GitHub search failed:', githubResponse.status);
      return res.status(githubResponse.status).json({
        error: 'Failed to search GitHub repositories'
      });
    }

    const searchData = await githubResponse.json() as any;
    console.log(`✅ Found ${searchData.total_count} repositories`);

    res.json({
      total_count: searchData.total_count,
      items: searchData.items.map((repo: any) => ({
        id: repo.id,
        name: repo.name,
        full_name: repo.full_name,
        description: repo.description,
        html_url: repo.html_url,
        clone_url: repo.clone_url,
        stargazers_count: repo.stargazers_count,
        language: repo.language,
        updated_at: repo.updated_at,
        owner: {
          login: repo.owner.login,
          avatar_url: repo.owner.avatar_url
        }
      }))
    });

  } catch (error) {
    console.error('❌ GitHub search error:', error);
    res.status(500).json({ error: 'Failed to search repositories' });
  }
});

// Get user's own repositories (including private ones)
app.get('/api/github/user/repos', async (req, res) => {
  try {
    const { token, type = 'all', sort = 'updated', per_page = 50, page = 1 } = req.query;

    if (!token) {
      return res.status(400).json({ error: 'GitHub token is required' });
    }

    console.log('🔍 Fetching user repositories...');

    // Fetch user's repositories (includes private repos if token has access)
    const reposUrl = `https://api.github.com/user/repos?type=${type}&sort=${sort}&per_page=${per_page}&page=${page}`;

    const githubResponse = await fetch(reposUrl, {
      headers: {
        'Authorization': `token ${token}`,
        'User-Agent': 'Terraform-Dashboard',
        'Accept': 'application/vnd.github.v3+json'
      }
    });

    if (!githubResponse.ok) {
      console.log('❌ GitHub user repos failed:', githubResponse.status);
      return res.status(githubResponse.status).json({
        error: 'Failed to fetch user repositories'
      });
    }

    const repositories: any[] = await githubResponse.json();

    console.log(`✅ Found ${repositories.length} user repositories`);

    res.json({
      repositories: repositories.map((repo: any) => ({
        id: repo.id,
        name: repo.name,
        full_name: repo.full_name,
        description: repo.description,
        private: repo.private,
        html_url: repo.html_url,
        clone_url: repo.clone_url,
        ssh_url: repo.ssh_url,
        language: repo.language,
        stargazers_count: repo.stargazers_count,
        forks_count: repo.forks_count,
        updated_at: repo.updated_at,
        created_at: repo.created_at,
        owner: {
          login: repo.owner.login,
          avatar_url: repo.owner.avatar_url
        }
      })),
      total_count: repositories.length
    });

  } catch (error) {
    console.error('❌ GitHub user repos error:', error);
    res.status(500).json({ error: 'Failed to fetch user repositories' });
  }
});

// Get repositories from a specific organization (including private ones if user has access)
app.get('/api/github/orgs/:org/repos', async (req, res) => {
  try {
    const { org } = req.params;
    const { token, type = 'all', sort = 'updated', per_page = 50, page = 1 } = req.query;

    if (!token) {
      return res.status(400).json({ error: 'GitHub token is required' });
    }

    console.log(`🔍 Fetching repositories for organization: ${org}`);

    // Fetch organization repositories
    const reposUrl = `https://api.github.com/orgs/${org}/repos?type=${type}&sort=${sort}&per_page=${per_page}&page=${page}`;

    const githubResponse = await fetch(reposUrl, {
      headers: {
        'Authorization': `token ${token}`,
        'User-Agent': 'Terraform-Dashboard',
        'Accept': 'application/vnd.github.v3+json'
      }
    });

    if (!githubResponse.ok) {
      console.log('❌ GitHub org repos failed:', githubResponse.status);
      return res.status(githubResponse.status).json({
        error: `Failed to fetch repositories for organization ${org}`
      });
    }

    const repositories: any[] = await githubResponse.json();

    console.log(`✅ Found ${repositories.length} repositories for organization ${org}`);

    res.json({
      repositories: repositories.map((repo: any) => ({
        id: repo.id,
        name: repo.name,
        full_name: repo.full_name,
        description: repo.description,
        private: repo.private,
        html_url: repo.html_url,
        clone_url: repo.clone_url,
        ssh_url: repo.ssh_url,
        language: repo.language,
        stargazers_count: repo.stargazers_count,
        forks_count: repo.forks_count,
        updated_at: repo.updated_at,
        created_at: repo.created_at,
        owner: {
          login: repo.owner.login,
          avatar_url: repo.owner.avatar_url
        }
      })),
      total_count: repositories.length
    });

  } catch (error) {
    console.error('❌ GitHub org repos error:', error);
    res.status(500).json({ error: 'Failed to fetch organization repositories' });
  }
});

app.post('/api/github/repos/:owner/:repo/analyze', async (req, res) => {
  try {
    const { owner, repo } = req.params;
    const { token } = req.body;

    if (!token) {
      return res.status(400).json({ error: 'GitHub token is required' });
    }

    console.log(`🔍 Analyzing repository: ${owner}/${repo}`);

    // Get repository contents
    const contentsUrl = `https://api.github.com/repos/${owner}/${repo}/contents`;
    const githubResponse = await fetch(contentsUrl, {
      headers: {
        'Authorization': `token ${token}`,
        'User-Agent': 'Terraform-Dashboard',
        'Accept': 'application/vnd.github.v3+json'
      }
    });

    if (!githubResponse.ok) {
      console.log('❌ Failed to fetch repository contents:', githubResponse.status);
      return res.status(githubResponse.status).json({
        error: 'Failed to fetch repository contents'
      });
    }

    const contents = await githubResponse.json() as any[];

    // Look for Terraform files
    const terraformFiles = contents.filter((file: any) =>
      file.type === 'file' && (
        file.name.endsWith('.tf') ||
        file.name.endsWith('.tfvars')
      )
    );

    // Look for Ansible files
    const ansibleFiles = contents.filter((file: any) =>
      file.type === 'file' && (
        file.name.endsWith('.yml') ||
        file.name.endsWith('.yaml') ||
        file.name.endsWith('.ansible') ||
        file.name === 'ansible.cfg' ||
        file.name === 'inventory' ||
        file.name === 'hosts'
      )
    );

    const hasTerraform = terraformFiles.length > 0;
    const hasAnsible = ansibleFiles.length > 0;

    // If neither Terraform nor Ansible files are found
    if (!hasTerraform && !hasAnsible) {
      return res.json({
        hasTerraform: false,
        hasAnsible: false,
        message: 'No Terraform (.tf) or Ansible (.yml/.yaml) files found in the root directory of this repository.',
        suggestedName: '',
        mainFiles: []
      });
    }

    // If only Ansible files are found
    if (!hasTerraform && hasAnsible) {
      // Find main Ansible files
      const mainAnsibleFiles = ansibleFiles.filter((file: any) =>
        file.name === 'playbook.yml' ||
        file.name === 'playbook.yaml' ||
        file.name === 'site.yml' ||
        file.name === 'site.yaml' ||
        file.name === 'main.yml' ||
        file.name === 'main.yaml'
      ).map((file: any) => file.name);

      // If no main files found, use all YAML files
      const allAnsibleFiles = ansibleFiles.map((file: any) => file.name);

      return res.json({
        hasTerraform: false,
        hasAnsible: true,
        message: 'Ansible files found in this repository.',
        suggestedName: `${repo}-ansible`,
        mainFiles: mainAnsibleFiles.length > 0 ? mainAnsibleFiles : allAnsibleFiles,
        fileType: 'ansible'
      });
    }

    // Find main Terraform files (main.tf, variables.tf, outputs.tf)
    const mainFiles = terraformFiles
      .map((file: any) => file.name)
      .filter((name: string) =>
        name === 'main.tf' ||
        name === 'variables.tf' ||
        name === 'outputs.tf' ||
        name.includes('main')
      );

    // Generate suggested template name
    const suggestedName = repo.toLowerCase()
      .replace(/[^a-z0-9-]/g, '-')
      .replace(/-+/g, '-')
      .replace(/^-|-$/g, '');

    // Check if there are also Ansible files
    const hasAnsibleToo = hasAnsible;

    console.log(`✅ Repository analysis complete: ${terraformFiles.length} Terraform files, ${ansibleFiles.length} Ansible files found`);

    res.json({
      hasTerraform: true,
      hasAnsible: hasAnsibleToo,
      terraformFiles: terraformFiles.map((file: any) => file.name),
      ansibleFiles: ansibleFiles.map((file: any) => file.name),
      mainFiles: mainFiles.length > 0 ? mainFiles : ['main.tf'],
      suggestedName: suggestedName,
      message: `Found ${terraformFiles.length} Terraform files${hasAnsibleToo ? ` and ${ansibleFiles.length} Ansible files` : ''} in the repository.`,
      fileType: 'terraform'
    });

  } catch (error) {
    console.error('❌ Repository analysis error:', error);
    res.status(500).json({
      hasTerraform: false,
      error: 'Failed to analyze repository'
    });
  }
});

app.post('/api/github/repos/:owner/:repo/create-template', async (req, res) => {
  try {
    const { owner, repo } = req.params;
    const { token, templateName, description, mainFile } = req.body;

    if (!token) {
      return res.status(400).json({ error: 'GitHub token is required' });
    }

    if (!templateName) {
      return res.status(400).json({ error: 'Template name is required' });
    }

    console.log(`🔧 Creating template from repository: ${owner}/${repo}`);

    // Get the main Terraform file content
    const fileUrl = `https://api.github.com/repos/${owner}/${repo}/contents/${mainFile || 'main.tf'}`;
    const githubResponse = await fetch(fileUrl, {
      headers: {
        'Authorization': `token ${token}`,
        'User-Agent': 'Terraform-Dashboard',
        'Accept': 'application/vnd.github.v3+json'
      }
    });

    if (!githubResponse.ok) {
      console.log('❌ Failed to fetch Terraform file:', githubResponse.status);
      return res.status(githubResponse.status).json({
        error: `Failed to fetch ${mainFile || 'main.tf'} from repository`
      });
    }

    const fileData = await githubResponse.json() as any;

    // Decode base64 content
    const terraformContent = Buffer.from(fileData.content, 'base64').toString('utf-8');

    // Create template ID
    const templateId = `github-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;

    // Save template to database
    await db.run(`
      INSERT INTO templates (
        id, name, description, terraform_code, variables, category, created_at, updated_at
      ) VALUES (?, ?, ?, ?, ?, ?, datetime('now'), datetime('now'))
    `, [
      templateId,
      templateName,
      description || `Template imported from ${owner}/${repo}`,
      terraformContent,
      JSON.stringify({}), // We'll extract variables in a future enhancement
      'imported',
    ]);

    console.log(`✅ Template created successfully: ${templateName}`);

    res.json({
      success: true,
      templateId: templateId,
      templateName: templateName,
      message: 'Template created successfully from GitHub repository'
    });

  } catch (error) {
    console.error('❌ Template creation error:', error);
    res.status(500).json({
      error: 'Failed to create template from repository'
    });
  }
});

// Create Ansible template from GitHub repository
app.post('/api/github/repos/:owner/:repo/create-ansible-template', async (req, res) => {
  try {
    const { owner, repo } = req.params;
    const { token, templateName, description, mainFile } = req.body;

    if (!token) {
      return res.status(400).json({ error: 'GitHub token is required' });
    }

    if (!templateName) {
      return res.status(400).json({ error: 'Template name is required' });
    }

    console.log(`🔍 Creating Ansible template from ${owner}/${repo}`);

    // Get the main Ansible file content
    const fileUrl = `https://api.github.com/repos/${owner}/${repo}/contents/${mainFile}`;
    const githubResponse = await fetch(fileUrl, {
      headers: {
        'Authorization': `token ${token}`,
        'User-Agent': 'Terraform-Dashboard',
        'Accept': 'application/vnd.github.v3+json'
      }
    });

    if (!githubResponse.ok) {
      console.log('❌ Failed to fetch Ansible file:', githubResponse.status);
      return res.status(githubResponse.status).json({
        error: `Failed to fetch ${mainFile} from repository`
      });
    }

    const fileData = await githubResponse.json() as any;

    // Decode base64 content
    const ansibleContent = Buffer.from(fileData.content, 'base64').toString('utf-8');

    // Create template ID
    const templateId = `ansible-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;

    // Save template to database
    await db.run(`
      INSERT INTO templates (
        id, name, description, terraform_code, variables, category, template_type, created_at, updated_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, datetime('now'), datetime('now'))
    `, [
      templateId,
      templateName,
      description || `Ansible template imported from ${owner}/${repo}`,
      ansibleContent,
      JSON.stringify({}),
      'ansible',
      'ansible',
    ]);

    console.log(`✅ Ansible template created successfully: ${templateName}`);

    res.json({
      success: true,
      templateId: templateId,
      templateName: templateName,
      message: 'Ansible template created successfully from GitHub repository',
      template: {
        id: templateId,
        name: templateName,
        description: description || `Ansible template imported from ${owner}/${repo}`,
        category: 'ansible',
        template_type: 'ansible'
      }
    });

  } catch (error) {
    console.error('❌ Ansible template creation error:', error);
    res.status(500).json({
      error: 'Failed to create Ansible template from repository'
    });
  }
});

// Test endpoint for GitHub integration demo
app.post('/api/github/test-integration', async (req, res) => {
  try {
    const { repoType } = req.body;

    console.log(`🧪 Testing GitHub integration for ${repoType} repository`);

    if (repoType === 'terraform') {
      // Simulate Terraform repository analysis
      const mockTerraformAnalysis = {
        hasTerraform: true,
        hasAnsible: false,
        terraformFiles: ['main.tf', 'variables.tf', 'outputs.tf'],
        ansibleFiles: [],
        mainFiles: ['main.tf'],
        suggestedName: 'aws-vpc-terraform',
        message: 'Found 3 Terraform files in the repository.',
        fileType: 'terraform'
      };

      // Create a mock Terraform template
      const templateId = `terraform-demo-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
      const terraformContent = `# AWS VPC Terraform Configuration
resource "aws_vpc" "main" {
  cidr_block           = var.vpc_cidr
  enable_dns_hostnames = true
  enable_dns_support   = true

  tags = {
    Name = var.vpc_name
  }
}

resource "aws_subnet" "public" {
  count             = length(var.public_subnet_cidrs)
  vpc_id            = aws_vpc.main.id
  cidr_block        = var.public_subnet_cidrs[count.index]
  availability_zone = data.aws_availability_zones.available.names[count.index]

  map_public_ip_on_launch = true

  tags = {
    Name = "\${var.vpc_name}-public-\${count.index + 1}"
  }
}

resource "aws_internet_gateway" "main" {
  vpc_id = aws_vpc.main.id

  tags = {
    Name = "\${var.vpc_name}-igw"
  }
}`;

      await db.run(`
        INSERT INTO templates (
          id, name, description, terraform_code, variables, category, template_type, created_at, updated_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, datetime('now'), datetime('now'))
      `, [
        templateId,
        'AWS VPC Demo Template',
        'Demo Terraform template imported from GitHub repository',
        terraformContent,
        JSON.stringify({
          vpc_cidr: { type: 'string', default: '10.0.0.0/16' },
          vpc_name: { type: 'string', default: 'demo-vpc' },
          public_subnet_cidrs: { type: 'list', default: ['10.0.1.0/24', '10.0.2.0/24'] }
        }),
        'imported',
        'terraform'
      ]);

      res.json({
        success: true,
        analysis: mockTerraformAnalysis,
        template: {
          id: templateId,
          name: 'AWS VPC Demo Template',
          type: 'terraform'
        }
      });

    } else if (repoType === 'ansible') {
      // Simulate Ansible repository analysis
      const mockAnsibleAnalysis = {
        hasTerraform: false,
        hasAnsible: true,
        terraformFiles: [],
        ansibleFiles: ['playbook.yml', 'inventory', 'group_vars/all.yml'],
        mainFiles: ['playbook.yml'],
        suggestedName: 'web-server-ansible',
        message: 'Found 3 Ansible files in the repository.',
        fileType: 'ansible'
      };

      // Create a mock Ansible template
      const templateId = `ansible-demo-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
      const ansibleContent = `---
- name: Web Server Setup
  hosts: webservers
  become: yes
  vars:
    nginx_port: 80
    app_name: demo-app

  tasks:
    - name: Update package cache
      apt:
        update_cache: yes

    - name: Install Nginx
      apt:
        name: nginx
        state: present

    - name: Install Python3 and pip
      apt:
        name:
          - python3
          - python3-pip
        state: present

    - name: Create application directory
      file:
        path: /var/www/{{ app_name }}
        state: directory
        owner: www-data
        group: www-data
        mode: '0755'

    - name: Configure Nginx
      template:
        src: nginx.conf.j2
        dest: /etc/nginx/sites-available/{{ app_name }}
      notify: restart nginx

    - name: Enable site
      file:
        src: /etc/nginx/sites-available/{{ app_name }}
        dest: /etc/nginx/sites-enabled/{{ app_name }}
        state: link
      notify: restart nginx

    - name: Start and enable Nginx
      service:
        name: nginx
        state: started
        enabled: yes

  handlers:
    - name: restart nginx
      service:
        name: nginx
        state: restarted`;

      await db.run(`
        INSERT INTO templates (
          id, name, description, terraform_code, variables, category, template_type, created_at, updated_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, datetime('now'), datetime('now'))
      `, [
        templateId,
        'Web Server Setup Playbook',
        'Demo Ansible playbook imported from GitHub repository',
        ansibleContent,
        JSON.stringify({}),
        'ansible',
        'ansible'
      ]);

      res.json({
        success: true,
        analysis: mockAnsibleAnalysis,
        template: {
          id: templateId,
          name: 'Web Server Setup Playbook',
          type: 'ansible'
        }
      });

    } else if (repoType === 'mixed') {
      // Simulate repository with both Terraform and Ansible files
      const mockMixedAnalysis = {
        hasTerraform: true,
        hasAnsible: true,
        terraformFiles: ['main.tf', 'variables.tf'],
        ansibleFiles: ['configure.yml', 'inventory'],
        mainFiles: ['main.tf', 'configure.yml'],
        suggestedName: 'infrastructure-mixed',
        message: 'Found 2 Terraform files and 2 Ansible files in the repository.',
        fileType: 'terraform' // Default to terraform when both are present
      };

      res.json({
        success: true,
        analysis: mockMixedAnalysis,
        canCreateBoth: true
      });
    }

  } catch (error) {
    console.error('❌ Test integration error:', error);
    res.status(500).json({
      error: 'Failed to test GitHub integration'
    });
  }
});

// VPC Resources endpoints
app.get('/api/vpc-resources', async (req, res) => {
  try {
    const authHeader = req.headers.authorization;
    const token = authHeader && authHeader.split(' ')[1];

    if (!token) {
      return res.status(401).json({ error: 'Unauthorized' });
    }

    try {
      jwt.verify(token, 'default-secret');
    } catch (err) {
      return res.status(403).json({ error: 'Invalid token' });
    }

    console.log('🔍 Fetching VPC resources...');

    // Fetch all VPCs
    const vpcsCommand = new DescribeVpcsCommand({});
    const vpcsResponse = await ec2Client.send(vpcsCommand);
    const vpcs = vpcsResponse.Vpcs || [];

    console.log(`✅ Found ${vpcs.length} VPCs`);

    // Prepare response data
    const vpcResources = await Promise.all(vpcs.map(async (vpc) => {
      const vpcId = vpc.VpcId!;
      const vpcName = vpc.Tags?.find(tag => tag.Key === 'Name')?.Value || vpcId;

      // Skip if vpcId is undefined
      if (!vpcId) {
        return null;
      }

      // Fetch subnets for this VPC
      const subnetsCommand = new DescribeSubnetsCommand({
        Filters: [{ Name: 'vpc-id', Values: [vpcId] }]
      });
      const subnetsResponse = await ec2Client.send(subnetsCommand);
      const subnets = subnetsResponse.Subnets || [];

      // Fetch route tables for this VPC
      const routeTablesCommand = new DescribeRouteTablesCommand({
        Filters: [{ Name: 'vpc-id', Values: [vpcId] }]
      });
      const routeTablesResponse = await ec2Client.send(routeTablesCommand);
      const routeTables = routeTablesResponse.RouteTables || [];

      // Fetch security groups for this VPC
      const securityGroupsCommand = new DescribeSecurityGroupsCommand({
        Filters: [{ Name: 'vpc-id', Values: [vpcId] }]
      });
      const securityGroupsResponse = await ec2Client.send(securityGroupsCommand);
      const securityGroups = securityGroupsResponse.SecurityGroups || [];

      // Fetch network ACLs for this VPC
      const networkAclsCommand = new DescribeNetworkAclsCommand({
        Filters: [{ Name: 'vpc-id', Values: [vpcId] }]
      });
      const networkAclsResponse = await ec2Client.send(networkAclsCommand);
      const networkAcls = networkAclsResponse.NetworkAcls || [];

      // Fetch internet gateways for this VPC
      const internetGatewaysCommand = new DescribeInternetGatewaysCommand({
        Filters: [{ Name: 'attachment.vpc-id', Values: [vpcId] }]
      });
      const internetGatewaysResponse = await ec2Client.send(internetGatewaysCommand);
      const internetGateways = internetGatewaysResponse.InternetGateways || [];

      // Fetch NAT gateways for this VPC
      const natGatewaysCommand = new DescribeNatGatewaysCommand({
        Filter: [{ Name: 'vpc-id', Values: [vpcId] }]
      });
      const natGatewaysResponse = await ec2Client.send(natGatewaysCommand);
      const natGateways = natGatewaysResponse.NatGateways || [];

      // Fetch VPC endpoints for this VPC
      const vpcEndpointsCommand = new DescribeVpcEndpointsCommand({
        Filters: [{ Name: 'vpc-id', Values: [vpcId] }]
      });
      const vpcEndpointsResponse = await ec2Client.send(vpcEndpointsCommand);
      const vpcEndpoints = vpcEndpointsResponse.VpcEndpoints || [];

      return {
        id: vpcId,
        name: vpcName,
        cidrBlock: vpc.CidrBlock,
        state: vpc.State,
        isDefault: vpc.IsDefault,
        tags: vpc.Tags,
        resources: {
          subnets: subnets.map(subnet => ({
            id: subnet.SubnetId,
            name: subnet.Tags?.find(tag => tag.Key === 'Name')?.Value || subnet.SubnetId,
            cidrBlock: subnet.CidrBlock,
            availabilityZone: subnet.AvailabilityZone,
            state: subnet.State,
            availableIpAddressCount: subnet.AvailableIpAddressCount,
            tags: subnet.Tags
          })),
          routeTables: routeTables.map(rt => ({
            id: rt.RouteTableId,
            name: rt.Tags?.find(tag => tag.Key === 'Name')?.Value || rt.RouteTableId,
            associations: rt.Associations?.map(assoc => ({
              id: assoc.RouteTableAssociationId,
              main: assoc.Main,
              subnetId: assoc.SubnetId
            })),
            routes: rt.Routes?.map(route => ({
              destinationCidr: route.DestinationCidrBlock,
              gatewayId: route.GatewayId,
              natGatewayId: route.NatGatewayId,
              state: route.State
            })),
            tags: rt.Tags
          })),
          securityGroups: securityGroups.map(sg => ({
            id: sg.GroupId,
            name: sg.GroupName,
            description: sg.Description,
            ingressRules: sg.IpPermissions?.map(perm => ({
              protocol: perm.IpProtocol,
              fromPort: perm.FromPort,
              toPort: perm.ToPort,
              ipRanges: perm.IpRanges?.map(range => range.CidrIp)
            })),
            egressRules: sg.IpPermissionsEgress?.map(perm => ({
              protocol: perm.IpProtocol,
              fromPort: perm.FromPort,
              toPort: perm.ToPort,
              ipRanges: perm.IpRanges?.map(range => range.CidrIp)
            })),
            tags: sg.Tags
          })),
          networkAcls: networkAcls.map(acl => ({
            id: acl.NetworkAclId,
            name: acl.Tags?.find(tag => tag.Key === 'Name')?.Value || acl.NetworkAclId,
            isDefault: acl.IsDefault,
            entries: acl.Entries?.map(entry => ({
              ruleNumber: entry.RuleNumber,
              protocol: entry.Protocol,
              egress: entry.Egress,
              cidrBlock: entry.CidrBlock,
              action: entry.RuleAction,
              portRange: entry.PortRange
            })),
            associations: acl.Associations?.map(assoc => ({
              id: assoc.NetworkAclAssociationId,
              subnetId: assoc.SubnetId
            })),
            tags: acl.Tags
          })),
          internetGateways: internetGateways.map(igw => ({
            id: igw.InternetGatewayId,
            name: igw.Tags?.find(tag => tag.Key === 'Name')?.Value || igw.InternetGatewayId,
            attachments: igw.Attachments?.map(att => ({
              state: att.State,
              vpcId: att.VpcId
            })),
            tags: igw.Tags
          })),
          natGateways: natGateways.map(nat => ({
            id: nat.NatGatewayId,
            name: nat.Tags?.find(tag => tag.Key === 'Name')?.Value || nat.NatGatewayId,
            state: nat.State,
            subnetId: nat.SubnetId,
            publicIp: nat.NatGatewayAddresses?.[0]?.PublicIp,
            privateIp: nat.NatGatewayAddresses?.[0]?.PrivateIp,
            tags: nat.Tags
          })),
          vpcEndpoints: vpcEndpoints.map(endpoint => ({
            id: endpoint.VpcEndpointId,
            name: endpoint.Tags?.find(tag => tag.Key === 'Name')?.Value || endpoint.VpcEndpointId,
            type: endpoint.VpcEndpointType,
            state: endpoint.State,
            serviceName: endpoint.ServiceName,
            tags: endpoint.Tags
          }))
        }
      };
    })).then(results => results.filter(vpc => vpc !== null));

    res.json(vpcResources);
  } catch (error) {
    console.error('❌ Error fetching VPC resources:', error);
    res.status(500).json({
      error: 'Failed to fetch VPC resources',
      details: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

// Get details for a specific VPC
app.get('/api/vpc-resources/:vpcId', async (req, res) => {
  try {
    const authHeader = req.headers.authorization;
    const token = authHeader && authHeader.split(' ')[1];
    const { vpcId } = req.params;

    if (!token) {
      return res.status(401).json({ error: 'Unauthorized' });
    }

    try {
      jwt.verify(token, 'default-secret');
    } catch (err) {
      return res.status(403).json({ error: 'Invalid token' });
    }

    console.log(`🔍 Fetching details for VPC: ${vpcId}`);

    // Fetch the specific VPC
    const vpcsCommand = new DescribeVpcsCommand({
      VpcIds: [vpcId]
    });

    try {
      const vpcsResponse = await ec2Client.send(vpcsCommand);
      const vpc = vpcsResponse.Vpcs?.[0];

      if (!vpc) {
        return res.status(404).json({ error: 'VPC not found' });
      }

      const vpcName = vpc.Tags?.find(tag => tag.Key === 'Name')?.Value || vpcId;

      // Fetch subnets for this VPC
      const subnetsCommand = new DescribeSubnetsCommand({
        Filters: [{ Name: 'vpc-id', Values: [vpcId] }]
      });
      const subnetsResponse = await ec2Client.send(subnetsCommand);
      const subnets = subnetsResponse.Subnets || [];

      // Fetch route tables for this VPC
      const routeTablesCommand = new DescribeRouteTablesCommand({
        Filters: [{ Name: 'vpc-id', Values: [vpcId] }]
      });
      const routeTablesResponse = await ec2Client.send(routeTablesCommand);
      const routeTables = routeTablesResponse.RouteTables || [];

      // Fetch security groups for this VPC
      const securityGroupsCommand = new DescribeSecurityGroupsCommand({
        Filters: [{ Name: 'vpc-id', Values: [vpcId] }]
      });
      const securityGroupsResponse = await ec2Client.send(securityGroupsCommand);
      const securityGroups = securityGroupsResponse.SecurityGroups || [];

      // Fetch network ACLs for this VPC
      const networkAclsCommand = new DescribeNetworkAclsCommand({
        Filters: [{ Name: 'vpc-id', Values: [vpcId] }]
      });
      const networkAclsResponse = await ec2Client.send(networkAclsCommand);
      const networkAcls = networkAclsResponse.NetworkAcls || [];

      // Fetch internet gateways for this VPC
      const internetGatewaysCommand = new DescribeInternetGatewaysCommand({
        Filters: [{ Name: 'attachment.vpc-id', Values: [vpcId] }]
      });
      const internetGatewaysResponse = await ec2Client.send(internetGatewaysCommand);
      const internetGateways = internetGatewaysResponse.InternetGateways || [];

      // Fetch NAT gateways for this VPC
      const natGatewaysCommand = new DescribeNatGatewaysCommand({
        Filter: [{ Name: 'vpc-id', Values: [vpcId] }]
      });
      const natGatewaysResponse = await ec2Client.send(natGatewaysCommand);
      const natGateways = natGatewaysResponse.NatGateways || [];

      // Fetch VPC endpoints for this VPC
      const vpcEndpointsCommand = new DescribeVpcEndpointsCommand({
        Filters: [{ Name: 'vpc-id', Values: [vpcId] }]
      });
      const vpcEndpointsResponse = await ec2Client.send(vpcEndpointsCommand);
      const vpcEndpoints = vpcEndpointsResponse.VpcEndpoints || [];

      const vpcDetails = {
        id: vpcId,
        name: vpcName,
        cidrBlock: vpc.CidrBlock,
        state: vpc.State,
        isDefault: vpc.IsDefault,
        tags: vpc.Tags,
        resources: {
          subnets: subnets.map(subnet => ({
            id: subnet.SubnetId,
            name: subnet.Tags?.find(tag => tag.Key === 'Name')?.Value || subnet.SubnetId,
            cidrBlock: subnet.CidrBlock,
            availabilityZone: subnet.AvailabilityZone,
            state: subnet.State,
            availableIpAddressCount: subnet.AvailableIpAddressCount,
            tags: subnet.Tags
          })),
          routeTables: routeTables.map(rt => ({
            id: rt.RouteTableId,
            name: rt.Tags?.find(tag => tag.Key === 'Name')?.Value || rt.RouteTableId,
            associations: rt.Associations?.map(assoc => ({
              id: assoc.RouteTableAssociationId,
              main: assoc.Main,
              subnetId: assoc.SubnetId
            })),
            routes: rt.Routes?.map(route => ({
              destinationCidr: route.DestinationCidrBlock,
              gatewayId: route.GatewayId,
              natGatewayId: route.NatGatewayId,
              state: route.State
            })),
            tags: rt.Tags
          })),
          securityGroups: securityGroups.map(sg => ({
            id: sg.GroupId,
            name: sg.GroupName,
            description: sg.Description,
            ingressRules: sg.IpPermissions?.map(perm => ({
              protocol: perm.IpProtocol,
              fromPort: perm.FromPort,
              toPort: perm.ToPort,
              ipRanges: perm.IpRanges?.map(range => range.CidrIp)
            })),
            egressRules: sg.IpPermissionsEgress?.map(perm => ({
              protocol: perm.IpProtocol,
              fromPort: perm.FromPort,
              toPort: perm.ToPort,
              ipRanges: perm.IpRanges?.map(range => range.CidrIp)
            })),
            tags: sg.Tags
          })),
          networkAcls: networkAcls.map(acl => ({
            id: acl.NetworkAclId,
            name: acl.Tags?.find(tag => tag.Key === 'Name')?.Value || acl.NetworkAclId,
            isDefault: acl.IsDefault,
            entries: acl.Entries?.map(entry => ({
              ruleNumber: entry.RuleNumber,
              protocol: entry.Protocol,
              egress: entry.Egress,
              cidrBlock: entry.CidrBlock,
              action: entry.RuleAction,
              portRange: entry.PortRange
            })),
            associations: acl.Associations?.map(assoc => ({
              id: assoc.NetworkAclAssociationId,
              subnetId: assoc.SubnetId
            })),
            tags: acl.Tags
          })),
          internetGateways: internetGateways.map(igw => ({
            id: igw.InternetGatewayId,
            name: igw.Tags?.find(tag => tag.Key === 'Name')?.Value || igw.InternetGatewayId,
            attachments: igw.Attachments?.map(att => ({
              state: att.State,
              vpcId: att.VpcId
            })),
            tags: igw.Tags
          })),
          natGateways: natGateways.map(nat => ({
            id: nat.NatGatewayId,
            name: nat.Tags?.find(tag => tag.Key === 'Name')?.Value || nat.NatGatewayId,
            state: nat.State,
            subnetId: nat.SubnetId,
            publicIp: nat.NatGatewayAddresses?.[0]?.PublicIp,
            privateIp: nat.NatGatewayAddresses?.[0]?.PrivateIp,
            tags: nat.Tags
          })),
          vpcEndpoints: vpcEndpoints.map(endpoint => ({
            id: endpoint.VpcEndpointId,
            name: endpoint.Tags?.find(tag => tag.Key === 'Name')?.Value || endpoint.VpcEndpointId,
            type: endpoint.VpcEndpointType,
            state: endpoint.State,
            serviceName: endpoint.ServiceName,
            tags: endpoint.Tags
          }))
        }
      };

      res.json(vpcDetails);
    } catch (awsError) {
      console.error('❌ AWS Error:', awsError);
      return res.status(404).json({ error: 'VPC not found or error fetching VPC details' });
    }
  } catch (error) {
    console.error('❌ Error fetching VPC details:', error);
    res.status(500).json({
      error: 'Failed to fetch VPC details',
      details: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

// Initialize database and start server
async function startServer() {
  try {
    await initializeSimpleDatabase();
    console.log('✅ Database initialized successfully');

    app.listen(PORT, '0.0.0.0', () => {
      console.log(`🚀 Terraform Dashboard API server running on port ${PORT}`);
      console.log(`📊 Dashboard URL: http://localhost:3006`);
      console.log(`🌐 Network URL: http://192.168.31.94:3006`);
      console.log(`🔐 Default admin credentials: admin / admin123`);
      console.log(`🔗 Login URL: http://192.168.31.94:3006/login`);
    });
  } catch (error) {
    console.error('❌ Failed to start server:', error);
    process.exit(1);
  }
}

// Terraform execution functions
async function executeTerraformCommand(command: string, workingDir: string): Promise<{ success: boolean; output: string; error?: string }> {
  return new Promise((resolve) => {
    const args = command.split(' ');
    const cmd = args.shift();

    if (!cmd) {
      resolve({ success: false, output: '', error: 'Invalid command' });
      return;
    }

    const process = spawn(cmd, args, {
      cwd: workingDir,
      stdio: ['pipe', 'pipe', 'pipe'],
      shell: true
    });

    let output = '';
    let errorOutput = '';

    process.stdout?.on('data', (data) => {
      output += data.toString();
    });

    process.stderr?.on('data', (data) => {
      errorOutput += data.toString();
    });

    process.on('close', (code) => {
      resolve({
        success: code === 0,
        output: output + errorOutput,
        error: code !== 0 ? errorOutput : undefined
      });
    });

    process.on('error', (error) => {
      resolve({
        success: false,
        output: '',
        error: error.message
      });
    });
  });
}

async function generateTerraformFiles(deployment: any, template: any): Promise<string> {
  const workspaceDir = path.join(__dirname, '..', 'terraform-workspaces', deployment.id);

  // Create workspace directory
  if (!fs.existsSync(workspaceDir)) {
    fs.mkdirSync(workspaceDir, { recursive: true });
  }

  // Parse variables if they're stored as JSON string
  let parsedVariables = deployment.variables;
  if (typeof parsedVariables === 'string') {
    try {
      parsedVariables = JSON.parse(parsedVariables);
    } catch (e) {
      console.error('Failed to parse deployment variables:', e);
      parsedVariables = {};
    }
  }

  // Generate main.tf based on template
  let terraformContent = '';

  switch (template.id) {
    case 'ec2-instance':
      terraformContent = generateEC2Template(parsedVariables);
      break;
    case 'eks-cluster':
      terraformContent = generateEKSTemplate(parsedVariables);
      break;
    case 'rds-database':
      terraformContent = generateRDSTemplate(parsedVariables);
      break;
    case 'vpc-network':
      terraformContent = generateVPCTemplate(parsedVariables);
      break;
    case 'lambda-function':
      terraformContent = generateLambdaTemplate(parsedVariables);
      break;
    case 's3-bucket':
      terraformContent = generateS3Template(parsedVariables);
      break;
    default:
      terraformContent = generateEC2Template(parsedVariables);
  }

  // Write main.tf
  const mainTfPath = path.join(workspaceDir, 'main.tf');
  fs.writeFileSync(mainTfPath, terraformContent);

  // Write terraform.tfvars
  const tfvarsPath = path.join(workspaceDir, 'terraform.tfvars');
  const tfvarsContent = Object.entries(parsedVariables)
    .map(([key, value]) => {
      if (typeof value === 'string') {
        return `${key} = "${value}"`;
      } else if (typeof value === 'number') {
        return `${key} = ${value}`;
      } else if (typeof value === 'boolean') {
        return `${key} = ${value}`;
      } else {
        return `${key} = "${String(value)}"`;
      }
    })
    .join('\n');
  fs.writeFileSync(tfvarsPath, tfvarsContent);

  return workspaceDir;
}

function generateEC2Template(variables: any): string {
  return `
terraform {
  required_providers {
    aws = {
      source  = "hashicorp/aws"
      version = "~> 5.0"
    }
  }
}

provider "aws" {
  region = var.region
}

variable "name" {
  description = "Name of the EC2 instance"
  type        = string
  default     = "${variables.name || 'terraform-instance'}"
}

variable "instance_type" {
  description = "EC2 instance type"
  type        = string
  default     = "${variables.instance_type || 't3.micro'}"
}

variable "region" {
  description = "AWS region"
  type        = string
  default     = "${variables.region || 'us-east-1'}"
}

variable "environment" {
  description = "Environment tag"
  type        = string
  default     = "${variables.environment || 'dev'}"
}

variable "ami_id" {
  description = "AMI ID (leave empty for latest Amazon Linux 2)"
  type        = string
  default     = "${variables.ami_id || ''}"
}

variable "key_name" {
  description = "EC2 Key Pair name"
  type        = string
  default     = "${variables.key_name || ''}"
}

variable "vpc_security_group_ids" {
  description = "List of security group IDs"
  type        = list(string)
  default     = []
}

variable "subnet_id" {
  description = "Subnet ID"
  type        = string
  default     = "${variables.subnet_id || ''}"
}

variable "associate_public_ip_address" {
  description = "Associate a public IP address"
  type        = bool
  default     = ${variables.associate_public_ip_address !== undefined ? variables.associate_public_ip_address : true}
}

# Get default VPC
data "aws_vpc" "default" {
  default = true
}

# Get default subnet (only if subnet_id is not provided)
data "aws_subnet" "default" {
  count             = var.subnet_id == "" ? 1 : 0
  vpc_id            = data.aws_vpc.default.id
  availability_zone = data.aws_availability_zones.available.names[0]
}

# Get specific subnet if provided
data "aws_subnet" "specified" {
  count = var.subnet_id != "" ? 1 : 0
  id    = var.subnet_id
}

data "aws_availability_zones" "available" {
  state = "available"
}

# Get latest Amazon Linux 2 AMI (only if ami_id is not provided)
data "aws_ami" "amazon_linux" {
  count       = var.ami_id == "" ? 1 : 0
  most_recent = true
  owners      = ["amazon"]

  filter {
    name   = "name"
    values = ["amzn2-ami-hvm-*-x86_64-gp2"]
  }
}

# Security group
resource "aws_security_group" "instance_sg" {
  name_prefix = "\${var.name}-sg"
  vpc_id      = data.aws_vpc.default.id

  ingress {
    from_port   = 22
    to_port     = 22
    protocol    = "tcp"
    cidr_blocks = ["0.0.0.0/0"]
  }

  ingress {
    from_port   = 80
    to_port     = 80
    protocol    = "tcp"
    cidr_blocks = ["0.0.0.0/0"]
  }

  egress {
    from_port   = 0
    to_port     = 0
    protocol    = "-1"
    cidr_blocks = ["0.0.0.0/0"]
  }

  tags = {
    Name        = "\${var.name}-sg"
    Environment = var.environment
    ManagedBy   = "terraform-dashboard"
  }
}

# EC2 Instance
resource "aws_instance" "main" {
  ami                         = var.ami_id != "" ? var.ami_id : data.aws_ami.amazon_linux[0].id
  instance_type               = var.instance_type
  subnet_id                   = var.subnet_id != "" ? data.aws_subnet.specified[0].id : data.aws_subnet.default[0].id
  vpc_security_group_ids      = length(var.vpc_security_group_ids) > 0 ? var.vpc_security_group_ids : [aws_security_group.instance_sg.id]
  key_name                    = var.key_name != "" ? var.key_name : null
  associate_public_ip_address = var.associate_public_ip_address

  user_data = <<-EOF
    #!/bin/bash
    yum update -y
    yum install -y httpd
    systemctl start httpd
    systemctl enable httpd
    echo "<h1>Hello from \${var.name}</h1>" > /var/www/html/index.html
  EOF

  tags = {
    Name        = var.name
    Environment = var.environment
    ManagedBy   = "terraform-dashboard"
  }
}

# Outputs
output "instance_id" {
  description = "ID of the EC2 instance"
  value       = aws_instance.main.id
}

output "instance_public_ip" {
  description = "Public IP address of the EC2 instance"
  value       = aws_instance.main.public_ip
}

output "instance_private_ip" {
  description = "Private IP address of the EC2 instance"
  value       = aws_instance.main.private_ip
}

output "security_group_id" {
  description = "ID of the security group"
  value       = aws_security_group.instance_sg.id
}
`;
}

function generateS3Template(variables: any): string {
  return `
terraform {
  required_providers {
    aws = {
      source  = "hashicorp/aws"
      version = "~> 5.0"
    }
  }
}

provider "aws" {
  region = var.region
}

variable "bucket_name" {
  description = "Name of the S3 bucket"
  type        = string
  default     = "${variables.bucket_name || variables.name || 'terraform-bucket'}"
}

variable "region" {
  description = "AWS region"
  type        = string
  default     = "${variables.region || 'us-east-1'}"
}

variable "environment" {
  description = "Environment tag"
  type        = string
  default     = "${variables.environment || 'dev'}"
}

# S3 Bucket
resource "aws_s3_bucket" "main" {
  bucket = "\${var.bucket_name}-\${random_string.suffix.result}"

  tags = {
    Name        = var.bucket_name
    Environment = var.environment
    ManagedBy   = "terraform-dashboard"
  }
}

resource "random_string" "suffix" {
  length  = 8
  special = false
  upper   = false
}

# Bucket versioning
resource "aws_s3_bucket_versioning" "main" {
  bucket = aws_s3_bucket.main.id
  versioning_configuration {
    status = "Enabled"
  }
}

# Bucket encryption
resource "aws_s3_bucket_server_side_encryption_configuration" "main" {
  bucket = aws_s3_bucket.main.id

  rule {
    apply_server_side_encryption_by_default {
      sse_algorithm = "AES256"
    }
  }
}

# Block public access
resource "aws_s3_bucket_public_access_block" "main" {
  bucket = aws_s3_bucket.main.id

  block_public_acls       = true
  block_public_policy     = true
  ignore_public_acls      = true
  restrict_public_buckets = true
}

# Outputs
output "bucket_name" {
  description = "Name of the S3 bucket"
  value       = aws_s3_bucket.main.bucket
}

output "bucket_arn" {
  description = "ARN of the S3 bucket"
  value       = aws_s3_bucket.main.arn
}
`;
}

function generateVPCTemplate(variables: any): string {
  return `
terraform {
  required_providers {
    aws = {
      source  = "hashicorp/aws"
      version = "~> 5.0"
    }
  }
}

provider "aws" {
  region = var.region
}

variable "name" {
  description = "Name of the VPC"
  type        = string
  default     = "${variables.name || 'terraform-vpc'}"
}

variable "cidr_block" {
  description = "CIDR block for VPC"
  type        = string
  default     = "${variables.cidr_block || '10.0.0.0/16'}"
}

variable "region" {
  description = "AWS region"
  type        = string
  default     = "${variables.region || 'us-east-1'}"
}

variable "environment" {
  description = "Environment tag"
  type        = string
  default     = "${variables.environment || 'dev'}"
}

# VPC
resource "aws_vpc" "main" {
  cidr_block           = var.cidr_block
  enable_dns_hostnames = true
  enable_dns_support   = true

  tags = {
    Name        = var.name
    Environment = var.environment
    ManagedBy   = "terraform-dashboard"
  }
}

# Internet Gateway
resource "aws_internet_gateway" "main" {
  vpc_id = aws_vpc.main.id

  tags = {
    Name        = "\${var.name}-igw"
    Environment = var.environment
    ManagedBy   = "terraform-dashboard"
  }
}

# Public Subnet
resource "aws_subnet" "public" {
  vpc_id                  = aws_vpc.main.id
  cidr_block              = cidrsubnet(var.cidr_block, 8, 1)
  availability_zone       = data.aws_availability_zones.available.names[0]
  map_public_ip_on_launch = true

  tags = {
    Name        = "\${var.name}-public-subnet"
    Environment = var.environment
    ManagedBy   = "terraform-dashboard"
  }
}

# Private Subnet
resource "aws_subnet" "private" {
  vpc_id            = aws_vpc.main.id
  cidr_block        = cidrsubnet(var.cidr_block, 8, 2)
  availability_zone = data.aws_availability_zones.available.names[1]

  tags = {
    Name        = "\${var.name}-private-subnet"
    Environment = var.environment
    ManagedBy   = "terraform-dashboard"
  }
}

data "aws_availability_zones" "available" {
  state = "available"
}

# Route Table for Public Subnet
resource "aws_route_table" "public" {
  vpc_id = aws_vpc.main.id

  route {
    cidr_block = "0.0.0.0/0"
    gateway_id = aws_internet_gateway.main.id
  }

  tags = {
    Name        = "\${var.name}-public-rt"
    Environment = var.environment
    ManagedBy   = "terraform-dashboard"
  }
}

# Route Table Association for Public Subnet
resource "aws_route_table_association" "public" {
  subnet_id      = aws_subnet.public.id
  route_table_id = aws_route_table.public.id
}

# Outputs
output "vpc_id" {
  description = "ID of the VPC"
  value       = aws_vpc.main.id
}

output "public_subnet_id" {
  description = "ID of the public subnet"
  value       = aws_subnet.public.id
}

output "private_subnet_id" {
  description = "ID of the private subnet"
  value       = aws_subnet.private.id
}
`;
}

function generateLambdaTemplate(variables: any): string {
  return `
terraform {
  required_providers {
    aws = {
      source  = "hashicorp/aws"
      version = "~> 5.0"
    }
  }
}

provider "aws" {
  region = var.region
}

variable "function_name" {
  description = "Name of the Lambda function"
  type        = string
  default     = "${variables.function_name || variables.name || 'terraform-lambda'}"
}

variable "runtime" {
  description = "Lambda runtime"
  type        = string
  default     = "${variables.runtime || 'python3.9'}"
}

variable "region" {
  description = "AWS region"
  type        = string
  default     = "${variables.region || 'us-east-1'}"
}

variable "environment" {
  description = "Environment tag"
  type        = string
  default     = "${variables.environment || 'dev'}"
}

# IAM role for Lambda
resource "aws_iam_role" "lambda_role" {
  name = "\${var.function_name}-role"

  assume_role_policy = jsonencode({
    Version = "2012-10-17"
    Statement = [
      {
        Action = "sts:AssumeRole"
        Effect = "Allow"
        Principal = {
          Service = "lambda.amazonaws.com"
        }
      }
    ]
  })

  tags = {
    Name        = "\${var.function_name}-role"
    Environment = var.environment
    ManagedBy   = "terraform-dashboard"
  }
}

# Attach basic execution policy
resource "aws_iam_role_policy_attachment" "lambda_basic" {
  policy_arn = "arn:aws:iam::aws:policy/service-role/AWSLambdaBasicExecutionRole"
  role       = aws_iam_role.lambda_role.name
}

# Lambda function code
data "archive_file" "lambda_zip" {
  type        = "zip"
  output_path = "lambda_function.zip"
  source {
    content = <<EOF
def lambda_handler(event, context):
    return {
        'statusCode': 200,
        'body': 'Hello from \${var.function_name}!'
    }
EOF
    filename = "lambda_function.py"
  }
}

# Lambda function
resource "aws_lambda_function" "main" {
  filename         = data.archive_file.lambda_zip.output_path
  function_name    = var.function_name
  role            = aws_iam_role.lambda_role.arn
  handler         = "lambda_function.lambda_handler"
  runtime         = var.runtime
  source_code_hash = data.archive_file.lambda_zip.output_base64sha256

  tags = {
    Name        = var.function_name
    Environment = var.environment
    ManagedBy   = "terraform-dashboard"
  }
}

# Outputs
output "function_name" {
  description = "Name of the Lambda function"
  value       = aws_lambda_function.main.function_name
}

output "function_arn" {
  description = "ARN of the Lambda function"
  value       = aws_lambda_function.main.arn
}
`;
}

function generateRDSTemplate(variables: any): string {
  return `# Simple RDS template - requires manual setup for production use
terraform {
  required_providers {
    aws = {
      source  = "hashicorp/aws"
      version = "~> 5.0"
    }
  }
}

provider "aws" {
  region = var.region
}

variable "db_name" {
  description = "Name of the database"
  type        = string
  default     = "${variables.db_name || variables.name || 'terraformdb'}"
}

variable "region" {
  description = "AWS region"
  type        = string
  default     = "${variables.region || 'us-east-1'}"
}

variable "environment" {
  description = "Environment tag"
  type        = string
  default     = "${variables.environment || 'dev'}"
}

# Note: This is a simplified template for demo purposes
# In production, you would need proper VPC, security groups, etc.

output "message" {
  description = "RDS setup message"
  value       = "RDS template created for \${var.db_name}. Manual configuration required for production deployment."
}
`;
}

function generateEKSTemplate(variables: any): string {
  return `# Simple EKS template - requires manual setup for production use
terraform {
  required_providers {
    aws = {
      source  = "hashicorp/aws"
      version = "~> 5.0"
    }
  }
}

provider "aws" {
  region = var.region
}

variable "cluster_name" {
  description = "Name of the EKS cluster"
  type        = string
  default     = "${variables.cluster_name || variables.name || 'terraform-eks'}"
}

variable "region" {
  description = "AWS region"
  type        = string
  default     = "${variables.region || 'us-east-1'}"
}

variable "environment" {
  description = "Environment tag"
  type        = string
  default     = "${variables.environment || 'dev'}"
}

# Note: This is a simplified template for demo purposes
# In production, you would need proper VPC, IAM roles, node groups, etc.

output "message" {
  description = "EKS setup message"
  value       = "EKS template created for \${var.cluster_name}. Manual configuration required for production deployment."
}
`;
}

// Deployment processor
async function processDeployment(deploymentId: string) {
  try {
    console.log(`🚀 Processing deployment: ${deploymentId}`);

    // Update status to running
    await db.run(`
      UPDATE deployments
      SET status = 'running', last_action = 'terraform_init', updated_at = datetime('now')
      WHERE id = ?
    `, [deploymentId]);

    // Get deployment and template info
    const deployment = await db.get(`
      SELECT d.*, t.terraform_code, t.variables as template_variables
      FROM deployments d
      LEFT JOIN templates t ON d.template_id = t.id
      WHERE d.id = ?
    `, [deploymentId]);

    if (!deployment) {
      throw new Error('Deployment not found');
    }

    const template = await db.get('SELECT * FROM templates WHERE id = ?', [deployment.template_id]);
    if (!template) {
      throw new Error('Template not found');
    }

    // Generate Terraform files
    const workspaceDir = await generateTerraformFiles(deployment, template);

    // Update workspace path
    await db.run(`
      UPDATE deployments
      SET workspace_path = ?, updated_at = datetime('now')
      WHERE id = ?
    `, [workspaceDir, deploymentId]);

    let logs = `🚀 Starting deployment for ${deployment.name}\n`;
    logs += `📁 Workspace: ${workspaceDir}\n`;
    logs += `📋 Template: ${template.name}\n\n`;

    // Step 1: Terraform Init
    logs += `⚡ Running terraform init...\n`;
    await db.run(`
      UPDATE deployments
      SET logs = ?, last_action = 'terraform_init', updated_at = datetime('now')
      WHERE id = ?
    `, [logs, deploymentId]);

    const initResult = await executeTerraformCommand('terraform init', workspaceDir);
    logs += initResult.output + '\n';

    if (!initResult.success) {
      logs += `❌ Terraform init failed!\n`;
      await db.run(`
        UPDATE deployments
        SET status = 'failed', logs = ?, last_action = 'terraform_init_failed', updated_at = datetime('now')
        WHERE id = ?
      `, [logs, deploymentId]);
      return;
    }

    logs += `✅ Terraform init completed successfully!\n\n`;

    // Step 2: Terraform Plan
    logs += `📋 Running terraform plan...\n`;
    await db.run(`
      UPDATE deployments
      SET logs = ?, last_action = 'terraform_plan', updated_at = datetime('now')
      WHERE id = ?
    `, [logs, deploymentId]);

    const planResult = await executeTerraformCommand('terraform plan', workspaceDir);
    logs += planResult.output + '\n';

    if (!planResult.success) {
      logs += `❌ Terraform plan failed!\n`;
      await db.run(`
        UPDATE deployments
        SET status = 'failed', logs = ?, last_action = 'terraform_plan_failed', updated_at = datetime('now')
        WHERE id = ?
      `, [logs, deploymentId]);
      return;
    }

    logs += `✅ Terraform plan completed successfully!\n\n`;

    // Step 3: Terraform Apply (with auto-approve for demo)
    logs += `🚀 Running terraform apply...\n`;
    await db.run(`
      UPDATE deployments
      SET logs = ?, last_action = 'terraform_apply', updated_at = datetime('now')
      WHERE id = ?
    `, [logs, deploymentId]);

    const applyResult = await executeTerraformCommand('terraform apply -auto-approve', workspaceDir);
    logs += applyResult.output + '\n';

    if (!applyResult.success) {
      logs += `❌ Terraform apply failed!\n`;
      await db.run(`
        UPDATE deployments
        SET status = 'failed', logs = ?, last_action = 'terraform_apply_failed', updated_at = datetime('now')
        WHERE id = ?
      `, [logs, deploymentId]);
      return;
    }

    logs += `✅ Terraform apply completed successfully!\n\n`;

    // Get terraform state
    const stateResult = await executeTerraformCommand('terraform show -json', workspaceDir);
    const terraformState = stateResult.success ? stateResult.output : null;

    // Final success update
    logs += `🎉 Deployment completed successfully!\n`;
    logs += `📊 Infrastructure has been provisioned.\n`;

    await db.run(`
      UPDATE deployments
      SET status = 'success', logs = ?, terraform_state = ?, last_action = 'completed', updated_at = datetime('now')
      WHERE id = ?
    `, [logs, terraformState, deploymentId]);

    console.log(`✅ Deployment ${deploymentId} completed successfully`);

  } catch (error) {
    console.error(`❌ Deployment ${deploymentId} failed:`, error);

    const errorLogs = `❌ Deployment failed: ${error instanceof Error ? error.message : 'Unknown error'}\n`;
    await db.run(`
      UPDATE deployments
      SET status = 'failed', logs = ?, last_action = 'error', updated_at = datetime('now')
      WHERE id = ?
    `, [errorLogs, deploymentId]);
  }
}

// Destroy deployment processor
async function processDestroy(deploymentId: string) {
  try {
    console.log(`🗑️ Processing destroy for deployment: ${deploymentId}`);

    // Get deployment info
    const deployment = await db.get('SELECT * FROM deployments WHERE id = ?', [deploymentId]);
    if (!deployment) {
      throw new Error('Deployment not found');
    }

    // Check if workspace exists
    const workspaceDir = deployment.workspace_path;
    if (!workspaceDir || !fs.existsSync(workspaceDir)) {
      throw new Error('Workspace directory not found. Cannot destroy infrastructure.');
    }

    let logs = `🗑️ Starting destroy process for ${deployment.name}\n`;
    logs += `📁 Workspace: ${workspaceDir}\n\n`;

    // Update status and logs
    await db.run(`
      UPDATE deployments
      SET status = 'destroying', logs = ?, last_action = 'terraform_destroy', updated_at = datetime('now')
      WHERE id = ?
    `, [logs, deploymentId]);

    // Step 1: Terraform Destroy
    logs += `🗑️ Running terraform destroy...\n`;
    await db.run(`
      UPDATE deployments
      SET logs = ?, last_action = 'terraform_destroy', updated_at = datetime('now')
      WHERE id = ?
    `, [logs, deploymentId]);

    const destroyResult = await executeTerraformCommand('terraform destroy -auto-approve', workspaceDir);
    logs += destroyResult.output + '\n';

    if (!destroyResult.success) {
      logs += `❌ Terraform destroy failed!\n`;
      await db.run(`
        UPDATE deployments
        SET status = 'destroy_failed', logs = ?, last_action = 'terraform_destroy_failed', updated_at = datetime('now')
        WHERE id = ?
      `, [logs, deploymentId]);
      return;
    }

    logs += `✅ Terraform destroy completed successfully!\n\n`;

    // Step 2: Clean up workspace (optional)
    logs += `🧹 Cleaning up workspace...\n`;
    try {
      // Remove .terraform directory and state files
      const terraformDir = path.join(workspaceDir, '.terraform');
      const stateFile = path.join(workspaceDir, 'terraform.tfstate');
      const stateBackup = path.join(workspaceDir, 'terraform.tfstate.backup');
      const lockFile = path.join(workspaceDir, '.terraform.lock.hcl');

      if (fs.existsSync(terraformDir)) {
        fs.rmSync(terraformDir, { recursive: true, force: true });
      }
      if (fs.existsSync(stateFile)) {
        fs.unlinkSync(stateFile);
      }
      if (fs.existsSync(stateBackup)) {
        fs.unlinkSync(stateBackup);
      }
      if (fs.existsSync(lockFile)) {
        fs.unlinkSync(lockFile);
      }

      logs += `✅ Workspace cleaned up successfully!\n`;
    } catch (cleanupError) {
      logs += `⚠️ Workspace cleanup warning: ${cleanupError}\n`;
    }

    // Final success update
    logs += `🎉 Infrastructure destroyed successfully!\n`;
    logs += `📊 All AWS resources have been removed.\n`;

    await db.run(`
      UPDATE deployments
      SET status = 'destroyed', logs = ?, terraform_state = NULL, last_action = 'destroyed', updated_at = datetime('now')
      WHERE id = ?
    `, [logs, deploymentId]);

    console.log(`✅ Destroy ${deploymentId} completed successfully`);

  } catch (error) {
    console.error(`❌ Destroy ${deploymentId} failed:`, error);

    const errorLogs = `❌ Destroy failed: ${error instanceof Error ? error.message : 'Unknown error'}\n`;
    await db.run(`
      UPDATE deployments
      SET status = 'destroy_failed', logs = ?, last_action = 'destroy_error', updated_at = datetime('now')
      WHERE id = ?
    `, [errorLogs, deploymentId]);
  }
}

startServer();
