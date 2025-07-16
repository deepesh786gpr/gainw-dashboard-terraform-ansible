#!/bin/bash

# Terraform Dashboard - Complete Deployment Script
# This script sets up the entire Terraform Dashboard application on a fresh server
# Supports Ubuntu/Debian and CentOS/RHEL/Amazon Linux

set -e

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
PURPLE='\033[0;35m'
NC='\033[0m' # No Color

# Configuration
APP_NAME="terraform-dashboard"
APP_USER="dashboard"
APP_DIR="/opt/terraform-dashboard"
NGINX_AVAILABLE="/etc/nginx/sites-available"
NGINX_ENABLED="/etc/nginx/sites-enabled"
SYSTEMD_DIR="/etc/systemd/system"

# Default values
DOMAIN="localhost"
SSL_ENABLED=false
AWS_REGION="us-east-1"
NODE_ENV="production"

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

print_header() {
    echo -e "${PURPLE}================================${NC}"
    echo -e "${PURPLE}$1${NC}"
    echo -e "${PURPLE}================================${NC}"
}

# Function to detect OS
detect_os() {
    if [[ -f /etc/os-release ]]; then
        . /etc/os-release
        OS=$NAME
        VER=$VERSION_ID
    elif type lsb_release >/dev/null 2>&1; then
        OS=$(lsb_release -si)
        VER=$(lsb_release -sr)
    elif [[ -f /etc/redhat-release ]]; then
        OS="Red Hat Enterprise Linux"
        VER=$(cat /etc/redhat-release | sed 's/.*release //' | sed 's/ .*//')
    else
        OS=$(uname -s)
        VER=$(uname -r)
    fi
    
    print_status "Detected OS: $OS $VER"
}

# Function to install dependencies based on OS
install_dependencies() {
    print_header "Installing System Dependencies"
    
    if [[ "$OS" == *"Ubuntu"* ]] || [[ "$OS" == *"Debian"* ]]; then
        print_status "Installing dependencies for Debian/Ubuntu..."
        apt-get update
        apt-get install -y curl wget git nginx postgresql postgresql-contrib redis-server \
                          software-properties-common apt-transport-https ca-certificates \
                          gnupg lsb-release python3 python3-pip unzip
        
        # Install Node.js 18.x
        curl -fsSL https://deb.nodesource.com/setup_18.x | bash -
        apt-get install -y nodejs
        
    elif [[ "$OS" == *"CentOS"* ]] || [[ "$OS" == *"Red Hat"* ]] || [[ "$OS" == *"Amazon Linux"* ]]; then
        print_status "Installing dependencies for RHEL/CentOS/Amazon Linux..."
        yum update -y
        yum install -y curl wget git nginx postgresql postgresql-server redis \
                      python3 python3-pip unzip
        
        # Install Node.js 18.x
        curl -fsSL https://rpm.nodesource.com/setup_18.x | bash -
        yum install -y nodejs
        
        # Initialize PostgreSQL
        postgresql-setup initdb
        
    else
        print_error "Unsupported operating system: $OS"
        exit 1
    fi
    
    # Install PM2 globally
    npm install -g pm2
    
    # Install Ansible
    pip3 install ansible boto3 botocore
    
    print_success "System dependencies installed successfully"
}

# Function to create application user
create_app_user() {
    print_header "Creating Application User"
    
    if id "$APP_USER" &>/dev/null; then
        print_warning "User $APP_USER already exists"
    else
        useradd -r -s /bin/bash -d $APP_DIR $APP_USER
        print_success "Created user: $APP_USER"
    fi
}

# Function to setup application directory
setup_app_directory() {
    print_header "Setting Up Application Directory"
    
    # Create application directory
    mkdir -p $APP_DIR
    chown $APP_USER:$APP_USER $APP_DIR
    
    print_success "Application directory created: $APP_DIR"
}

# Function to clone and setup application
setup_application() {
    print_header "Setting Up Terraform Dashboard Application"
    
    # Switch to app user for the rest of the setup
    sudo -u $APP_USER bash << EOF
cd $APP_DIR

# Clone the repository (you'll need to replace with actual repo URL)
if [[ ! -d "terraform-dashboard" ]]; then
    print_status "Cloning Terraform Dashboard repository..."
    git clone https://github.com/yourusername/terraform-dashboard.git
    cd terraform-dashboard
else
    print_status "Repository already exists, pulling latest changes..."
    cd terraform-dashboard
    git pull origin main
fi

# Install backend dependencies
print_status "Installing backend dependencies..."
cd backend
npm install --production

# Build backend
npm run build

# Install frontend dependencies
print_status "Installing frontend dependencies..."
cd ../frontend
npm install

# Build frontend for production
npm run build

# Setup Ansible playbooks
print_status "Setting up Ansible playbooks..."
cd ..
if [[ ! -d "ansible-aws-playbooks" ]]; then
    git clone https://github.com/yourusername/ansible-aws-playbooks.git
fi

cd ansible-aws-playbooks
pip3 install -r requirements.txt
ansible-galaxy install -r requirements.yml

EOF

    print_success "Application setup completed"
}

# Function to setup database
setup_database() {
    print_header "Setting Up PostgreSQL Database"
    
    # Start PostgreSQL service
    systemctl start postgresql
    systemctl enable postgresql
    
    # Create database and user
    sudo -u postgres psql << EOF
CREATE DATABASE terraform_dashboard;
CREATE USER dashboard_user WITH ENCRYPTED PASSWORD 'dashboard_password_change_me';
GRANT ALL PRIVILEGES ON DATABASE terraform_dashboard TO dashboard_user;
\q
EOF

    print_success "PostgreSQL database setup completed"
}

# Function to setup Redis
setup_redis() {
    print_header "Setting Up Redis"
    
    # Start Redis service
    systemctl start redis
    systemctl enable redis
    
    print_success "Redis setup completed"
}

# Function to create environment files
create_env_files() {
    print_header "Creating Environment Configuration"
    
    # Backend environment file
    cat > $APP_DIR/terraform-dashboard/backend/.env << EOF
# Database Configuration
DATABASE_URL=postgresql://dashboard_user:dashboard_password_change_me@localhost:5432/terraform_dashboard

# Redis Configuration
REDIS_URL=redis://localhost:6379

# JWT Configuration
JWT_SECRET=your_jwt_secret_change_me_in_production
JWT_REFRESH_SECRET=your_jwt_refresh_secret_change_me_in_production

# AWS Configuration
AWS_REGION=$AWS_REGION
# AWS_ACCESS_KEY_ID=your_access_key
# AWS_SECRET_ACCESS_KEY=your_secret_key

# Application Configuration
NODE_ENV=$NODE_ENV
PORT=5000

# GitHub Integration (optional)
# GITHUB_CLIENT_ID=your_github_client_id
# GITHUB_CLIENT_SECRET=your_github_client_secret

# Ansible Configuration
ANSIBLE_PLAYBOOKS_DIR=$APP_DIR/ansible-aws-playbooks
EOF

    # Frontend environment file
    cat > $APP_DIR/terraform-dashboard/frontend/.env << EOF
REACT_APP_API_URL=http://$DOMAIN:5000
REACT_APP_ENVIRONMENT=$NODE_ENV
EOF

    # Set proper permissions
    chown $APP_USER:$APP_USER $APP_DIR/terraform-dashboard/backend/.env
    chown $APP_USER:$APP_USER $APP_DIR/terraform-dashboard/frontend/.env
    chmod 600 $APP_DIR/terraform-dashboard/backend/.env
    
    print_success "Environment files created"
}

# Function to create systemd services
create_systemd_services() {
    print_header "Creating Systemd Services"
    
    # Backend service
    cat > $SYSTEMD_DIR/terraform-dashboard-backend.service << EOF
[Unit]
Description=Terraform Dashboard Backend
After=network.target postgresql.service redis.service

[Service]
Type=simple
User=$APP_USER
WorkingDirectory=$APP_DIR/terraform-dashboard/backend
ExecStart=/usr/bin/node dist/server.js
Restart=always
RestartSec=10
Environment=NODE_ENV=$NODE_ENV

[Install]
WantedBy=multi-user.target
EOF

    # Ansible API service
    cat > $SYSTEMD_DIR/terraform-dashboard-ansible.service << EOF
[Unit]
Description=Terraform Dashboard Ansible API
After=network.target

[Service]
Type=simple
User=$APP_USER
WorkingDirectory=$APP_DIR/terraform-dashboard/backend
ExecStart=/usr/bin/node ansible-api-server.js
Restart=always
RestartSec=10
Environment=ANSIBLE_PLAYBOOKS_DIR=$APP_DIR/ansible-aws-playbooks

[Install]
WantedBy=multi-user.target
EOF

    # Enable and start services
    systemctl daemon-reload
    systemctl enable terraform-dashboard-backend
    systemctl enable terraform-dashboard-ansible
    
    print_success "Systemd services created"
}

# Function to setup Nginx
setup_nginx() {
    print_header "Setting Up Nginx Reverse Proxy"
    
    # Create Nginx configuration
    cat > $NGINX_AVAILABLE/terraform-dashboard << EOF
server {
    listen 80;
    server_name $DOMAIN;
    
    # Frontend (React app)
    location / {
        root $APP_DIR/terraform-dashboard/frontend/build;
        index index.html index.htm;
        try_files \$uri \$uri/ /index.html;
    }
    
    # Backend API
    location /api/ {
        proxy_pass http://localhost:5000;
        proxy_http_version 1.1;
        proxy_set_header Upgrade \$http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host \$host;
        proxy_set_header X-Real-IP \$remote_addr;
        proxy_set_header X-Forwarded-For \$proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto \$scheme;
        proxy_cache_bypass \$http_upgrade;
    }
    
    # Ansible API
    location /ansible-api/ {
        proxy_pass http://localhost:5001/;
        proxy_http_version 1.1;
        proxy_set_header Upgrade \$http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host \$host;
        proxy_set_header X-Real-IP \$remote_addr;
        proxy_set_header X-Forwarded-For \$proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto \$scheme;
        proxy_cache_bypass \$http_upgrade;
    }
    
    # Static assets
    location ~* \.(js|css|png|jpg|jpeg|gif|ico|svg)$ {
        root $APP_DIR/terraform-dashboard/frontend/build;
        expires 1y;
        add_header Cache-Control "public, immutable";
    }
}
EOF

    # Enable the site
    ln -sf $NGINX_AVAILABLE/terraform-dashboard $NGINX_ENABLED/
    
    # Remove default site if it exists
    rm -f $NGINX_ENABLED/default
    
    # Test Nginx configuration
    nginx -t
    
    # Start and enable Nginx
    systemctl start nginx
    systemctl enable nginx
    
    print_success "Nginx setup completed"
}

# Function to start services
start_services() {
    print_header "Starting Services"
    
    # Start application services
    systemctl start terraform-dashboard-backend
    systemctl start terraform-dashboard-ansible
    
    # Reload Nginx
    systemctl reload nginx
    
    print_success "All services started"
}

# Function to display final information
display_final_info() {
    print_header "Deployment Complete!"
    
    echo -e "${GREEN}🎉 Terraform Dashboard has been successfully deployed!${NC}"
    echo ""
    echo -e "${BLUE}📋 Application Information:${NC}"
    echo -e "   • Application Directory: ${YELLOW}$APP_DIR${NC}"
    echo -e "   • Application User: ${YELLOW}$APP_USER${NC}"
    echo -e "   • Domain: ${YELLOW}$DOMAIN${NC}"
    echo ""
    echo -e "${BLUE}🌐 Access URLs:${NC}"
    echo -e "   • Dashboard: ${YELLOW}http://$DOMAIN${NC}"
    echo -e "   • Backend API: ${YELLOW}http://$DOMAIN/api${NC}"
    echo -e "   • Ansible API: ${YELLOW}http://$DOMAIN/ansible-api${NC}"
    echo ""
    echo -e "${BLUE}🔧 Service Management:${NC}"
    echo -e "   • Backend: ${YELLOW}systemctl status terraform-dashboard-backend${NC}"
    echo -e "   • Ansible: ${YELLOW}systemctl status terraform-dashboard-ansible${NC}"
    echo -e "   • Nginx: ${YELLOW}systemctl status nginx${NC}"
    echo -e "   • PostgreSQL: ${YELLOW}systemctl status postgresql${NC}"
    echo -e "   • Redis: ${YELLOW}systemctl status redis${NC}"
    echo ""
    echo -e "${BLUE}📝 Next Steps:${NC}"
    echo -e "   1. Configure AWS credentials in ${YELLOW}$APP_DIR/terraform-dashboard/backend/.env${NC}"
    echo -e "   2. Update database password in environment file"
    echo -e "   3. Configure GitHub integration (optional)"
    echo -e "   4. Set up SSL certificate (recommended for production)"
    echo -e "   5. Configure firewall rules"
    echo ""
    echo -e "${BLUE}🔐 Security Notes:${NC}"
    echo -e "   • Change default database password"
    echo -e "   • Update JWT secrets"
    echo -e "   • Configure proper firewall rules"
    echo -e "   • Set up SSL/TLS certificates"
    echo ""
    echo -e "${GREEN}✅ Deployment completed successfully!${NC}"
}

# Main deployment function
main() {
    print_header "Terraform Dashboard Deployment"
    
    # Check if running as root
    if [[ $EUID -ne 0 ]]; then
        print_error "This script must be run as root"
        exit 1
    fi
    
    # Parse command line arguments
    while [[ $# -gt 0 ]]; do
        case $1 in
            --domain)
                DOMAIN="$2"
                shift 2
                ;;
            --ssl)
                SSL_ENABLED=true
                shift
                ;;
            --aws-region)
                AWS_REGION="$2"
                shift 2
                ;;
            --help)
                echo "Usage: $0 [OPTIONS]"
                echo "Options:"
                echo "  --domain DOMAIN     Set domain name (default: localhost)"
                echo "  --ssl               Enable SSL configuration"
                echo "  --aws-region REGION Set AWS region (default: us-east-1)"
                echo "  --help              Show this help message"
                exit 0
                ;;
            *)
                print_error "Unknown option: $1"
                exit 1
                ;;
        esac
    done
    
    print_status "Starting deployment with domain: $DOMAIN"
    
    # Execute deployment steps
    detect_os
    install_dependencies
    create_app_user
    setup_app_directory
    setup_application
    setup_database
    setup_redis
    create_env_files
    create_systemd_services
    setup_nginx
    start_services
    display_final_info
}

# Run main function
main "$@"
