# 🚀 Manual Deployment to EC2 Server

## Prerequisites
- SSH key file for EC2 instance
- EC2 instance running Ubuntu
- Security groups allowing SSH (22), HTTP (3000, 5000, 5001)

## Step 1: Prepare SSH Key

```bash
# Find your SSH key file
find /Users/mac -name "*.pem" -type f 2>/dev/null | grep -i dashboard

# Copy to project directory (replace with actual key name)
cp "/Users/mac/Downloads/your-key-name.pem" /Users/mac/new-dashboard/dasboard.io.pem

# Set correct permissions
chmod 400 /Users/mac/new-dashboard/dasboard.io.pem
```

## Step 2: Test SSH Connection

```bash
ssh -i dasboard.io.pem ubuntu@ec2-18-204-218-19.compute-1.amazonaws.com
```

## Step 3: Upload Files to Server

```bash
# Create remote directory
ssh -i dasboard.io.pem ubuntu@ec2-18-204-218-19.compute-1.amazonaws.com "mkdir -p /home/ubuntu/terraform-dashboard"

# Upload terraform-dashboard
rsync -avz -e "ssh -i dasboard.io.pem" --exclude='node_modules' --exclude='dist' --exclude='.git' terraform-dashboard/ ubuntu@ec2-18-204-218-19.compute-1.amazonaws.com:/home/ubuntu/terraform-dashboard/

# Upload ansible-aws-playbooks
rsync -avz -e "ssh -i dasboard.io.pem" --exclude='.git' ansible-aws-playbooks/ ubuntu@ec2-18-204-218-19.compute-1.amazonaws.com:/home/ubuntu/ansible-aws-playbooks/
```

## Step 4: Install Dependencies on Server

```bash
# SSH to server
ssh -i dasboard.io.pem ubuntu@ec2-18-204-218-19.compute-1.amazonaws.com

# Update system
sudo apt update

# Install Node.js 18.x
curl -fsSL https://deb.nodesource.com/setup_18.x | sudo -E bash -
sudo apt-get install -y nodejs

# Install Python and pip
sudo apt-get install -y python3 python3-pip python3-venv

# Install Ansible
sudo apt-get install -y software-properties-common
sudo add-apt-repository --yes --update ppa:ansible/ansible
sudo apt-get install -y ansible

# Install AWS CLI
curl "https://awscli.amazonaws.com/awscli-exe-linux-x86_64.zip" -o "awscliv2.zip"
unzip awscliv2.zip
sudo ./aws/install
rm -rf aws awscliv2.zip

# Install PM2
sudo npm install -g pm2
```

## Step 5: Setup Application

```bash
# Install backend dependencies
cd /home/ubuntu/terraform-dashboard/backend
npm install
npm run build

# Install frontend dependencies
cd ../frontend
npm install
npm run build

# Setup Ansible
cd /home/ubuntu/ansible-aws-playbooks
pip3 install --user -r requirements.txt
ansible-galaxy collection install -r requirements.yml

# Create environment file
cd /home/ubuntu/terraform-dashboard
cat > .env << 'EOF'
NODE_ENV=production
PORT=5000
FRONTEND_URL=http://ec2-18-204-218-19.compute-1.amazonaws.com:3000
DATABASE_PATH=/home/ubuntu/terraform-dashboard/data/terraform-dashboard.db
JWT_SECRET=your-super-secret-jwt-key-$(openssl rand -hex 32)
AWS_REGION=us-east-1
TERRAFORM_WORKING_DIR=/home/ubuntu/terraform-dashboard/terraform-workspace
ANSIBLE_PLAYBOOKS_DIR=/home/ubuntu/ansible-aws-playbooks
LOG_LEVEL=info
EOF

# Create directories
mkdir -p data logs terraform-workspace
```

## Step 6: Start Services

```bash
# Stop any existing services
pm2 delete all 2>/dev/null || true

# Start backend
cd /home/ubuntu/terraform-dashboard/backend
pm2 start npm --name "terraform-backend" -- start

# Start frontend
cd ../frontend
pm2 start npm --name "terraform-frontend" -- start

# Start Ansible API (create simple server)
cd /home/ubuntu/terraform-dashboard/backend
cat > ansible-api-simple.js << 'EOF'
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
  return process.env.ANSIBLE_PLAYBOOKS_DIR || '/home/ubuntu/ansible-aws-playbooks';
};

app.get('/health', async (req, res) => {
  const ansibleDir = getAnsibleDir();
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
});

app.get('/playbooks', (req, res) => {
  res.json({
    success: true,
    playbooks: SUPPORTED_PLAYBOOKS
  });
});

app.listen(PORT, () => {
  console.log(`🎭 Ansible API Server running on port ${PORT}`);
});
EOF

pm2 start ansible-api-simple.js --name "ansible-api"

# Save PM2 configuration
pm2 save
pm2 startup

# Check status
pm2 status
```

## Step 7: Configure Security Groups

Make sure your EC2 security group allows:
- SSH (22) from your IP
- HTTP (3000) for frontend
- HTTP (5000) for backend API
- HTTP (5001) for Ansible API

## Step 8: Test Application

```bash
# Test endpoints
curl http://ec2-18-204-218-19.compute-1.amazonaws.com:5000/health
curl http://ec2-18-204-218-19.compute-1.amazonaws.com:5001/health

# Access frontend
# http://ec2-18-204-218-19.compute-1.amazonaws.com:3000
```

## Step 9: Configure AWS Credentials (Optional)

```bash
# On the server, configure AWS credentials
aws configure
# Enter your AWS Access Key ID, Secret Access Key, and region
```

## Useful Commands

```bash
# Check service status
pm2 status

# View logs
pm2 logs

# Restart services
pm2 restart all

# Stop services
pm2 stop all

# SSH to server
ssh -i dasboard.io.pem ubuntu@ec2-18-204-218-19.compute-1.amazonaws.com
```

## Troubleshooting

1. **Services not starting**: Check logs with `pm2 logs`
2. **Port conflicts**: Make sure ports 3000, 5000, 5001 are available
3. **Permission issues**: Ensure correct file permissions
4. **Network issues**: Check security group settings
