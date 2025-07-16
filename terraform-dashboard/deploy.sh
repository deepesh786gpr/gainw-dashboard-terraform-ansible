#!/bin/bash

# Terraform Dashboard - Simple Deployment Script
# This script provides an easy way to deploy the Terraform Dashboard

set -e  # Exit on any error

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Configuration
APP_NAME="terraform-dashboard"
BACKEND_PORT=${BACKEND_PORT:-5000}
FRONTEND_PORT=${FRONTEND_PORT:-3000}
NODE_ENV=${NODE_ENV:-production}

# Function to print colored output
print_status() {
    echo -e "${BLUE}[INFO]${NC} $1"
}

print_success() {
    echo -e "${GREEN}[SUCCESS]${NC} $1"
}

print_warning() {
    echo -e "${YELLOW}[WARNING]${NC} $1"
}

print_error() {
    echo -e "${RED}[ERROR]${NC} $1"
}

# Function to check if command exists
command_exists() {
    command -v "$1" >/dev/null 2>&1
}

# Function to check prerequisites
check_prerequisites() {
    print_status "Checking prerequisites..."
    
    # Check Node.js
    if ! command_exists node; then
        print_error "Node.js is not installed. Please install Node.js 18+ and try again."
        exit 1
    fi
    
    NODE_VERSION=$(node -v | cut -d'v' -f2 | cut -d'.' -f1)
    if [ "$NODE_VERSION" -lt 18 ]; then
        print_error "Node.js version 18+ is required. Current version: $(node -v)"
        exit 1
    fi
    
    # Check npm
    if ! command_exists npm; then
        print_error "npm is not installed. Please install npm and try again."
        exit 1
    fi
    
    # Check PM2 (optional)
    if ! command_exists pm2; then
        print_warning "PM2 is not installed. Installing PM2 for process management..."
        npm install -g pm2
    fi
    
    print_success "Prerequisites check completed"
}

# Function to setup environment
setup_environment() {
    print_status "Setting up environment..."
    
    # Create necessary directories
    mkdir -p backend/data
    mkdir -p backend/logs
    mkdir -p backend/terraform-workspace
    
    # Copy environment file if it doesn't exist
    if [ ! -f backend/.env ]; then
        print_status "Creating environment configuration..."
        if [ -f backend/.env.example ]; then
            cp backend/.env.example backend/.env
        else
            # Create basic .env file
            cat > backend/.env << EOF
# Server Configuration
PORT=${BACKEND_PORT}
NODE_ENV=${NODE_ENV}
FRONTEND_URL=http://localhost:${FRONTEND_PORT}

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
        print_warning "Please edit backend/.env with your specific configuration"
    fi
    
    print_success "Environment setup completed"
}

# Function to install dependencies
install_dependencies() {
    print_status "Installing dependencies..."
    
    # Install root dependencies
    if [ ! -d "node_modules" ]; then
        print_status "Installing root dependencies..."
        npm install
    fi
    
    # Install backend dependencies
    if [ ! -d "backend/node_modules" ]; then
        print_status "Installing backend dependencies..."
        cd backend && npm install && cd ..
    fi
    
    # Install frontend dependencies
    if [ ! -d "frontend/node_modules" ]; then
        print_status "Installing frontend dependencies..."
        cd frontend && npm install && cd ..
    fi
    
    print_success "Dependencies installation completed"
}

# Function to build application
build_application() {
    print_status "Building application..."
    
    # Build backend
    print_status "Building backend..."
    cd backend && npm run build && cd ..
    
    # Build frontend
    print_status "Building frontend..."
    cd frontend && npm run build && cd ..
    
    print_success "Application build completed"
}

# Function to create PM2 ecosystem file
create_pm2_config() {
    print_status "Creating PM2 configuration..."
    
    cat > ecosystem.config.js << EOF
module.exports = {
  apps: [
    {
      name: '${APP_NAME}-backend',
      script: './backend/dist/simple-server.js',
      cwd: './backend',
      instances: 1,
      exec_mode: 'fork',
      env: {
        NODE_ENV: 'production',
        PORT: ${BACKEND_PORT}
      },
      log_file: './logs/combined.log',
      out_file: './logs/out.log',
      error_file: './logs/error.log',
      log_date_format: 'YYYY-MM-DD HH:mm:ss Z',
      merge_logs: true,
      max_memory_restart: '1G',
      restart_delay: 4000,
      max_restarts: 10,
      min_uptime: '10s'
    },
    {
      name: '${APP_NAME}-frontend',
      script: 'serve',
      args: '-s build -l ${FRONTEND_PORT}',
      cwd: './frontend',
      instances: 1,
      exec_mode: 'fork',
      env: {
        NODE_ENV: 'production'
      },
      log_file: './logs/frontend-combined.log',
      out_file: './logs/frontend-out.log',
      error_file: './logs/frontend-error.log',
      log_date_format: 'YYYY-MM-DD HH:mm:ss Z'
    }
  ]
};
EOF
    
    print_success "PM2 configuration created"
}

# Function to deploy with PM2
deploy_with_pm2() {
    print_status "Deploying with PM2..."
    
    # Install serve globally if not exists
    if ! command_exists serve; then
        print_status "Installing serve for frontend..."
        npm install -g serve
    fi
    
    # Stop existing processes
    pm2 delete ${APP_NAME}-backend ${APP_NAME}-frontend 2>/dev/null || true
    
    # Start applications
    pm2 start ecosystem.config.js
    
    # Save PM2 configuration
    pm2 save
    
    # Setup PM2 startup (optional)
    print_status "Setting up PM2 startup script..."
    pm2 startup || print_warning "Could not setup PM2 startup script. You may need to run this manually with sudo."
    
    print_success "Deployment with PM2 completed"
}

# Function to deploy in development mode
deploy_development() {
    print_status "Starting in development mode..."
    
    # Start backend in background
    cd backend && npm run dev &
    BACKEND_PID=$!
    
    # Wait a moment for backend to start
    sleep 3
    
    # Start frontend
    cd frontend && npm start &
    FRONTEND_PID=$!
    
    print_success "Development servers started"
    print_status "Backend PID: $BACKEND_PID"
    print_status "Frontend PID: $FRONTEND_PID"
    print_status "Backend URL: http://localhost:${BACKEND_PORT}"
    print_status "Frontend URL: http://localhost:${FRONTEND_PORT}"
    
    # Wait for user input to stop
    echo ""
    print_status "Press Ctrl+C to stop the servers"
    
    # Trap Ctrl+C to cleanup
    trap 'kill $BACKEND_PID $FRONTEND_PID 2>/dev/null; exit' INT
    
    # Wait indefinitely
    wait
}

# Function to show status
show_status() {
    print_status "Application Status:"
    echo ""
    
    if command_exists pm2; then
        pm2 status
        echo ""
        print_status "Logs location:"
        print_status "  Backend: ./backend/logs/"
        print_status "  Frontend: ./frontend/logs/"
        echo ""
        print_status "Useful PM2 commands:"
        print_status "  pm2 logs ${APP_NAME}-backend    # View backend logs"
        print_status "  pm2 logs ${APP_NAME}-frontend   # View frontend logs"
        print_status "  pm2 restart ${APP_NAME}-backend # Restart backend"
        print_status "  pm2 restart ${APP_NAME}-frontend # Restart frontend"
        print_status "  pm2 stop all                    # Stop all processes"
    else
        print_warning "PM2 not available. Cannot show process status."
    fi
    
    echo ""
    print_status "Application URLs:"
    print_status "  Frontend: http://localhost:${FRONTEND_PORT}"
    print_status "  Backend API: http://localhost:${BACKEND_PORT}"
    print_status "  Health Check: http://localhost:${BACKEND_PORT}/api/health"
}

# Function to stop application
stop_application() {
    print_status "Stopping application..."
    
    if command_exists pm2; then
        pm2 delete ${APP_NAME}-backend ${APP_NAME}-frontend 2>/dev/null || true
        print_success "Application stopped"
    else
        print_warning "PM2 not available. Please manually stop any running processes."
    fi
}

# Main deployment function
main() {
    echo ""
    echo "🚀 Terraform Dashboard Deployment Script"
    echo "========================================"
    echo ""
    
    case "${1:-deploy}" in
        "deploy"|"production"|"prod")
            check_prerequisites
            setup_environment
            install_dependencies
            build_application
            create_pm2_config
            deploy_with_pm2
            show_status
            ;;
        "dev"|"development")
            check_prerequisites
            setup_environment
            install_dependencies
            deploy_development
            ;;
        "status")
            show_status
            ;;
        "stop")
            stop_application
            ;;
        "restart")
            stop_application
            sleep 2
            main deploy
            ;;
        "help"|"-h"|"--help")
            echo "Usage: $0 [command]"
            echo ""
            echo "Commands:"
            echo "  deploy, production, prod  Deploy in production mode with PM2"
            echo "  dev, development          Start in development mode"
            echo "  status                    Show application status"
            echo "  stop                      Stop the application"
            echo "  restart                   Restart the application"
            echo "  help                      Show this help message"
            echo ""
            echo "Environment Variables:"
            echo "  BACKEND_PORT             Backend port (default: 5000)"
            echo "  FRONTEND_PORT            Frontend port (default: 3000)"
            echo "  NODE_ENV                 Node environment (default: production)"
            echo ""
            ;;
        *)
            print_error "Unknown command: $1"
            echo "Use '$0 help' for usage information."
            exit 1
            ;;
    esac
}

# Run main function with all arguments
main "$@"
