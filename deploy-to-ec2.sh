#!/bin/bash

# Deploy Terraform Dashboard to EC2 Server
# Usage: ./deploy-to-ec2.sh

set -e

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Configuration
EC2_HOST="ubuntu@ec2-18-204-218-19.compute-1.amazonaws.com"
KEY_FILE="${1:-/Users/mac/Downloads/dasboard.io.pem}"  # Default to Downloads folder
REMOTE_DIR="/home/ubuntu/terraform-dashboard"
LOCAL_DIR="."

# Function to print section headers
print_section() {
    echo -e "\n${BLUE}$1${NC}"
    echo "----------------------------------------"
}

# Function to print success
print_success() {
    echo -e "${GREEN}✅ $1${NC}"
}

# Function to print error
print_error() {
    echo -e "${RED}❌ $1${NC}"
}

# Function to print warning
print_warning() {
    echo -e "${YELLOW}⚠️  $1${NC}"
}

# Function to print info
print_info() {
    echo -e "${BLUE}ℹ️  $1${NC}"
}

echo -e "${BLUE}🚀 Deploying Terraform Dashboard to EC2 Server${NC}"
echo "================================================================"
echo ""
print_info "Usage: $0 [path-to-ssh-key.pem]"
print_info "EC2 Host: $EC2_HOST"
print_info "SSH Key: $KEY_FILE"
echo ""

# Check if key file exists
if [ ! -f "$KEY_FILE" ]; then
    print_error "SSH key file '$KEY_FILE' not found!"
    print_info "Please ensure the key file is in the current directory"
    exit 1
fi

# Set correct permissions for key file
chmod 400 "$KEY_FILE"
print_success "SSH key permissions set"

print_section "📦 Preparing Files for Deployment"

# Create deployment package
print_info "Creating deployment package..."

# Create temporary directory for deployment
TEMP_DIR=$(mktemp -d)
print_info "Using temporary directory: $TEMP_DIR"

# Copy essential files
print_info "Copying application files..."

# Copy main application directories
cp -r terraform-dashboard "$TEMP_DIR/"
cp -r ansible-aws-playbooks "$TEMP_DIR/"

# Remove node_modules to save space (will reinstall on server)
print_info "Removing node_modules to save bandwidth..."
find "$TEMP_DIR" -name "node_modules" -type d -exec rm -rf {} + 2>/dev/null || true
find "$TEMP_DIR" -name "dist" -type d -exec rm -rf {} + 2>/dev/null || true

# Create deployment scripts
cat > "$TEMP_DIR/install-dependencies.sh" << 'EOF'
#!/bin/bash

# Install Dependencies on EC2 Server
set -e

echo "🔧 Installing system dependencies..."

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

# Install PM2 for process management
sudo npm install -g pm2

echo "✅ System dependencies installed successfully!"
EOF

cat > "$TEMP_DIR/setup-application.sh" << 'EOF'
#!/bin/bash

# Setup Application on EC2 Server
set -e

echo "🚀 Setting up Terraform Dashboard application..."

cd /home/ubuntu/terraform-dashboard

# Install backend dependencies
echo "📦 Installing backend dependencies..."
cd terraform-dashboard/backend
npm install
npm run build

# Install frontend dependencies
echo "📦 Installing frontend dependencies..."
cd ../frontend
npm install
npm run build

# Setup Ansible
echo "🎭 Setting up Ansible..."
cd ../../ansible-aws-playbooks

# Install Python dependencies
pip3 install --user -r requirements.txt

# Install Ansible collections
ansible-galaxy collection install -r requirements.yml

# Set up environment variables
cd /home/ubuntu/terraform-dashboard
cat > .env << 'ENVEOF'
# Production Environment Configuration
NODE_ENV=production
PORT=5000
FRONTEND_URL=http://ec2-18-204-218-19.compute-1.amazonaws.com:3000

# Database Configuration
DATABASE_PATH=/home/ubuntu/terraform-dashboard/data/terraform-dashboard.db

# JWT Configuration
JWT_SECRET=your-super-secret-jwt-key-change-this-in-production-$(openssl rand -hex 32)

# AWS Configuration
AWS_REGION=us-east-1
AWS_DEFAULT_REGION=us-east-1

# Terraform Configuration
TERRAFORM_PATH=/usr/bin/terraform
TERRAGRUNT_PATH=/usr/local/bin/terragrunt
TERRAFORM_WORKING_DIR=/home/ubuntu/terraform-dashboard/terraform-workspace

# Ansible Configuration
ANSIBLE_PLAYBOOKS_DIR=/home/ubuntu/ansible-aws-playbooks

# Logging Configuration
LOG_LEVEL=info
LOG_FILE=/home/ubuntu/terraform-dashboard/logs/terraform-dashboard.log
ENVEOF

# Create necessary directories
mkdir -p data logs terraform-workspace

echo "✅ Application setup completed successfully!"
EOF

cat > "$TEMP_DIR/start-services.sh" << 'EOF'
#!/bin/bash

# Start Services with PM2
set -e

echo "🚀 Starting Terraform Dashboard services..."

cd /home/ubuntu/terraform-dashboard

# Stop any existing services
pm2 delete all 2>/dev/null || true

# Start backend service
echo "🔧 Starting backend service..."
cd terraform-dashboard/backend
pm2 start npm --name "terraform-backend" -- start

# Start frontend service
echo "🎨 Starting frontend service..."
cd ../frontend
pm2 start npm --name "terraform-frontend" -- start

# Start Ansible API service
echo "🎭 Starting Ansible API service..."
cd /home/ubuntu/terraform-dashboard/terraform-dashboard/backend
pm2 start ansible-api-server.js --name "ansible-api" -- --env production

# Save PM2 configuration
pm2 save
pm2 startup

echo "✅ All services started successfully!"
echo ""
echo "🌐 Application URLs:"
echo "   Frontend: http://ec2-18-204-218-19.compute-1.amazonaws.com:3000"
echo "   Backend:  http://ec2-18-204-218-19.compute-1.amazonaws.com:5000"
echo "   Ansible:  http://ec2-18-204-218-19.compute-1.amazonaws.com:5001"
echo ""
echo "📊 Check status with: pm2 status"
echo "📋 View logs with: pm2 logs"
EOF

# Make scripts executable
chmod +x "$TEMP_DIR/install-dependencies.sh"
chmod +x "$TEMP_DIR/setup-application.sh"
chmod +x "$TEMP_DIR/start-services.sh"

print_success "Deployment package prepared"

print_section "🌐 Connecting to EC2 Server"

# Test SSH connection
print_info "Testing SSH connection..."
if ssh -i "$KEY_FILE" -o ConnectTimeout=10 -o StrictHostKeyChecking=no "$EC2_HOST" "echo 'SSH connection successful'"; then
    print_success "SSH connection established"
else
    print_error "Failed to connect to EC2 server"
    print_info "Please check:"
    print_info "1. EC2 instance is running"
    print_info "2. Security group allows SSH (port 22)"
    print_info "3. Key file is correct"
    exit 1
fi

print_section "📤 Uploading Files to Server"

# Create remote directory
print_info "Creating remote directory..."
ssh -i "$KEY_FILE" "$EC2_HOST" "mkdir -p /home/ubuntu/terraform-dashboard"

# Upload files using rsync for efficiency
print_info "Uploading application files..."
rsync -avz -e "ssh -i '$KEY_FILE'" --progress \
    --exclude='node_modules' \
    --exclude='dist' \
    --exclude='.git' \
    --exclude='*.log' \
    "$TEMP_DIR/" "$EC2_HOST:/home/ubuntu/"

print_success "Files uploaded successfully"

print_section "🔧 Installing Dependencies on Server"

# Install system dependencies
print_info "Installing system dependencies..."
ssh -i "$KEY_FILE" "$EC2_HOST" "cd /home/ubuntu && chmod +x install-dependencies.sh && ./install-dependencies.sh"

print_success "Dependencies installed"

print_section "⚙️  Setting up Application"

# Setup application
print_info "Setting up application..."
ssh -i "$KEY_FILE" "$EC2_HOST" "cd /home/ubuntu && chmod +x setup-application.sh && ./setup-application.sh"

print_success "Application configured"

print_section "🚀 Starting Services"

# Start services
print_info "Starting services with PM2..."
ssh -i "$KEY_FILE" "$EC2_HOST" "cd /home/ubuntu && chmod +x start-services.sh && ./start-services.sh"

print_success "Services started"

print_section "🔍 Verifying Deployment"

# Check service status
print_info "Checking service status..."
ssh -i "$KEY_FILE" "$EC2_HOST" "pm2 status"

# Test endpoints
print_info "Testing application endpoints..."

# Wait a moment for services to start
sleep 10

# Test backend health
if curl -f -s "http://ec2-18-204-218-19.compute-1.amazonaws.com:5000/health" > /dev/null; then
    print_success "Backend service is responding"
else
    print_warning "Backend service may still be starting..."
fi

# Test Ansible API
if curl -f -s "http://ec2-18-204-218-19.compute-1.amazonaws.com:5001/health" > /dev/null; then
    print_success "Ansible API service is responding"
else
    print_warning "Ansible API service may still be starting..."
fi

print_section "✅ Deployment Complete"

print_success "Terraform Dashboard deployed successfully!"
echo ""
print_info "🌐 Application URLs:"
echo "   Frontend: http://ec2-18-204-218-19.compute-1.amazonaws.com:3000"
echo "   Backend:  http://ec2-18-204-218-19.compute-1.amazonaws.com:5000"
echo "   Ansible:  http://ec2-18-204-218-19.compute-1.amazonaws.com:5001"
echo ""
print_info "📊 Useful commands:"
echo "   SSH to server: ssh -i '$KEY_FILE' $EC2_HOST"
echo "   Check status:  ssh -i '$KEY_FILE' $EC2_HOST 'pm2 status'"
echo "   View logs:     ssh -i '$KEY_FILE' $EC2_HOST 'pm2 logs'"
echo "   Restart:       ssh -i '$KEY_FILE' $EC2_HOST 'pm2 restart all'"
echo ""
print_info "🔧 Next steps:"
echo "1. Configure AWS credentials on the server"
echo "2. Test the application functionality"
echo "3. Set up SSL/HTTPS if needed"
echo "4. Configure domain name if desired"

# Cleanup
rm -rf "$TEMP_DIR"
print_success "Cleanup completed"

echo ""
print_success "🎉 Deployment finished successfully!"
