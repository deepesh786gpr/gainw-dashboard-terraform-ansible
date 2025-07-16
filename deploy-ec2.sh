#!/bin/bash

# =============================================================================
# TERRAFORM DASHBOARD - EC2 DEPLOYMENT SCRIPT
# =============================================================================
# This script deploys to your specific EC2 instance
# Server: ec2-18-204-218-19.compute-1.amazonaws.com
# =============================================================================

set -e

# Configuration
EC2_HOST="ec2-18-204-218-19.compute-1.amazonaws.com"
EC2_USER="ubuntu"
KEY_FILE="dasboard.io.pem"
GITHUB_REPO="https://github.com/deepesh786gpr/new-dashboard.git"

# Colors
GREEN='\033[0;32m'
RED='\033[0;31m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m'

log() {
    echo -e "${GREEN}[$(date +'%H:%M:%S')] $1${NC}"
}

error() {
    echo -e "${RED}[ERROR] $1${NC}" >&2
}

info() {
    echo -e "${BLUE}[INFO] $1${NC}"
}

# Check if key file exists
check_key_file() {
    if [ ! -f "$KEY_FILE" ]; then
        error "Key file '$KEY_FILE' not found!"
        error "Please ensure the key file is in the current directory."
        exit 1
    fi
    
    # Set correct permissions
    chmod 600 "$KEY_FILE"
    log "✅ Key file permissions set correctly"
}

# Test SSH connection
test_ssh() {
    log "🔌 Testing SSH connection to EC2..."
    if ssh -i "$KEY_FILE" -o ConnectTimeout=10 -o StrictHostKeyChecking=no "$EC2_USER@$EC2_HOST" "echo 'SSH connection successful'"; then
        log "✅ SSH connection successful"
    else
        error "❌ SSH connection failed"
        error "Please check:"
        error "  1. Key file: $KEY_FILE"
        error "  2. EC2 instance is running"
        error "  3. Security group allows SSH (port 22)"
        exit 1
    fi
}

# Deploy to EC2
deploy_to_ec2() {
    log "🚀 Starting deployment to EC2..."
    
    # Copy deployment script to EC2
    log "📤 Copying deployment script to EC2..."
    scp -i "$KEY_FILE" -o StrictHostKeyChecking=no deploy-fresh-server.sh "$EC2_USER@$EC2_HOST:/tmp/"
    
    # Execute deployment on EC2
    log "🔧 Executing deployment on EC2..."
    ssh -i "$KEY_FILE" -o StrictHostKeyChecking=no "$EC2_USER@$EC2_HOST" << 'EOF'
        # Make script executable
        chmod +x /tmp/deploy-fresh-server.sh
        
        # Run deployment
        /tmp/deploy-fresh-server.sh --quick
        
        # Clean up
        rm /tmp/deploy-fresh-server.sh
EOF
    
    log "✅ Deployment completed on EC2"
}

# Update existing deployment
update_deployment() {
    log "🔄 Updating existing deployment..."
    
    ssh -i "$KEY_FILE" -o StrictHostKeyChecking=no "$EC2_USER@$EC2_HOST" << 'EOF'
        cd /home/ubuntu/new-dashboard
        
        # Pull latest changes
        git pull origin main
        
        # Update backend dependencies
        cd terraform-dashboard/backend
        npm install
        
        # Update frontend dependencies and rebuild
        cd ../frontend
        npm install
        npm run build
        
        # Restart services
        cd ..
        pm2 restart all
        
        # Wait and test
        sleep 10
        cd backend
        node test-all-apis.js
EOF
    
    log "✅ Deployment updated successfully"
}

# Check deployment status
check_status() {
    log "📊 Checking deployment status..."
    
    ssh -i "$KEY_FILE" -o StrictHostKeyChecking=no "$EC2_USER@$EC2_HOST" << 'EOF'
        echo "🔍 PM2 Status:"
        pm2 status
        
        echo ""
        echo "🌐 Service Health:"
        curl -s http://localhost:5000/health | jq . || echo "Backend not responding"
        curl -s http://localhost:5001/health | jq . || echo "Ansible API not responding"
        curl -s http://localhost:3000 > /dev/null && echo "Frontend: ✅ Running" || echo "Frontend: ❌ Not responding"
        
        echo ""
        echo "🔥 Firewall Status:"
        sudo ufw status
        
        echo ""
        echo "💾 Disk Usage:"
        df -h /
        
        echo ""
        echo "🧠 Memory Usage:"
        free -h
EOF
}

# Open application in browser
open_app() {
    local ec2_ip=$(dig +short "$EC2_HOST")
    info "🌐 Application URLs:"
    info "   Frontend: http://$EC2_HOST:3000"
    info "   Backend:  http://$EC2_HOST:5000"
    info "   Ansible:  http://$EC2_HOST:5001"
    info ""
    info "🔑 Login Credentials:"
    info "   Admin: admin / admin123"
    info "   User:  user / user123"
    info "   Demo:  demo / demo123"
}

# Main menu
show_menu() {
    echo -e "${BLUE}"
    echo "============================================================"
    echo "🚀 TERRAFORM DASHBOARD - EC2 DEPLOYMENT MENU"
    echo "============================================================"
    echo "Server: $EC2_HOST"
    echo "============================================================"
    echo -e "${NC}"
    echo "1) 🆕 Fresh deployment (new installation)"
    echo "2) 🔄 Update deployment (pull latest changes)"
    echo "3) 📊 Check status"
    echo "4) 🌐 Show application URLs"
    echo "5) 🧪 Run tests only"
    echo "6) ❌ Exit"
    echo ""
    read -p "Choose an option (1-6): " choice
    
    case $choice in
        1)
            check_key_file
            test_ssh
            deploy_to_ec2
            check_status
            open_app
            ;;
        2)
            check_key_file
            test_ssh
            update_deployment
            check_status
            ;;
        3)
            check_key_file
            test_ssh
            check_status
            ;;
        4)
            open_app
            ;;
        5)
            check_key_file
            test_ssh
            ssh -i "$KEY_FILE" -o StrictHostKeyChecking=no "$EC2_USER@$EC2_HOST" "cd /home/ubuntu/new-dashboard/terraform-dashboard/backend && node test-all-apis.js"
            ;;
        6)
            log "👋 Goodbye!"
            exit 0
            ;;
        *)
            error "Invalid option. Please choose 1-6."
            show_menu
            ;;
    esac
}

# Handle command line arguments
case "${1:-}" in
    --deploy)
        check_key_file
        test_ssh
        deploy_to_ec2
        check_status
        open_app
        ;;
    --update)
        check_key_file
        test_ssh
        update_deployment
        check_status
        ;;
    --status)
        check_key_file
        test_ssh
        check_status
        ;;
    --test)
        check_key_file
        test_ssh
        ssh -i "$KEY_FILE" -o StrictHostKeyChecking=no "$EC2_USER@$EC2_HOST" "cd /home/ubuntu/new-dashboard/terraform-dashboard/backend && node test-all-apis.js"
        ;;
    --help)
        echo "Usage: $0 [--deploy|--update|--status|--test|--help]"
        echo "  --deploy : Fresh deployment"
        echo "  --update : Update existing deployment"
        echo "  --status : Check deployment status"
        echo "  --test   : Run tests only"
        echo "  --help   : Show this help"
        echo ""
        echo "Or run without arguments for interactive menu."
        exit 0
        ;;
    *)
        show_menu
        ;;
esac
