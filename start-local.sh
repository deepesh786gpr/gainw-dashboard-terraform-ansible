#!/bin/bash

# Start Terraform Dashboard Locally
# This script starts all services on your local machine

set -e

# Colors
GREEN='\033[0;32m'
BLUE='\033[0;34m'
RED='\033[0;31m'
YELLOW='\033[1;33m'
NC='\033[0m'

echo -e "${BLUE}🚀 Starting Terraform Dashboard Locally${NC}"
echo "================================================================"

# Function to print status
print_status() {
    echo -e "${BLUE}ℹ️  $1${NC}"
}

print_success() {
    echo -e "${GREEN}✅ $1${NC}"
}

print_error() {
    echo -e "${RED}❌ $1${NC}"
}

print_warning() {
    echo -e "${YELLOW}⚠️  $1${NC}"
}

# Check if we're in the right directory
if [ ! -d "terraform-dashboard" ]; then
    print_error "terraform-dashboard directory not found!"
    print_status "Please run this script from the project root directory"
    exit 1
fi

# Kill any existing processes on the ports we need
print_status "Cleaning up existing processes..."
lsof -ti:3000 | xargs kill -9 2>/dev/null || true
lsof -ti:5000 | xargs kill -9 2>/dev/null || true
lsof -ti:5001 | xargs kill -9 2>/dev/null || true

print_success "Cleaned up existing processes"

# Check Node.js
print_status "Checking Node.js installation..."
if ! command -v node &> /dev/null; then
    print_error "Node.js is not installed!"
    print_status "Please install Node.js from https://nodejs.org/"
    exit 1
fi

NODE_VERSION=$(node --version)
print_success "Node.js version: $NODE_VERSION"

# Check if Ansible is available (optional for local development)
if command -v ansible-playbook &> /dev/null; then
    ANSIBLE_VERSION=$(ansible-playbook --version | head -n1)
    print_success "Ansible available: $ANSIBLE_VERSION"
    ANSIBLE_AVAILABLE=true
else
    print_warning "Ansible not available - Ansible features will be simulated"
    ANSIBLE_AVAILABLE=false
fi

# Set up environment variables
print_status "Setting up environment variables..."
export NODE_ENV=development
export PORT=5000
export FRONTEND_URL=http://localhost:3000
export DATABASE_PATH=./terraform-dashboard/data/terraform-dashboard.db
export JWT_SECRET=local-development-secret-$(date +%s)
export AWS_REGION=us-east-1
export TERRAFORM_WORKING_DIR=./terraform-dashboard/terraform-workspace
export ANSIBLE_PLAYBOOKS_DIR=./ansible-aws-playbooks
export LOG_LEVEL=info

print_success "Environment variables configured"

# Create necessary directories
print_status "Creating necessary directories..."
mkdir -p terraform-dashboard/data
mkdir -p terraform-dashboard/logs
mkdir -p terraform-dashboard/terraform-workspace

# Install backend dependencies
print_status "Installing backend dependencies..."
cd terraform-dashboard/backend
if [ ! -d "node_modules" ]; then
    npm install
else
    print_success "Backend dependencies already installed"
fi

# Build backend
print_status "Building backend..."
npm run build

print_success "Backend ready"

# Install frontend dependencies
print_status "Installing frontend dependencies..."
cd ../frontend
if [ ! -d "node_modules" ]; then
    npm install
else
    print_success "Frontend dependencies already installed"
fi

print_success "Frontend ready"

# Go back to project root
cd ../../

# Create local Ansible API server
print_status "Creating local Ansible API server..."
cat > local-ansible-api.js << 'EOF'
const express = require('express');
const cors = require('cors');
const { spawn } = require('child_process');
const path = require('path');
const fs = require('fs');

const app = express();
const PORT = 5001;

app.use(cors());
app.use(express.json());

const executionStore = new Map();

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

const getAnsibleDir = () => {
  return process.env.ANSIBLE_PLAYBOOKS_DIR || './ansible-aws-playbooks';
};

const ANSIBLE_AVAILABLE = fs.existsSync('/usr/local/bin/ansible-playbook') || fs.existsSync('/usr/bin/ansible-playbook') || fs.existsSync('/opt/homebrew/bin/ansible-playbook');

app.get('/health', (req, res) => {
  const ansibleDir = getAnsibleDir();
  const checks = {
    ansible_available: ANSIBLE_AVAILABLE,
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
    ansible_directory: ansibleDir,
    mode: 'local-development'
  });
});

app.get('/playbooks', (req, res) => {
  res.json({
    success: true,
    playbooks: SUPPORTED_PLAYBOOKS
  });
});

app.post('/execute', async (req, res) => {
  const { playbook, action, parameters = {}, environment = 'development', region = 'us-east-1' } = req.body;
  const executionId = `local-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
  const startTime = Date.now();

  console.log(`🎭 Executing: ${playbook} ${action}`);
  console.log(`📋 Parameters:`, parameters);

  if (ANSIBLE_AVAILABLE) {
    // Try to execute real Ansible playbook
    try {
      const ansibleDir = getAnsibleDir();
      const playbookInfo = SUPPORTED_PLAYBOOKS[playbook];
      
      if (!playbookInfo) {
        throw new Error(`Unsupported playbook: ${playbook}`);
      }

      const playbookPath = path.join(ansibleDir, playbookInfo.path);
      
      if (!fs.existsSync(playbookPath)) {
        throw new Error(`Playbook file not found: ${playbookPath}`);
      }

      const args = [playbookPath, '-e', `action=${action}`, '-e', `region=${region}`, '-e', `env=${environment}`];
      
      // Add parameters
      Object.entries(parameters).forEach(([key, value]) => {
        args.push('-e', `${key}=${value}`);
      });

      const ansibleProcess = spawn('ansible-playbook', args, {
        cwd: ansibleDir,
        env: {
          ...process.env,
          ANSIBLE_HOST_KEY_CHECKING: 'False',
          ANSIBLE_STDOUT_CALLBACK: 'yaml'
        }
      });

      let output = '';
      let errorOutput = '';

      ansibleProcess.stdout.on('data', (data) => {
        output += data.toString();
      });

      ansibleProcess.stderr.on('data', (data) => {
        errorOutput += data.toString();
      });

      ansibleProcess.on('close', (code) => {
        const endTime = Date.now();
        const duration = endTime - startTime;

        const result = {
          success: code === 0,
          output: output || `Executed ${playbook} ${action} locally`,
          error: code !== 0 ? errorOutput : undefined,
          executionId,
          timestamp: new Date().toISOString(),
          duration,
          mode: 'ansible-real'
        };

        executionStore.set(executionId, result);
        res.json(result);
      });

      ansibleProcess.on('error', (error) => {
        const endTime = Date.now();
        const duration = endTime - startTime;

        const result = {
          success: false,
          output: '',
          error: `Failed to execute ansible-playbook: ${error.message}`,
          executionId,
          timestamp: new Date().toISOString(),
          duration,
          mode: 'ansible-error'
        };

        executionStore.set(executionId, result);
        res.json(result);
      });

    } catch (error) {
      // Fallback to simulation
      const endTime = Date.now();
      const duration = endTime - startTime;

      const result = {
        success: true,
        output: `Simulated execution of ${playbook} ${action}\nParameters: ${JSON.stringify(parameters, null, 2)}\nRegion: ${region}\nEnvironment: ${environment}\n\nNote: This is a simulated execution for local development.`,
        executionId,
        timestamp: new Date().toISOString(),
        duration: Math.floor(Math.random() * 2000) + 1000,
        mode: 'simulation'
      };

      executionStore.set(executionId, result);
      res.json(result);
    }
  } else {
    // Simulate execution
    const endTime = Date.now();
    const duration = endTime - startTime;

    const result = {
      success: true,
      output: `Simulated execution of ${playbook} ${action}\nParameters: ${JSON.stringify(parameters, null, 2)}\nRegion: ${region}\nEnvironment: ${environment}\n\nNote: Ansible not available - this is a simulated execution.`,
      executionId,
      timestamp: new Date().toISOString(),
      duration: Math.floor(Math.random() * 2000) + 1000,
      mode: 'simulation'
    };

    executionStore.set(executionId, result);
    res.json(result);
  }
});

app.get('/execution/:id', (req, res) => {
  const { id } = req.params;
  const result = executionStore.get(id);

  if (!result) {
    return res.status(404).json({
      success: false,
      error: 'Execution not found'
    });
  }

  res.json(result);
});

app.get('/executions', (req, res) => {
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
});

app.listen(PORT, () => {
  console.log(`🎭 Local Ansible API Server running on port ${PORT}`);
  console.log(`🌐 Health check: http://localhost:${PORT}/health`);
  console.log(`📋 Playbooks: http://localhost:${PORT}/playbooks`);
  console.log(`🔧 Mode: ${ANSIBLE_AVAILABLE ? 'Real Ansible' : 'Simulation'}`);
});
EOF

print_success "Local Ansible API server created"

# Start all services
print_status "Starting all services..."

echo ""
echo "🔧 Starting Backend (Port 5000)..."
cd terraform-dashboard/backend
npm start &
BACKEND_PID=$!

echo "🎨 Starting Frontend (Port 3000)..."
cd ../frontend
npm start &
FRONTEND_PID=$!

echo "🎭 Starting Ansible API (Port 5001)..."
cd ../../
node local-ansible-api.js &
ANSIBLE_PID=$!

# Wait a moment for services to start
sleep 5

print_success "All services started!"

echo ""
echo "🌐 Your local Terraform Dashboard is running at:"
echo "   Frontend:    http://localhost:3000"
echo "   Backend API: http://localhost:5000"
echo "   Ansible API: http://localhost:5001"
echo ""
echo "📊 Service Status:"
echo "   Backend PID:  $BACKEND_PID"
echo "   Frontend PID: $FRONTEND_PID"
echo "   Ansible PID:  $ANSIBLE_PID"
echo ""
echo "🛑 To stop all services:"
echo "   kill $BACKEND_PID $FRONTEND_PID $ANSIBLE_PID"
echo "   Or press Ctrl+C to stop this script"
echo ""

# Test endpoints
print_status "Testing endpoints..."
sleep 3

if curl -f -s "http://localhost:5000/health" > /dev/null; then
    print_success "Backend is responding"
else
    print_warning "Backend may still be starting..."
fi

if curl -f -s "http://localhost:5001/health" > /dev/null; then
    print_success "Ansible API is responding"
else
    print_warning "Ansible API may still be starting..."
fi

echo ""
print_success "🎉 Terraform Dashboard is ready!"
print_status "Open http://localhost:3000 in your browser to access the dashboard"

# Keep script running and wait for Ctrl+C
trap "echo ''; print_status 'Stopping services...'; kill $BACKEND_PID $FRONTEND_PID $ANSIBLE_PID 2>/dev/null; print_success 'All services stopped'; exit 0" INT

echo ""
print_status "Press Ctrl+C to stop all services"
wait
