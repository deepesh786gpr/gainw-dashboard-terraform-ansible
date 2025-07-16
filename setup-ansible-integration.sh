#!/bin/bash

# Ansible Integration Setup Script
# This script sets up the complete Ansible integration for the Terraform Dashboard

set -e

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

echo -e "${BLUE}🎭 Ansible Integration Setup for Terraform Dashboard${NC}"
echo "================================================================"

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

# Check if running as root
if [[ $EUID -eq 0 ]]; then
   print_error "This script should not be run as root"
   exit 1
fi

print_section "🔍 Prerequisites Check"

# Check if Python is installed
if command -v python3 &> /dev/null; then
    PYTHON_VERSION=$(python3 --version)
    print_success "Python is installed: $PYTHON_VERSION"
else
    print_error "Python 3 is not installed. Please install Python 3.8 or later."
    exit 1
fi

# Check if pip is installed
if command -v pip3 &> /dev/null; then
    print_success "pip3 is available"
else
    print_error "pip3 is not installed. Please install pip3."
    exit 1
fi

# Check if AWS CLI is installed
if command -v aws &> /dev/null; then
    AWS_VERSION=$(aws --version)
    print_success "AWS CLI is installed: $AWS_VERSION"
else
    print_warning "AWS CLI is not installed. Installing..."
    if [[ "$OSTYPE" == "darwin"* ]]; then
        # macOS
        if command -v brew &> /dev/null; then
            brew install awscli
        else
            print_error "Homebrew not found. Please install AWS CLI manually."
            exit 1
        fi
    elif [[ "$OSTYPE" == "linux-gnu"* ]]; then
        # Linux
        curl "https://awscli.amazonaws.com/awscli-exe-linux-x86_64.zip" -o "awscliv2.zip"
        unzip awscliv2.zip
        sudo ./aws/install
        rm -rf aws awscliv2.zip
    else
        print_error "Unsupported OS. Please install AWS CLI manually."
        exit 1
    fi
fi

print_section "📦 Installing Ansible and Dependencies"

# Create virtual environment if it doesn't exist
if [ ! -d "venv" ]; then
    print_info "Creating Python virtual environment..."
    python3 -m venv venv
fi

# Activate virtual environment
print_info "Activating virtual environment..."
source venv/bin/activate

# Upgrade pip
print_info "Upgrading pip..."
pip install --upgrade pip

# Install Ansible and dependencies
print_info "Installing Ansible and AWS dependencies..."
cd ansible-aws-playbooks
pip install -r requirements.txt

# Install Ansible collections
print_info "Installing Ansible collections..."
ansible-galaxy install -r requirements.yml

print_success "Ansible and dependencies installed successfully"

print_section "🔧 Configuration Setup"

# Check AWS credentials
print_info "Checking AWS credentials..."
if aws sts get-caller-identity &> /dev/null; then
    AWS_ACCOUNT=$(aws sts get-caller-identity --query Account --output text)
    AWS_REGION=$(aws configure get region || echo "us-east-1")
    print_success "AWS credentials are configured"
    print_info "Account: $AWS_ACCOUNT"
    print_info "Region: $AWS_REGION"
else
    print_warning "AWS credentials not configured"
    print_info "Please run: aws configure"
    print_info "Or set environment variables:"
    print_info "export AWS_ACCESS_KEY_ID=your_access_key"
    print_info "export AWS_SECRET_ACCESS_KEY=your_secret_key"
    print_info "export AWS_DEFAULT_REGION=us-east-1"
fi

# Set up environment variables
print_info "Setting up environment variables..."
cat > .env << EOF
# Ansible AWS Playbooks Environment Configuration
ANSIBLE_CONFIG=ansible.cfg
ANSIBLE_INVENTORY=inventory/hosts.yml
ANSIBLE_HOST_KEY_CHECKING=False
ANSIBLE_STDOUT_CALLBACK=yaml

# AWS Configuration
AWS_DEFAULT_REGION=${AWS_REGION:-us-east-1}
AWS_DEFAULT_OUTPUT=json

# Dashboard Integration
ANSIBLE_PLAYBOOKS_DIR=$(pwd)
EOF

print_success "Environment configuration created"

print_section "🧪 Testing Ansible Setup"

# Test Ansible installation
print_info "Testing Ansible installation..."
if ansible --version &> /dev/null; then
    ANSIBLE_VERSION=$(ansible --version | head -n1)
    print_success "Ansible is working: $ANSIBLE_VERSION"
else
    print_error "Ansible installation failed"
    exit 1
fi

# Test Ansible collections
print_info "Testing Ansible collections..."
if ansible-galaxy collection list amazon.aws &> /dev/null; then
    print_success "Amazon AWS collection is installed"
else
    print_error "Amazon AWS collection is not installed"
    exit 1
fi

# Test playbook syntax
print_info "Testing playbook syntax..."
PLAYBOOKS=("ec2-management.yml" "rds-management.yml" "lambda-management.yml" "eks-management.yml")
for playbook in "${PLAYBOOKS[@]}"; do
    if ansible-playbook --syntax-check "playbooks/$playbook" &> /dev/null; then
        print_success "Syntax check passed: $playbook"
    else
        print_error "Syntax check failed: $playbook"
    fi
done

print_section "🚀 Dashboard Integration Setup"

# Go back to dashboard directory
cd ..

# Check if backend is running
print_info "Checking if dashboard backend is running..."
if curl -s http://localhost:5000/api/health &> /dev/null; then
    print_success "Dashboard backend is running"
else
    print_warning "Dashboard backend is not running"
    print_info "Please start the backend with: cd terraform-dashboard/backend && npm start"
fi

# Set environment variable for backend
print_info "Setting Ansible playbooks directory for backend..."
export ANSIBLE_PLAYBOOKS_DIR="$(pwd)/ansible-aws-playbooks"
echo "export ANSIBLE_PLAYBOOKS_DIR=\"$(pwd)/ansible-aws-playbooks\"" >> ~/.bashrc

print_section "📋 GitHub Repository Setup"

# Check if git is initialized in ansible-aws-playbooks
cd ansible-aws-playbooks
if [ -d ".git" ]; then
    print_success "Git repository is initialized"
    
    # Check if there are uncommitted changes
    if git diff --quiet && git diff --staged --quiet; then
        print_success "All changes are committed"
    else
        print_info "Committing any remaining changes..."
        git add .
        git commit -m "Setup: Complete Ansible integration setup" || true
    fi
    
    print_info "To push to GitHub:"
    print_info "1. Create a new repository on GitHub"
    print_info "2. Run: git remote add origin https://github.com/yourusername/ansible-aws-playbooks.git"
    print_info "3. Run: git push -u origin main"
else
    print_error "Git repository not initialized"
fi

cd ..

print_section "✅ Setup Complete"

print_success "Ansible integration setup completed successfully!"
echo ""
print_info "Next steps:"
echo "1. Configure AWS credentials if not already done: aws configure"
echo "2. Start the dashboard backend if not running: cd terraform-dashboard/backend && npm start"
echo "3. Open the dashboard and navigate to 'Ansible Execution'"
echo "4. Test the integration using the test page: terraform-dashboard/test-ansible-integration.html"
echo "5. Push the playbooks to GitHub for version control"
echo ""
print_info "Available playbooks:"
echo "• EC2 Management: create, start, stop, restart, terminate, modify, backup"
echo "• RDS Management: create, start, stop, restart, delete, backup, modify"
echo "• Lambda Management: create, update, delete, invoke, configure"
echo "• EKS Management: create, delete, update, scale, configure"
echo ""
print_info "Environment variables set:"
echo "• ANSIBLE_PLAYBOOKS_DIR: $(pwd)/ansible-aws-playbooks"
echo "• Check .env file in ansible-aws-playbooks/ for more settings"
echo ""
print_success "🎉 Ready to use Ansible with Terraform Dashboard!"

# Deactivate virtual environment
deactivate 2>/dev/null || true
