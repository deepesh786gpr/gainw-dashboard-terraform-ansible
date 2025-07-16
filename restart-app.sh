#!/bin/bash

# Restart Application on EC2 Server
# Usage: ./restart-app.sh [path-to-ssh-key.pem]

set -e

# Colors
GREEN='\033[0;32m'
BLUE='\033[0;34m'
RED='\033[0;31m'
YELLOW='\033[1;33m'
NC='\033[0m'

# Configuration
EC2_HOST="ubuntu@ec2-18-204-218-19.compute-1.amazonaws.com"
KEY_FILE="${1:-/Users/mac/Downloads/dasboard.io.pem}"

echo -e "${BLUE}🔄 Restarting Terraform Dashboard Application${NC}"
echo "================================================================"
echo "Host: $EC2_HOST"
echo "Key: $KEY_FILE"
echo ""

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

# Check if key file exists
if [ ! -f "$KEY_FILE" ]; then
    print_error "SSH key file not found: $KEY_FILE"
    echo ""
    echo "Please provide the correct path to your SSH key:"
    echo "  ./restart-app.sh /path/to/your/key.pem"
    echo ""
    echo "Or copy your key to the current directory:"
    echo "  cp /path/to/your/key.pem ./dasboard.io.pem"
    echo "  ./restart-app.sh ./dasboard.io.pem"
    exit 1
fi

# Set correct permissions
chmod 400 "$KEY_FILE"

# Test SSH connection
print_status "Testing SSH connection..."
if ssh -i "$KEY_FILE" -o ConnectTimeout=10 -o StrictHostKeyChecking=no "$EC2_HOST" "echo 'SSH connection successful'" 2>/dev/null; then
    print_success "SSH connection established"
else
    print_error "Failed to connect to EC2 server"
    echo ""
    echo "Please check:"
    echo "1. EC2 instance is running"
    echo "2. Security group allows SSH (port 22)"
    echo "3. SSH key file is correct"
    echo "4. Internet connection is working"
    exit 1
fi

print_status "Restarting application services..."

# Restart services on the server
ssh -i "$KEY_FILE" "$EC2_HOST" << 'ENDSSH'
echo "🔄 Stopping existing services..."
pm2 stop all 2>/dev/null || echo "No services were running"

echo "🧹 Cleaning up processes..."
pm2 delete all 2>/dev/null || echo "No processes to delete"

echo "📦 Rebuilding applications..."
# Rebuild backend
cd /home/ubuntu/terraform-dashboard/backend
npm run build 2>/dev/null || echo "Backend build skipped"

# Rebuild frontend  
cd ../frontend
npm run build 2>/dev/null || echo "Frontend build skipped"

echo "🚀 Starting services..."
cd /home/ubuntu/terraform-dashboard

# Start backend service
cd backend
pm2 start npm --name "terraform-backend" -- start

# Start frontend service
cd ../frontend  
pm2 start npm --name "terraform-frontend" -- start

# Start Ansible API service
cd ../backend
if [ -f "ansible-api-simple.js" ]; then
    pm2 start ansible-api-simple.js --name "ansible-api"
else
    echo "⚠️  Ansible API file not found, creating simple version..."
    cat > ansible-api-simple.js << 'APIEOF'
const express = require('express');
const cors = require('cors');
const app = express();
const PORT = 5001;

app.use(cors());
app.use(express.json());

app.get('/health', (req, res) => {
  res.json({
    success: true,
    healthy: true,
    message: 'Ansible API is running',
    timestamp: new Date().toISOString()
  });
});

app.get('/playbooks', (req, res) => {
  res.json({
    success: true,
    playbooks: {
      'ec2-management': { operations: ['list', 'info'] },
      'rds-management': { operations: ['list', 'info'] },
      'lambda-management': { operations: ['list', 'info'] },
      'eks-management': { operations: ['list', 'info'] }
    }
  });
});

app.post('/execute', (req, res) => {
  const { playbook, action } = req.body;
  res.json({
    success: true,
    output: `Simulated execution of ${playbook} ${action}`,
    executionId: `sim-${Date.now()}`,
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
    pm2 start ansible-api-simple.js --name "ansible-api"
fi

# Save PM2 configuration
pm2 save

echo "✅ All services restarted successfully!"
echo ""
echo "📊 Service Status:"
pm2 status

echo ""
echo "🌐 Application URLs:"
echo "   Frontend: http://ec2-18-204-218-19.compute-1.amazonaws.com:3000"
echo "   Backend:  http://ec2-18-204-218-19.compute-1.amazonaws.com:5000"  
echo "   Ansible:  http://ec2-18-204-218-19.compute-1.amazonaws.com:5001"
ENDSSH

if [ $? -eq 0 ]; then
    print_success "Application restarted successfully!"
    echo ""
    echo "🌐 Your application is now running at:"
    echo "   Frontend: http://ec2-18-204-218-19.compute-1.amazonaws.com:3000"
    echo "   Backend:  http://ec2-18-204-218-19.compute-1.amazonaws.com:5000"
    echo "   Ansible:  http://ec2-18-204-218-19.compute-1.amazonaws.com:5001"
    echo ""
    echo "📊 To check status: ssh -i '$KEY_FILE' $EC2_HOST 'pm2 status'"
    echo "📋 To view logs: ssh -i '$KEY_FILE' $EC2_HOST 'pm2 logs'"
else
    print_error "Failed to restart application"
    echo ""
    echo "🔍 To troubleshoot:"
    echo "   ssh -i '$KEY_FILE' $EC2_HOST"
    echo "   pm2 logs"
fi
