#!/bin/bash

# Quick Deploy Script for EC2
# Usage: ./quick-deploy.sh path-to-key.pem

set -e

# Colors
GREEN='\033[0;32m'
BLUE='\033[0;34m'
RED='\033[0;31m'
NC='\033[0m'

KEY_FILE="$1"
EC2_HOST="ubuntu@ec2-18-204-218-19.compute-1.amazonaws.com"

if [ -z "$KEY_FILE" ]; then
    echo -e "${RED}Usage: $0 path-to-key.pem${NC}"
    echo "Example: $0 /Users/mac/Downloads/dasboard.io.pem"
    exit 1
fi

if [ ! -f "$KEY_FILE" ]; then
    echo -e "${RED}Key file not found: $KEY_FILE${NC}"
    exit 1
fi

chmod 400 "$KEY_FILE"

echo -e "${BLUE}🚀 Quick Deploy to EC2${NC}"
echo "Key: $KEY_FILE"
echo "Host: $EC2_HOST"

# Test connection
echo -e "${BLUE}Testing SSH connection...${NC}"
ssh -i "$KEY_FILE" -o ConnectTimeout=10 "$EC2_HOST" "echo 'Connected successfully'"

# Upload files
echo -e "${BLUE}Uploading files...${NC}"
ssh -i "$KEY_FILE" "$EC2_HOST" "mkdir -p /home/ubuntu/terraform-dashboard /home/ubuntu/ansible-aws-playbooks"

rsync -avz -e "ssh -i '$KEY_FILE'" --exclude='node_modules' --exclude='dist' --exclude='.git' terraform-dashboard/ "$EC2_HOST:/home/ubuntu/terraform-dashboard/"

rsync -avz -e "ssh -i '$KEY_FILE'" --exclude='.git' ansible-aws-playbooks/ "$EC2_HOST:/home/ubuntu/ansible-aws-playbooks/"

# Install and setup
echo -e "${BLUE}Installing dependencies and setting up...${NC}"
ssh -i "$KEY_FILE" "$EC2_HOST" << 'ENDSSH'
# Update system
sudo apt update

# Install Node.js if not present
if ! command -v node &> /dev/null; then
    curl -fsSL https://deb.nodesource.com/setup_18.x | sudo -E bash -
    sudo apt-get install -y nodejs
fi

# Install Python and Ansible if not present
if ! command -v ansible &> /dev/null; then
    sudo apt-get install -y python3 python3-pip software-properties-common
    sudo add-apt-repository --yes --update ppa:ansible/ansible
    sudo apt-get install -y ansible
fi

# Install PM2 if not present
if ! command -v pm2 &> /dev/null; then
    sudo npm install -g pm2
fi

# Setup backend
cd /home/ubuntu/terraform-dashboard/backend
npm install
npm run build

# Setup frontend
cd ../frontend
npm install
npm run build

# Setup Ansible
cd /home/ubuntu/ansible-aws-playbooks
pip3 install --user -r requirements.txt || true
ansible-galaxy collection install -r requirements.yml || true

# Create environment file
cd /home/ubuntu/terraform-dashboard
cat > .env << 'EOF'
NODE_ENV=production
PORT=5000
FRONTEND_URL=http://ec2-18-204-218-19.compute-1.amazonaws.com:3000
DATABASE_PATH=/home/ubuntu/terraform-dashboard/data/terraform-dashboard.db
JWT_SECRET=terraform-dashboard-secret-$(date +%s)
AWS_REGION=us-east-1
TERRAFORM_WORKING_DIR=/home/ubuntu/terraform-dashboard/terraform-workspace
ANSIBLE_PLAYBOOKS_DIR=/home/ubuntu/ansible-aws-playbooks
LOG_LEVEL=info
EOF

mkdir -p data logs terraform-workspace

# Create simple Ansible API server
cd /home/ubuntu/terraform-dashboard/backend
cat > ansible-api-simple.js << 'APIEOF'
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
  'ec2-management': { path: 'playbooks/ec2-management.yml', operations: ['list', 'info'] },
  'rds-management': { path: 'playbooks/rds-management.yml', operations: ['list', 'info'] },
  'lambda-management': { path: 'playbooks/lambda-management.yml', operations: ['list', 'info'] },
  'eks-management': { path: 'playbooks/eks-management.yml', operations: ['list', 'info'] }
};

app.get('/health', (req, res) => {
  const ansibleDir = '/home/ubuntu/ansible-aws-playbooks';
  const checks = {
    ansible_available: fs.existsSync('/usr/bin/ansible-playbook'),
    playbooks_directory: fs.existsSync(ansibleDir),
    playbooks_found: Object.keys(SUPPORTED_PLAYBOOKS).map(name => ({
      name,
      exists: fs.existsSync(path.join(ansibleDir, SUPPORTED_PLAYBOOKS[name].path))
    }))
  };
  
  res.json({
    success: true,
    healthy: checks.ansible_available && checks.playbooks_directory,
    checks,
    ansible_directory: ansibleDir
  });
});

app.get('/playbooks', (req, res) => {
  res.json({ success: true, playbooks: SUPPORTED_PLAYBOOKS });
});

app.post('/execute', async (req, res) => {
  const { playbook, action } = req.body;
  const executionId = `test-${Date.now()}`;
  
  res.json({
    success: true,
    output: `Test execution of ${playbook} ${action}`,
    executionId,
    timestamp: new Date().toISOString(),
    duration: 1000
  });
});

app.get('/executions', (req, res) => {
  res.json({ success: true, executions: [] });
});

app.listen(PORT, () => {
  console.log(`🎭 Ansible API Server running on port ${PORT}`);
});
APIEOF

# Stop existing services
pm2 delete all 2>/dev/null || true

# Start services
pm2 start npm --name "terraform-backend" --cwd /home/ubuntu/terraform-dashboard/backend -- start
pm2 start npm --name "terraform-frontend" --cwd /home/ubuntu/terraform-dashboard/frontend -- start
pm2 start ansible-api-simple.js --name "ansible-api" --cwd /home/ubuntu/terraform-dashboard/backend

pm2 save
pm2 startup ubuntu -u ubuntu --hp /home/ubuntu

echo "✅ Deployment completed!"
echo "Frontend: http://ec2-18-204-218-19.compute-1.amazonaws.com:3000"
echo "Backend: http://ec2-18-204-218-19.compute-1.amazonaws.com:5000"
echo "Ansible: http://ec2-18-204-218-19.compute-1.amazonaws.com:5001"
ENDSSH

echo -e "${GREEN}✅ Deployment completed successfully!${NC}"
echo ""
echo "🌐 Application URLs:"
echo "   Frontend: http://ec2-18-204-218-19.compute-1.amazonaws.com:3000"
echo "   Backend:  http://ec2-18-204-218-19.compute-1.amazonaws.com:5000"
echo "   Ansible:  http://ec2-18-204-218-19.compute-1.amazonaws.com:5001"
echo ""
echo "📊 Check status: ssh -i '$KEY_FILE' $EC2_HOST 'pm2 status'"
