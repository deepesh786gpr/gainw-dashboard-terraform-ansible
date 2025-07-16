#!/bin/bash

# Simple Backend-Only Start Script
# For testing when frontend has memory issues

set -e

# Colors
GREEN='\033[0;32m'
BLUE='\033[0;34m'
YELLOW='\033[1;33m'
NC='\033[0m'

echo -e "${BLUE}🚀 Starting Terraform Dashboard Backend Only${NC}"
echo "=============================================="
echo ""

# Check if we're in the right directory
if [ ! -d "backend" ]; then
    echo -e "${YELLOW}⚠️  Please run this script from the terraform-dashboard directory${NC}"
    exit 1
fi

# Install backend dependencies if needed
if [ ! -d "backend/node_modules" ]; then
    echo -e "${BLUE}📦 Installing backend dependencies...${NC}"
    cd backend && npm install && cd ..
fi

# Create .env if it doesn't exist
if [ ! -f "backend/.env" ]; then
    echo -e "${BLUE}⚙️  Creating environment configuration...${NC}"
    cat > backend/.env << EOF
# Server Configuration
PORT=5000
NODE_ENV=development
FRONTEND_URL=http://localhost:3000

# Database Configuration
DATABASE_PATH=./data/terraform-dashboard.db

# JWT Configuration
JWT_SECRET=$(openssl rand -base64 32)

# AWS Configuration
AWS_REGION=us-east-1
AWS_DEFAULT_REGION=us-east-1
AWS_PROFILE=default

# Terraform Configuration
TERRAFORM_PATH=/usr/local/bin/terraform
TERRAGRUNT_PATH=/usr/local/bin/terragrunt
TERRAFORM_WORKING_DIR=./terraform-workspace

# Security Configuration
RATE_LIMIT_WINDOW_MS=900000
RATE_LIMIT_MAX_REQUESTS=100
SESSION_TIMEOUT_MINUTES=60

# Logging Configuration
LOG_LEVEL=info
LOG_FILE=./logs/terraform-dashboard.log
EOF
fi

# Create necessary directories
mkdir -p backend/data backend/logs backend/terraform-workspace

echo -e "${GREEN}✅ Starting backend server...${NC}"
echo ""
echo -e "${BLUE}📋 Access Information:${NC}"
echo "   • Backend API: http://localhost:5000"
echo "   • Health Check: http://localhost:5000/api/health"
echo "   • Test Page: Open test-github-ansible.html in browser"
echo ""
echo -e "${BLUE}🔐 Login Credentials:${NC}"
echo "   • Username: admin"
echo "   • Password: admin123"
echo ""
echo -e "${YELLOW}💡 Note: Frontend not started to avoid memory issues${NC}"
echo "   You can test the API using the test page or curl commands"
echo ""
echo -e "${GREEN}🚀 Starting backend...${NC}"

# Start backend
cd backend && npm run dev
