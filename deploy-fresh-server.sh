#!/bin/bash

# =============================================================================
# TERRAFORM DASHBOARD - FRESH SERVER DEPLOYMENT SCRIPT
# =============================================================================
# This script deploys the Terraform Dashboard on a fresh Ubuntu server
# Tested on: Ubuntu 20.04 LTS, Ubuntu 22.04 LTS
# =============================================================================

set -e  # Exit on any error

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
PURPLE='\033[0;35m'
CYAN='\033[0;36m'
NC='\033[0m' # No Color

# Configuration
APP_NAME="terraform-dashboard"
APP_USER="ubuntu"
APP_DIR="/home/$APP_USER/$APP_NAME"
GITHUB_REPO="https://github.com/deepesh786gpr/new-dashboard.git"
NODE_VERSION="20"
PM2_APP_NAME="terraform-dashboard"

# Logging function
log() {
    echo -e "${GREEN}[$(date +'%Y-%m-%d %H:%M:%S')] $1${NC}"
}

error() {
    echo -e "${RED}[ERROR] $1${NC}" >&2
}

warning() {
    echo -e "${YELLOW}[WARNING] $1${NC}"
}

info() {
    echo -e "${BLUE}[INFO] $1${NC}"
}

# Check if running as root
check_root() {
    if [[ $EUID -eq 0 ]]; then
        error "This script should not be run as root. Please run as ubuntu user."
        exit 1
    fi
}

# Print banner
print_banner() {
    echo -e "${PURPLE}"
    echo "============================================================"
    echo "🚀 TERRAFORM DASHBOARD - FRESH SERVER DEPLOYMENT"
    echo "============================================================"
    echo "📅 Date: $(date)"
    echo "🖥️ Server: $(hostname)"
    echo "👤 User: $(whoami)"
    echo "📂 Target: $APP_DIR"
    echo "============================================================"
    echo -e "${NC}"
}

# Update system packages
update_system() {
    log "📦 Updating system packages..."
    sudo apt update
    sudo apt upgrade -y
    sudo apt install -y curl wget git unzip software-properties-common build-essential
}

# Install Node.js
install_nodejs() {
    log "📦 Installing Node.js $NODE_VERSION..."
    
    # Install Node.js using NodeSource repository
    curl -fsSL https://deb.nodesource.com/setup_${NODE_VERSION}.x | sudo -E bash -
    sudo apt-get install -y nodejs
    
    # Verify installation
    node_version=$(node --version)
    npm_version=$(npm --version)
    log "✅ Node.js installed: $node_version"
    log "✅ npm installed: $npm_version"
    
    # Install global packages
    sudo npm install -g pm2 serve
    log "✅ PM2 and serve installed globally"
}

# Install additional tools
install_tools() {
    log "🔧 Installing additional tools..."
    
    # Install jq for JSON processing
    sudo apt install -y jq
    
    # Install nginx (optional, for reverse proxy)
    sudo apt install -y nginx
    
    # Install certbot for SSL (optional)
    sudo apt install -y certbot python3-certbot-nginx
    
    log "✅ Additional tools installed"
}

# Clone repository
clone_repository() {
    log "📥 Cloning repository..."
    
    # Remove existing directory if it exists
    if [ -d "$APP_DIR" ]; then
        warning "Directory $APP_DIR already exists. Backing up..."
        sudo mv "$APP_DIR" "${APP_DIR}.backup.$(date +%Y%m%d_%H%M%S)"
    fi
    
    # Clone the repository
    git clone "$GITHUB_REPO" "$APP_DIR"
    cd "$APP_DIR"
    
    log "✅ Repository cloned to $APP_DIR"
}

# Install dependencies
install_dependencies() {
    log "📦 Installing application dependencies..."
    
    # Backend dependencies
    cd "$APP_DIR/terraform-dashboard/backend"
    npm install
    log "✅ Backend dependencies installed"
    
    # Frontend dependencies
    cd "$APP_DIR/terraform-dashboard/frontend"
    npm install
    log "✅ Frontend dependencies installed"
}

# Configure environment
configure_environment() {
    log "⚙️ Configuring environment..."
    
    # Backend environment
    cd "$APP_DIR/terraform-dashboard/backend"
    if [ ! -f ".env" ]; then
        cp .env.example .env
        log "✅ Backend .env file created from example"
    else
        log "ℹ️ Backend .env file already exists"
    fi
    
    # Frontend environment
    cd "$APP_DIR/terraform-dashboard/frontend"
    if [ ! -f ".env" ]; then
        cat > .env << EOF
REACT_APP_API_URL=http://localhost:5000
REACT_APP_ANSIBLE_API_URL=http://localhost:5001
GENERATE_SOURCEMAP=false
TSC_COMPILE_ON_ERROR=true
ESLINT_NO_DEV_ERRORS=true
SKIP_PREFLIGHT_CHECK=true
REACT_APP_ENVIRONMENT=production
EOF
        log "✅ Frontend .env file created"
    else
        log "ℹ️ Frontend .env file already exists"
    fi
}

# Build frontend
build_frontend() {
    log "🏗️ Building frontend for production..."
    
    cd "$APP_DIR/terraform-dashboard/frontend"
    npm run build
    
    log "✅ Frontend built successfully"
}

# Setup PM2 configuration
setup_pm2() {
    log "⚙️ Setting up PM2 configuration..."
    
    cd "$APP_DIR/terraform-dashboard"
    
    # Create PM2 ecosystem file
    cat > ecosystem.config.js << EOF
module.exports = {
  apps: [
    {
      name: 'terraform-dashboard-backend',
      script: './backend/test-server.js',
      cwd: './backend',
      instances: 1,
      exec_mode: 'fork',
      env: {
        NODE_ENV: 'production',
        PORT: 5000
      },
      error_file: './logs/backend-error.log',
      out_file: './logs/backend-out.log',
      log_file: './logs/backend-combined.log',
      time: true,
      max_memory_restart: '1G',
      restart_delay: 4000
    },
    {
      name: 'terraform-dashboard-ansible',
      script: './backend/ansible-api-server.js',
      cwd: './backend',
      instances: 1,
      exec_mode: 'fork',
      env: {
        NODE_ENV: 'production',
        PORT: 5001,
        ANSIBLE_PLAYBOOKS_DIR: '../ansible-aws-playbooks'
      },
      error_file: './logs/ansible-error.log',
      out_file: './logs/ansible-out.log',
      log_file: './logs/ansible-combined.log',
      time: true,
      max_memory_restart: '512M',
      restart_delay: 4000
    },
    {
      name: 'terraform-dashboard-frontend',
      script: 'serve',
      args: '-s build -l 3000 -H 0.0.0.0',
      cwd: './frontend',
      instances: 1,
      exec_mode: 'fork',
      env: {
        NODE_ENV: 'production'
      },
      error_file: './logs/frontend-error.log',
      out_file: './logs/frontend-out.log',
      log_file: './logs/frontend-combined.log',
      time: true,
      max_memory_restart: '512M'
    }
  ]
};
EOF
    
    # Create logs directory
    mkdir -p logs
    
    log "✅ PM2 configuration created"
}

# Configure firewall
configure_firewall() {
    log "🔥 Configuring firewall..."
    
    # Enable UFW
    sudo ufw --force enable
    
    # Allow SSH
    sudo ufw allow ssh
    
    # Allow HTTP and HTTPS
    sudo ufw allow 80
    sudo ufw allow 443
    
    # Allow application ports
    sudo ufw allow 3000  # Frontend
    sudo ufw allow 5000  # Backend
    sudo ufw allow 5001  # Ansible API
    
    log "✅ Firewall configured"
}

# Start services
start_services() {
    log "🚀 Starting services with PM2..."
    
    cd "$APP_DIR/terraform-dashboard"
    
    # Start PM2 services
    pm2 start ecosystem.config.js
    
    # Save PM2 configuration
    pm2 save
    
    # Setup PM2 startup script
    pm2 startup | tail -1 | sudo bash
    
    log "✅ Services started and configured for auto-start"
}

# Run tests
run_tests() {
    log "🧪 Running application tests..."
    
    cd "$APP_DIR/terraform-dashboard/backend"
    
    # Wait for services to start
    sleep 10
    
    # Run comprehensive tests
    if node test-all-apis.js; then
        log "✅ All tests passed!"
    else
        error "❌ Some tests failed. Please check the logs."
        return 1
    fi
}

# Print deployment summary
print_summary() {
    local server_ip=$(curl -s ifconfig.me || echo "YOUR_SERVER_IP")
    
    echo -e "${GREEN}"
    echo "============================================================"
    echo "🎉 DEPLOYMENT COMPLETED SUCCESSFULLY!"
    echo "============================================================"
    echo "📱 Application URLs:"
    echo "   🌐 Frontend: http://$server_ip:3000"
    echo "   🔧 Backend API: http://$server_ip:5000"
    echo "   🎭 Ansible API: http://$server_ip:5001"
    echo ""
    echo "🔑 Login Credentials:"
    echo "   👑 Admin: admin / admin123"
    echo "   👤 User: user / user123"
    echo "   👁️ Demo: demo / demo123"
    echo ""
    echo "🛠️ Management Commands:"
    echo "   📊 Check status: pm2 status"
    echo "   📋 View logs: pm2 logs"
    echo "   🔄 Restart: pm2 restart all"
    echo "   ⏹️ Stop: pm2 stop all"
    echo ""
    echo "📂 Application Directory: $APP_DIR"
    echo "============================================================"
    echo -e "${NC}"
}

# Main deployment function
main() {
    print_banner
    check_root
    
    log "🚀 Starting fresh server deployment..."
    
    update_system
    install_nodejs
    install_tools
    clone_repository
    install_dependencies
    configure_environment
    build_frontend
    setup_pm2
    configure_firewall
    start_services
    run_tests
    
    print_summary
    
    log "🎉 Deployment completed successfully!"
}

# Handle command line arguments
case "${1:-}" in
    --quick)
        log "🚀 Running quick deployment (skipping tests)..."
        print_banner
        check_root
        update_system
        install_nodejs
        clone_repository
        install_dependencies
        configure_environment
        build_frontend
        setup_pm2
        start_services
        print_summary
        ;;
    --test-only)
        log "🧪 Running tests only..."
        run_tests
        ;;
    --help)
        echo "Usage: $0 [--quick|--test-only|--help]"
        echo "  --quick     : Skip tests for faster deployment"
        echo "  --test-only : Run tests only"
        echo "  --help      : Show this help"
        exit 0
        ;;
    *)
        # Run full deployment
        main "$@"
        ;;
esac
