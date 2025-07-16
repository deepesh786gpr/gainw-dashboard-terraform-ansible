import express from 'express';
import { spawn } from 'child_process';
import path from 'path';
import fs from 'fs/promises';
import { authenticateToken } from '../middleware/auth';

const router = express.Router();

// Apply authentication middleware to all routes
router.use(authenticateToken);

interface AnsibleExecutionResult {
  success: boolean;
  output: string;
  error?: string;
  duration: number;
  playbook: string;
  variables: any;
}

// Execute Ansible playbook
async function executeAnsiblePlaybook(
  playbookName: string, 
  variables: Record<string, any> = {}
): Promise<AnsibleExecutionResult> {
  return new Promise((resolve) => {
    const startTime = Date.now();
    const playbookPath = path.join(__dirname, '../../ansible-playbooks', `${playbookName}.yml`);
    
    // Build ansible-playbook command
    const args = ['ansible-playbook', playbookPath];
    
    // Add variables as extra vars
    if (Object.keys(variables).length > 0) {
      const extraVars = Object.entries(variables)
        .map(([key, value]) => `${key}=${value}`)
        .join(' ');
      args.push('-e', extraVars);
    }
    
    // Add other common options
    args.push('-v'); // Verbose output
    
    let output = '';
    let errorOutput = '';

    const childProcess = spawn('ansible-playbook', args.slice(1), {
      cwd: path.join(__dirname, '../../ansible-playbooks'),
      env: { ...process.env }
    });

    childProcess.stdout.on('data', (data: any) => {
      output += data.toString();
    });

    childProcess.stderr.on('data', (data: any) => {
      errorOutput += data.toString();
    });

    childProcess.on('close', (code: number) => {
      const duration = Date.now() - startTime;

      resolve({
        success: code === 0,
        output: output,
        error: code !== 0 ? errorOutput : undefined,
        duration: duration,
        playbook: playbookName,
        variables: variables
      });
    });

    childProcess.on('error', (error: Error) => {
      const duration = Date.now() - startTime;

      resolve({
        success: false,
        output: '',
        error: error.message,
        duration: duration,
        playbook: playbookName,
        variables: variables
      });
    });
  });
}

// Create EC2 Instance
router.post('/ec2/create', async (req, res, next) => {
  try {
    const {
      instance_name,
      instance_type = 't3.micro',
      ami_id,
      key_name,
      security_group,
      subnet_id,
      aws_region = 'us-east-1',
      volume_size = 20,
      volume_type = 'gp3',
      environment = 'development'
    } = req.body;

    if (!instance_name) {
      return res.status(400).json({
        success: false,
        error: 'instance_name is required'
      });
    }

    const variables = {
      instance_name,
      instance_type,
      ami_id: ami_id || '',
      key_name: key_name || '',
      security_group: security_group || 'default',
      subnet_id: subnet_id || '',
      aws_region,
      volume_size,
      volume_type,
      environment
    };

    const result = await executeAnsiblePlaybook('ec2-create', variables);

    res.json({
      success: result.success,
      message: result.success ? 'EC2 instance created successfully' : 'Failed to create EC2 instance',
      execution_time_ms: result.duration,
      output: result.output,
      error: result.error,
      variables: variables
    });
  } catch (error) {
    next(error);
  }
});

// Modify EC2 Instance
router.post('/ec2/modify', async (req, res, next) => {
  try {
    const {
      instance_id,
      new_instance_type,
      new_security_groups,
      add_tags,
      remove_tags,
      aws_region = 'us-east-1'
    } = req.body;

    if (!instance_id) {
      return res.status(400).json({
        success: false,
        error: 'instance_id is required'
      });
    }

    const variables = {
      instance_id,
      aws_region,
      new_instance_type: new_instance_type || '',
      new_security_groups: Array.isArray(new_security_groups) ? new_security_groups.join(',') : '',
      add_tags: add_tags ? JSON.stringify(add_tags) : '{}',
      remove_tags: Array.isArray(remove_tags) ? remove_tags.join(',') : ''
    };

    const result = await executeAnsiblePlaybook('ec2-modify', variables);

    res.json({
      success: result.success,
      message: result.success ? 'EC2 instance modified successfully' : 'Failed to modify EC2 instance',
      execution_time_ms: result.duration,
      output: result.output,
      error: result.error,
      variables: variables
    });
  } catch (error) {
    next(error);
  }
});

// Restart EC2 Instance
router.post('/ec2/restart', async (req, res, next) => {
  try {
    const {
      instance_id,
      aws_region = 'us-east-1',
      wait_for_restart = true,
      restart_timeout = 600,
      health_check_url,
      health_check_timeout = 300,
      force_restart = false
    } = req.body;

    if (!instance_id) {
      return res.status(400).json({
        success: false,
        error: 'instance_id is required'
      });
    }

    const variables = {
      instance_id,
      aws_region,
      wait_for_restart,
      restart_timeout,
      health_check_url: health_check_url || '',
      health_check_timeout,
      force_restart
    };

    const result = await executeAnsiblePlaybook('ec2-restart', variables);

    res.json({
      success: result.success,
      message: result.success ? 'EC2 instance restarted successfully' : 'Failed to restart EC2 instance',
      execution_time_ms: result.duration,
      output: result.output,
      error: result.error,
      variables: variables
    });
  } catch (error) {
    next(error);
  }
});

// Stop EC2 Instance
router.post('/ec2/stop', async (req, res, next) => {
  try {
    const {
      instance_id,
      aws_region = 'us-east-1',
      wait_for_stop = true,
      stop_timeout = 300,
      force_stop = false,
      graceful_shutdown = true,
      shutdown_delay = 30
    } = req.body;

    if (!instance_id) {
      return res.status(400).json({
        success: false,
        error: 'instance_id is required'
      });
    }

    const variables = {
      instance_id,
      aws_region,
      wait_for_stop,
      stop_timeout,
      force_stop,
      graceful_shutdown,
      shutdown_delay
    };

    const result = await executeAnsiblePlaybook('ec2-stop', variables);

    res.json({
      success: result.success,
      message: result.success ? 'EC2 instance stopped successfully' : 'Failed to stop EC2 instance',
      execution_time_ms: result.duration,
      output: result.output,
      error: result.error,
      variables: variables
    });
  } catch (error) {
    next(error);
  }
});

// Test EC2 Instance
router.post('/ec2/test', async (req, res, next) => {
  try {
    const {
      instance_id,
      aws_region = 'us-east-1',
      test_ssh = false,
      ssh_user = 'ec2-user',
      ssh_key_path,
      test_http = false,
      http_port = 80,
      test_https = false,
      https_port = 443,
      custom_ports = [],
      ping_test = true
    } = req.body;

    if (!instance_id) {
      return res.status(400).json({
        success: false,
        error: 'instance_id is required'
      });
    }

    const variables = {
      instance_id,
      aws_region,
      test_ssh,
      ssh_user,
      ssh_key_path: ssh_key_path || '',
      test_http,
      http_port,
      test_https,
      https_port,
      custom_ports: Array.isArray(custom_ports) ? custom_ports.join(',') : '',
      ping_test
    };

    const result = await executeAnsiblePlaybook('ec2-test', variables);

    res.json({
      success: result.success,
      message: result.success ? 'EC2 instance tests completed' : 'EC2 instance tests failed',
      execution_time_ms: result.duration,
      output: result.output,
      error: result.error,
      variables: variables
    });
  } catch (error) {
    next(error);
  }
});

// List available playbooks
router.get('/playbooks', async (req, res, next) => {
  try {
    const playbooksDir = path.join(__dirname, '../../ansible-playbooks');
    const files = await fs.readdir(playbooksDir);
    
    const playbooks = files
      .filter(file => file.endsWith('.yml'))
      .map(file => {
        const name = file.replace('.yml', '');
        return {
          name: name,
          file: file,
          description: getPlaybookDescription(name),
          category: getPlaybookCategory(name)
        };
      });

    res.json({
      success: true,
      playbooks: playbooks,
      count: playbooks.length
    });
  } catch (error) {
    next(error);
  }
});

// Helper functions
function getPlaybookDescription(name: string): string {
  const descriptions: Record<string, string> = {
    'ec2-create': 'Create a new EC2 instance with specified configuration',
    'ec2-modify': 'Modify an existing EC2 instance (instance type, tags, security groups)',
    'ec2-restart': 'Safely restart an EC2 instance with optional health checks',
    'ec2-stop': 'Safely stop an EC2 instance with optional graceful shutdown',
    'ec2-test': 'Comprehensive testing of EC2 instance health and connectivity'
  };
  
  return descriptions[name] || 'Ansible playbook for infrastructure management';
}

function getPlaybookCategory(name: string): string {
  if (name.startsWith('ec2-')) return 'EC2 Management';
  if (name.startsWith('vpc-')) return 'Networking';
  if (name.startsWith('rds-')) return 'Database';
  if (name.startsWith('s3-')) return 'Storage';
  
  return 'General';
}

export default router;
