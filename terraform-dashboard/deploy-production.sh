#!/bin/bash

# Production Deployment Script
# Builds and serves the application without memory issues

set -e

# Colors
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m'

echo -e "${BLUE}🚀 Terraform Dashboard - Production Deployment${NC}"
echo "================================================="
echo ""

# Check prerequisites
check_prerequisites() {
    echo -e "${BLUE}📋 Checking prerequisites...${NC}"
    
    if ! command -v node >/dev/null 2>&1; then
        echo -e "${RED}❌ Node.js is not installed${NC}"
        exit 1
    fi
    
    if ! command -v npm >/dev/null 2>&1; then
        echo -e "${RED}❌ npm is not installed${NC}"
        exit 1
    fi
    
    # Install PM2 if not available
    if ! command -v pm2 >/dev/null 2>&1; then
        echo -e "${YELLOW}⚙️  Installing PM2...${NC}"
        npm install -g pm2
    fi
    
    # Install serve if not available
    if ! command -v serve >/dev/null 2>&1; then
        echo -e "${YELLOW}⚙️  Installing serve...${NC}"
        npm install -g serve
    fi
    
    echo -e "${GREEN}✅ Prerequisites check completed${NC}"
}

# Install dependencies
install_dependencies() {
    echo -e "${BLUE}📦 Installing dependencies...${NC}"
    
    # Root dependencies
    if [ ! -d "node_modules" ]; then
        npm install
    fi
    
    # Backend dependencies
    if [ ! -d "backend/node_modules" ]; then
        echo -e "${BLUE}   Installing backend dependencies...${NC}"
        cd backend && npm install && cd ..
    fi
    
    # Frontend dependencies
    if [ ! -d "frontend/node_modules" ]; then
        echo -e "${BLUE}   Installing frontend dependencies...${NC}"
        cd frontend && npm install && cd ..
    fi
    
    echo -e "${GREEN}✅ Dependencies installed${NC}"
}

# Setup environment
setup_environment() {
    echo -e "${BLUE}⚙️  Setting up environment...${NC}"
    
    # Create directories
    mkdir -p backend/data backend/logs backend/terraform-workspace
    
    # Create .env if it doesn't exist
    if [ ! -f "backend/.env" ]; then
        cat > backend/.env << EOF
# Server Configuration
PORT=5000
NODE_ENV=production
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
    
    echo -e "${GREEN}✅ Environment setup completed${NC}"
}

# Build applications
build_applications() {
    echo -e "${BLUE}🔨 Building applications...${NC}"
    
    # Build backend
    echo -e "${BLUE}   Building backend...${NC}"
    cd backend && npm run build && cd ..
    
    # Build frontend with memory optimization
    echo -e "${BLUE}   Building frontend (this may take a while)...${NC}"
    cd frontend && npm run build:low-memory && cd ..
    
    echo -e "${GREEN}✅ Applications built successfully${NC}"
}

# Create PM2 ecosystem
create_pm2_config() {
    echo -e "${BLUE}⚙️  Creating PM2 configuration...${NC}"
    
    cat > ecosystem.config.js << EOF
module.exports = {
  apps: [
    {
      name: 'terraform-dashboard-backend',
      script: './backend/dist/simple-server.js',
      instances: 1,
      exec_mode: 'fork',
      env: {
        NODE_ENV: 'production',
        PORT: 5000
      },
      log_file: './backend/logs/combined.log',
      out_file: './backend/logs/out.log',
      error_file: './backend/logs/error.log',
      log_date_format: 'YYYY-MM-DD HH:mm:ss Z',
      merge_logs: true,
      max_memory_restart: '1G',
      restart_delay: 4000,
      max_restarts: 10,
      min_uptime: '10s'
    },
    {
      name: 'terraform-dashboard-frontend',
      script: 'serve',
      args: '-s build -l 3000',
      cwd: './frontend',
      instances: 1,
      exec_mode: 'fork',
      env: {
        NODE_ENV: 'production'
      },
      log_file: './backend/logs/frontend-combined.log',
      out_file: './backend/logs/frontend-out.log',
      error_file: './backend/logs/frontend-error.log',
      log_date_format: 'YYYY-MM-DD HH:mm:ss Z'
    }
  ]
};
EOF
    
    echo -e "${GREEN}✅ PM2 configuration created${NC}"
}

# Deploy with PM2
deploy_with_pm2() {
    echo -e "${BLUE}🚀 Deploying with PM2...${NC}"
    
    # Stop existing processes
    pm2 delete terraform-dashboard-backend terraform-dashboard-frontend 2>/dev/null || true
    
    # Start applications
    pm2 start ecosystem.config.js
    
    # Save PM2 configuration
    pm2 save
    
    echo -e "${GREEN}✅ Deployment completed${NC}"
}

# Show status
show_status() {
    echo ""
    echo -e "${GREEN}🎉 Terraform Dashboard deployed successfully!${NC}"
    echo ""
    echo -e "${BLUE}📊 Application Status:${NC}"
    pm2 status
    echo ""
    echo -e "${BLUE}🌐 Access URLs:${NC}"
    echo "   • Frontend: http://localhost:3000"
    echo "   • Backend API: http://localhost:5000"
    echo "   • Health Check: http://localhost:5000/api/health"
    echo ""
    echo -e "${BLUE}🔐 Login Credentials:${NC}"
    echo "   • Username: admin"
    echo "   • Password: admin123"
    echo ""
    echo -e "${BLUE}📋 Useful Commands:${NC}"
    echo "   • pm2 logs terraform-dashboard-backend   # View backend logs"
    echo "   • pm2 logs terraform-dashboard-frontend  # View frontend logs"
    echo "   • pm2 restart all                        # Restart all services"
    echo "   • pm2 stop all                           # Stop all services"
    echo "   • pm2 delete all                         # Remove all services"
    echo ""
}

# Main execution
main() {
    check_prerequisites
    setup_environment
    install_dependencies
    build_applications
    create_pm2_config
    deploy_with_pm2
    show_status
}

# Handle script arguments
case "${1:-deploy}" in
    "deploy"|"production"|"prod")
        main
        ;;
    "backend-only")
        check_prerequisites
        setup_environment
        install_dependencies
        echo -e "${BLUE}🚀 Starting backend only...${NC}"
        cd backend && npm run build && cd ..
        pm2 delete terraform-dashboard-backend 2>/dev/null || true
        pm2 start backend/dist/simple-server.js --name terraform-dashboard-backend
        pm2 save
        echo -e "${GREEN}✅ Backend started on http://localhost:5000${NC}"
        ;;
    "stop")
        pm2 delete terraform-dashboard-backend terraform-dashboard-frontend 2>/dev/null || true
        echo -e "${GREEN}✅ Application stopped${NC}"
        ;;
    "status")
        pm2 status
        ;;
    "help"|"-h"|"--help")
        echo "Usage: $0 [command]"
        echo ""
        echo "Commands:"
        echo "  deploy, production, prod  Full production deployment"
        echo "  backend-only              Start only the backend (for testing)"
        echo "  stop                      Stop the application"
        echo "  status                    Show application status"
        echo "  help                      Show this help"
        ;;
    *)
        echo -e "${RED}❌ Unknown command: $1${NC}"
        echo "Use '$0 help' for usage information."
        exit 1
        ;;
esac
