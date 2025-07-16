# Terraform Dashboard - Deployment Guide

This guide provides comprehensive instructions for deploying the Terraform Dashboard application on a fresh server using multiple deployment methods.

## 🚀 Quick Start

### Prerequisites

- Fresh Ubuntu/Debian or CentOS/RHEL/Amazon Linux server
- Root access or sudo privileges
- Internet connectivity
- At least 4GB RAM and 20GB disk space

### Option 1: Automated Script Deployment (Recommended)

```bash
# Download and run the deployment script
curl -fsSL https://raw.githubusercontent.com/yourusername/terraform-dashboard/main/deploy-terraform-dashboard.sh -o deploy.sh
chmod +x deploy.sh
sudo ./deploy.sh --domain your-domain.com --aws-region us-east-1
```

### Option 2: Docker Compose Deployment

```bash
# Clone the repository
git clone https://github.com/yourusername/terraform-dashboard.git
cd terraform-dashboard

# Copy and configure environment files
cp .env.example .env
# Edit .env with your configuration

# Start all services
docker-compose up -d

# Check status
docker-compose ps
```

## 📋 Detailed Deployment Options

### 1. Native Installation (Production)

The automated script (`deploy-terraform-dashboard.sh`) performs the following:

#### System Setup
- Detects OS (Ubuntu/Debian/CentOS/RHEL/Amazon Linux)
- Installs Node.js 18.x, PostgreSQL, Redis, Nginx
- Installs Python 3, Ansible, and AWS CLI tools
- Creates dedicated application user

#### Application Setup
- Clones application repository
- Installs and builds frontend/backend
- Sets up Ansible playbooks
- Configures environment variables
- Creates systemd services

#### Service Configuration
- PostgreSQL database with dedicated user
- Redis for caching and sessions
- Nginx reverse proxy with SSL support
- Systemd services for auto-start

#### Usage
```bash
# Basic deployment
sudo ./deploy-terraform-dashboard.sh

# With custom domain
sudo ./deploy-terraform-dashboard.sh --domain dashboard.example.com

# With SSL and custom region
sudo ./deploy-terraform-dashboard.sh --domain dashboard.example.com --ssl --aws-region eu-west-1

# Show help
./deploy-terraform-dashboard.sh --help
```

### 2. Docker Deployment

#### Prerequisites
```bash
# Install Docker and Docker Compose
curl -fsSL https://get.docker.com -o get-docker.sh
sudo sh get-docker.sh
sudo curl -L "https://github.com/docker/compose/releases/latest/download/docker-compose-$(uname -s)-$(uname -m)" -o /usr/local/bin/docker-compose
sudo chmod +x /usr/local/bin/docker-compose
```

#### Configuration
```bash
# Create environment file
cat > .env << EOF
# Database
POSTGRES_DB=terraform_dashboard
POSTGRES_USER=dashboard_user
POSTGRES_PASSWORD=your_secure_password

# Application
JWT_SECRET=your_jwt_secret_change_me
JWT_REFRESH_SECRET=your_jwt_refresh_secret_change_me
AWS_REGION=us-east-1
NODE_ENV=production

# Optional: AWS Credentials
AWS_ACCESS_KEY_ID=your_access_key
AWS_SECRET_ACCESS_KEY=your_secret_key

# Optional: GitHub Integration
GITHUB_CLIENT_ID=your_github_client_id
GITHUB_CLIENT_SECRET=your_github_client_secret
EOF
```

#### Deployment
```bash
# Start all services
docker-compose up -d

# View logs
docker-compose logs -f

# Stop services
docker-compose down

# Update and restart
git pull origin main
docker-compose build
docker-compose up -d
```

### 3. Manual Installation

#### Step 1: Install Dependencies
```bash
# Ubuntu/Debian
sudo apt update
sudo apt install -y nodejs npm postgresql postgresql-contrib redis-server nginx python3 python3-pip git

# CentOS/RHEL
sudo yum install -y nodejs npm postgresql postgresql-server redis nginx python3 python3-pip git
```

#### Step 2: Setup Database
```bash
# Start PostgreSQL
sudo systemctl start postgresql
sudo systemctl enable postgresql

# Create database
sudo -u postgres psql << EOF
CREATE DATABASE terraform_dashboard;
CREATE USER dashboard_user WITH ENCRYPTED PASSWORD 'your_password';
GRANT ALL PRIVILEGES ON DATABASE terraform_dashboard TO dashboard_user;
\q
EOF
```

#### Step 3: Clone and Build
```bash
# Clone repository
git clone https://github.com/yourusername/terraform-dashboard.git
cd terraform-dashboard

# Backend setup
cd backend
npm install
npm run build

# Frontend setup
cd ../frontend
npm install
npm run build

# Ansible setup
cd ..
git clone https://github.com/yourusername/ansible-aws-playbooks.git
cd ansible-aws-playbooks
pip3 install -r requirements.txt
```

#### Step 4: Configure Services
```bash
# Create systemd service files
# (See deploy-terraform-dashboard.sh for complete service configurations)

# Start services
sudo systemctl start terraform-dashboard-backend
sudo systemctl start terraform-dashboard-ansible
sudo systemctl enable terraform-dashboard-backend
sudo systemctl enable terraform-dashboard-ansible
```

## 🔧 Configuration

### Environment Variables

#### Backend (.env)
```bash
# Database
DATABASE_URL=postgresql://dashboard_user:password@localhost:5432/terraform_dashboard

# Redis
REDIS_URL=redis://localhost:6379

# JWT
JWT_SECRET=your_jwt_secret_change_me
JWT_REFRESH_SECRET=your_jwt_refresh_secret_change_me

# AWS
AWS_REGION=us-east-1
AWS_ACCESS_KEY_ID=your_access_key
AWS_SECRET_ACCESS_KEY=your_secret_key

# Application
NODE_ENV=production
PORT=5000

# Ansible
ANSIBLE_PLAYBOOKS_DIR=/path/to/ansible-aws-playbooks

# GitHub (Optional)
GITHUB_CLIENT_ID=your_github_client_id
GITHUB_CLIENT_SECRET=your_github_client_secret
```

#### Frontend (.env)
```bash
REACT_APP_API_URL=http://your-domain.com
REACT_APP_ENVIRONMENT=production
```

### AWS Configuration

#### Option 1: Environment Variables
Set `AWS_ACCESS_KEY_ID` and `AWS_SECRET_ACCESS_KEY` in backend `.env`

#### Option 2: IAM Roles (Recommended for EC2)
Attach IAM role with required permissions to EC2 instance

#### Option 3: AWS CLI Configuration
```bash
aws configure
```

### Required AWS Permissions
```json
{
    "Version": "2012-10-17",
    "Statement": [
        {
            "Effect": "Allow",
            "Action": [
                "ec2:*",
                "rds:*",
                "lambda:*",
                "eks:*",
                "s3:*",
                "vpc:*",
                "iam:ListRoles",
                "iam:PassRole"
            ],
            "Resource": "*"
        }
    ]
}
```

## 🔒 Security Configuration

### SSL/TLS Setup
```bash
# Install Certbot
sudo apt install certbot python3-certbot-nginx

# Get SSL certificate
sudo certbot --nginx -d your-domain.com

# Auto-renewal
sudo crontab -e
# Add: 0 12 * * * /usr/bin/certbot renew --quiet
```

### Firewall Configuration
```bash
# UFW (Ubuntu)
sudo ufw allow ssh
sudo ufw allow http
sudo ufw allow https
sudo ufw enable

# Firewalld (CentOS/RHEL)
sudo firewall-cmd --permanent --add-service=ssh
sudo firewall-cmd --permanent --add-service=http
sudo firewall-cmd --permanent --add-service=https
sudo firewall-cmd --reload
```

### Security Hardening
1. Change default database passwords
2. Update JWT secrets
3. Configure proper file permissions
4. Enable fail2ban for SSH protection
5. Regular security updates

## 📊 Monitoring and Maintenance

### Service Status
```bash
# Check all services
sudo systemctl status terraform-dashboard-backend
sudo systemctl status terraform-dashboard-ansible
sudo systemctl status nginx
sudo systemctl status postgresql
sudo systemctl status redis

# Docker status
docker-compose ps
```

### Logs
```bash
# Native installation
sudo journalctl -u terraform-dashboard-backend -f
sudo journalctl -u terraform-dashboard-ansible -f
sudo tail -f /var/log/nginx/access.log

# Docker
docker-compose logs -f backend
docker-compose logs -f ansible-api
docker-compose logs -f frontend
```

### Backup
```bash
# Database backup
pg_dump -h localhost -U dashboard_user terraform_dashboard > backup.sql

# Application backup
tar -czf terraform-dashboard-backup.tar.gz /opt/terraform-dashboard
```

### Updates
```bash
# Native installation
cd /opt/terraform-dashboard/terraform-dashboard
sudo -u dashboard git pull origin main
sudo -u dashboard npm install --production
sudo -u dashboard npm run build
sudo systemctl restart terraform-dashboard-backend

# Docker
cd terraform-dashboard
git pull origin main
docker-compose build
docker-compose up -d
```

## 🆘 Troubleshooting

### Common Issues

#### Backend won't start
```bash
# Check logs
sudo journalctl -u terraform-dashboard-backend -n 50

# Check database connection
sudo -u postgres psql -c "\l"

# Check environment variables
sudo -u dashboard cat /opt/terraform-dashboard/terraform-dashboard/backend/.env
```

#### Frontend not loading
```bash
# Check Nginx status
sudo systemctl status nginx

# Check Nginx configuration
sudo nginx -t

# Check build files
ls -la /opt/terraform-dashboard/terraform-dashboard/frontend/build/
```

#### AWS integration not working
```bash
# Test AWS credentials
aws sts get-caller-identity

# Check environment variables
echo $AWS_ACCESS_KEY_ID
echo $AWS_REGION
```

### Support

For additional support:
1. Check application logs
2. Verify all services are running
3. Confirm network connectivity
4. Review AWS permissions
5. Check GitHub repository for updates

## 🎯 Next Steps

After successful deployment:
1. Configure AWS credentials
2. Set up GitHub integration
3. Import Terraform modules
4. Configure Ansible playbooks
5. Set up monitoring and alerting
6. Configure backup procedures
7. Implement security best practices
