const express = require('express');
const cors = require('cors');
const { spawn } = require('child_process');
const path = require('path');
const fs = require('fs');

const app = express();
const PORT = 5001; // Different port to avoid conflicts

// Middleware
app.use(cors());
app.use(express.json());

// Store for tracking executions
const executionStore = new Map();

// Supported playbooks and their operations
const SUPPORTED_PLAYBOOKS = {
  'ec2-management': {
    path: 'playbooks/ec2-management.yml',
    operations: ['create', 'start', 'stop', 'restart', 'terminate', 'modify', 'backup', 'info', 'list']
  },
  'rds-management': {
    path: 'playbooks/rds-management.yml', 
    operations: ['create', 'start', 'stop', 'restart', 'delete', 'backup', 'modify', 'info', 'list']
  },
  'lambda-management': {
    path: 'playbooks/lambda-management.yml',
    operations: ['create', 'update', 'delete', 'invoke', 'info', 'list', 'configure']
  },
  'eks-management': {
    path: 'playbooks/eks-management.yml',
    operations: ['create', 'delete', 'update', 'scale', 'info', 'list', 'configure']
  }
};

// Get Ansible playbooks directory
const getAnsibleDir = () => {
  return process.env.ANSIBLE_PLAYBOOKS_DIR || path.join(__dirname, '../ansible-aws-playbooks');
};

// Validate execution request
const validateRequest = (req) => {
  if (!req.playbook || !SUPPORTED_PLAYBOOKS[req.playbook]) {
    return `Unsupported playbook: ${req.playbook}`;
  }

  if (!req.action) {
    return 'Action is required';
  }

  const playbook = SUPPORTED_PLAYBOOKS[req.playbook];
  if (!playbook.operations.includes(req.action)) {
    return `Unsupported action '${req.action}' for playbook '${req.playbook}'`;
  }

  return null;
};

// Execute Ansible playbook
const executePlaybook = async (request) => {
  const executionId = `ansible-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
  const startTime = Date.now();
  
  return new Promise((resolve) => {
    const ansibleDir = getAnsibleDir();
    const playbook = SUPPORTED_PLAYBOOKS[request.playbook];
    const playbookPath = path.join(ansibleDir, playbook.path);

    // Build ansible-playbook command
    const args = [playbookPath];
    
    // Add extra variables
    const extraVars = {
      action: request.action,
      region: request.region || 'us-east-1',
      env: request.environment || 'development',
      ...request.parameters
    };

    // Convert parameters to ansible extra vars format
    const extraVarsString = Object.entries(extraVars)
      .map(([key, value]) => {
        if (typeof value === 'object') {
          return `${key}='${JSON.stringify(value)}'`;
        }
        return `${key}=${value}`;
      })
      .join(' ');

    args.push('-e', extraVarsString);

    console.log(`🚀 Executing Ansible playbook: ${request.playbook}`);
    console.log(`📋 Action: ${request.action}`);
    console.log(`🔧 Parameters:`, extraVars);
    console.log(`💻 Command: ansible-playbook ${args.join(' ')}`);

    // Execute ansible-playbook
    const ansibleProcess = spawn('ansible-playbook', args, {
      cwd: ansibleDir,
      env: {
        ...process.env,
        ANSIBLE_HOST_KEY_CHECKING: 'False',
        ANSIBLE_STDOUT_CALLBACK: 'json'
      }
    });

    let output = '';
    let errorOutput = '';

    ansibleProcess.stdout.on('data', (data) => {
      const chunk = data.toString();
      output += chunk;
      console.log('Ansible stdout:', chunk);
    });

    ansibleProcess.stderr.on('data', (data) => {
      const chunk = data.toString();
      errorOutput += chunk;
      console.log('Ansible stderr:', chunk);
    });

    ansibleProcess.on('close', (code) => {
      const endTime = Date.now();
      const duration = endTime - startTime;

      const result = {
        success: code === 0,
        output: output,
        error: code !== 0 ? errorOutput : undefined,
        executionId,
        timestamp: new Date().toISOString(),
        duration
      };

      // Store result for later retrieval
      executionStore.set(executionId, result);

      console.log(`✅ Ansible execution completed: ${executionId}`);
      console.log(`⏱️  Duration: ${duration}ms`);
      console.log(`🎯 Success: ${result.success}`);

      resolve(result);
    });

    ansibleProcess.on('error', (error) => {
      const endTime = Date.now();
      const duration = endTime - startTime;

      const result = {
        success: false,
        output: '',
        error: `Failed to start ansible-playbook: ${error.message}`,
        executionId,
        timestamp: new Date().toISOString(),
        duration
      };

      executionStore.set(executionId, result);
      resolve(result);
    });
  });
};

// Routes

// Health check for Ansible
app.get('/health', async (req, res) => {
  try {
    const ansibleDir = getAnsibleDir();
    
    // Check if ansible-playbook is available
    const ansibleCheck = spawn('ansible-playbook', ['--version'], { stdio: 'pipe' });
    
    ansibleCheck.on('close', (code) => {
      const checks = {
        ansible_available: code === 0,
        playbooks_directory: fs.existsSync(ansibleDir),
        playbooks_found: Object.keys(SUPPORTED_PLAYBOOKS).map(name => {
          const playbook = SUPPORTED_PLAYBOOKS[name];
          return {
            name,
            path: playbook.path,
            exists: fs.existsSync(path.join(ansibleDir, playbook.path))
          };
        })
      };

      const allHealthy = checks.ansible_available && 
                        checks.playbooks_directory && 
                        checks.playbooks_found.every(p => p.exists);

      res.json({
        success: true,
        healthy: allHealthy,
        checks,
        ansible_directory: ansibleDir
      });
    });

    ansibleCheck.on('error', () => {
      res.json({
        success: true,
        healthy: false,
        checks: {
          ansible_available: false,
          playbooks_directory: fs.existsSync(ansibleDir),
          error: 'ansible-playbook command not found'
        },
        ansible_directory: ansibleDir
      });
    });

  } catch (error) {
    console.error('❌ Ansible health check error:', error);
    res.status(500).json({
      success: false,
      error: 'Health check failed'
    });
  }
});

// Get supported playbooks and operations
app.get('/playbooks', (req, res) => {
  try {
    res.json({
      success: true,
      playbooks: SUPPORTED_PLAYBOOKS
    });
  } catch (error) {
    console.error('❌ Error getting playbooks:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to get playbooks'
    });
  }
});

// Execute Ansible playbook
app.post('/execute', async (req, res) => {
  try {
    console.log('🎭 Ansible execution request received:', req.body);

    const request = req.body;

    // Validate request
    const validationError = validateRequest(request);
    if (validationError) {
      return res.status(400).json({
        success: false,
        error: validationError
      });
    }

    // Check if Ansible is available
    const ansibleDir = getAnsibleDir();
    if (!fs.existsSync(ansibleDir)) {
      return res.status(500).json({
        success: false,
        error: `Ansible playbooks directory not found: ${ansibleDir}`
      });
    }

    // Execute playbook
    const result = await executePlaybook(request);

    res.json(result);

  } catch (error) {
    console.error('❌ Ansible execution error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to execute playbook'
    });
  }
});

// Get execution result by ID
app.get('/execution/:id', (req, res) => {
  try {
    const { id } = req.params;
    const result = executionStore.get(id);

    if (!result) {
      return res.status(404).json({
        success: false,
        error: 'Execution not found'
      });
    }

    res.json(result);

  } catch (error) {
    console.error('❌ Error retrieving execution result:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to retrieve execution result'
    });
  }
});

// List all executions
app.get('/executions', (req, res) => {
  try {
    const executions = Array.from(executionStore.entries()).map(([id, result]) => ({
      id,
      ...result
    }));

    res.json({
      success: true,
      executions: executions.sort((a, b) => 
        new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime()
      )
    });

  } catch (error) {
    console.error('❌ Error listing executions:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to list executions'
    });
  }
});

// Start server
app.listen(PORT, () => {
  console.log(`🎭 Ansible API Server running on port ${PORT}`);
  console.log(`🌐 Health check: http://localhost:${PORT}/health`);
  console.log(`📋 Playbooks: http://localhost:${PORT}/playbooks`);
  console.log(`🔧 Ansible directory: ${getAnsibleDir()}`);
});
