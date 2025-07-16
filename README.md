# 🚀 Terraform Dashboard

A comprehensive web-based dashboard for managing Terraform infrastructure, AWS resources, and Ansible automation with GitHub integration.

![Terraform Dashboard](https://img.shields.io/badge/Terraform-Dashboard-blue?style=for-the-badge&logo=terraform)
![Node.js](https://img.shields.io/badge/Node.js-18+-green?style=for-the-badge&logo=node.js)
![React](https://img.shields.io/badge/React-18+-blue?style=for-the-badge&logo=react)
![TypeScript](https://img.shields.io/badge/TypeScript-5+-blue?style=for-the-badge&logo=typescript)
![AWS](https://img.shields.io/badge/AWS-Integration-orange?style=for-the-badge&logo=amazon-aws)

## ✨ Features

### 🏗️ Infrastructure Management
- **Terraform Integration**: Deploy and manage Terraform configurations
- **Terragrunt Support**: Advanced Terraform workflow management
- **AWS Resource Management**: EC2, RDS, Lambda, EKS, S3, VPC resources
- **Real-time Monitoring**: Live status updates and resource tracking

### 🤖 Automation & Orchestration
- **Ansible Integration**: Execute playbooks for AWS services
- **GitHub Integration**: Import and manage infrastructure code
- **Template Management**: Reusable infrastructure templates
- **Deployment Pipelines**: Automated deployment workflows

### 📊 Dashboard & Analytics
- **Resource Dashboard**: Comprehensive view of AWS resources
- **VPC Resources**: Hierarchical view of VPCs and associated resources
- **Cost Analysis**: Infrastructure cost tracking and optimization
- **Security Center**: Security compliance and monitoring

### 🔐 Security & Authentication
- **User Authentication**: JWT-based secure authentication
- **Role-based Access**: Multiple user roles and permissions
- **GitHub OAuth**: Seamless GitHub integration
- **Token Management**: Secure API token handling

## 🏗️ Architecture

```
┌─────────────────┐    ┌─────────────────┐    ┌─────────────────┐
│   Frontend      │    │   Backend API   │    │  Ansible API    │
│   (React)       │◄──►│   (Node.js)     │◄──►│   (Node.js)     │
│   Port: 3000    │    │   Port: 5000    │    │   Port: 5001    │
└─────────────────┘    └─────────────────┘    └─────────────────┘
         │                       │                       │
         │                       ▼                       ▼
         │              ┌─────────────────┐    ┌─────────────────┐
         │              │   PostgreSQL    │    │  Ansible        │
         │              │   Database      │    │  Playbooks      │
         │              └─────────────────┘    └─────────────────┘
         │                       │
         ▼                       ▼
┌─────────────────┐    ┌─────────────────┐
│     Nginx       │    │     Redis       │
│  Reverse Proxy  │    │     Cache       │
└─────────────────┘    └─────────────────┘
```

## 🚀 Quick Start

### Prerequisites
- Node.js 18+ 
- PostgreSQL 12+
- Redis 6+
- Python 3.8+ (for Ansible)
- AWS CLI configured
- Git

### Option 1: Automated Deployment (Recommended)
```bash
# Download and run deployment script
curl -fsSL https://raw.githubusercontent.com/yourusername/terraform-dashboard/main/deploy-terraform-dashboard.sh -o deploy.sh
chmod +x deploy.sh
sudo ./deploy.sh --domain your-domain.com
```

### Option 2: Docker Compose
```bash
# Clone repository
git clone https://github.com/yourusername/terraform-dashboard.git
cd terraform-dashboard

# Configure environment
cp .env.example .env
# Edit .env with your settings

# Start services
docker-compose up -d
```

### Option 3: Local Development
```bash
# Clone repository
git clone https://github.com/yourusername/terraform-dashboard.git
cd terraform-dashboard

# Backend setup
cd backend
npm install
npm run build
npm start

# Frontend setup (new terminal)
cd frontend
npm install
npm start

# Ansible API setup (new terminal)
cd backend
node ansible-api-server.js
```

## 📋 Project Structure

```
terraform-dashboard/
├── frontend/                 # React frontend application
│   ├── src/
│   │   ├── components/      # Reusable UI components
│   │   ├── pages/          # Page components
│   │   ├── contexts/       # React contexts
│   │   └── utils/          # Utility functions
│   ├── public/             # Static assets
│   └── package.json
├── backend/                 # Node.js backend API
│   ├── src/
│   │   ├── routes/         # API routes
│   │   ├── services/       # Business logic
│   │   ├── middleware/     # Express middleware
│   │   └── database/       # Database configuration
│   ├── ansible-api-server.js # Ansible API server
│   └── package.json
├── ansible-aws-playbooks/   # Ansible playbooks
│   ├── ec2/               # EC2 management playbooks
│   ├── rds/               # RDS management playbooks
│   ├── lambda/            # Lambda management playbooks
│   └── eks/               # EKS management playbooks
├── deploy-terraform-dashboard.sh # Deployment script
├── docker-compose.yml      # Docker composition
└── DEPLOYMENT.md          # Deployment guide
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

# Ansible
ANSIBLE_PLAYBOOKS_DIR=/path/to/ansible-aws-playbooks

# GitHub (Optional)
GITHUB_CLIENT_ID=your_github_client_id
GITHUB_CLIENT_SECRET=your_github_client_secret
```

#### Frontend (.env)
```bash
REACT_APP_API_URL=http://localhost:5000
REACT_APP_ENVIRONMENT=development
```

## 🐳 Docker Deployment

### Services
- **Frontend**: Nginx serving React app (Port 80/443)
- **Backend**: Node.js API server (Port 5000)
- **Ansible API**: Ansible execution server (Port 5001)
- **PostgreSQL**: Database (Port 5432)
- **Redis**: Cache and sessions (Port 6379)

### Commands
```bash
# Start all services
docker-compose up -d

# View logs
docker-compose logs -f

# Stop services
docker-compose down

# Rebuild and restart
docker-compose build && docker-compose up -d
```

## 📊 API Endpoints

### Authentication
- `POST /api/auth/login` - User login
- `POST /api/auth/register` - User registration
- `POST /api/auth/refresh` - Refresh token
- `POST /api/auth/logout` - User logout

### Infrastructure
- `GET /api/instances` - List EC2 instances
- `POST /api/instances/:id/start` - Start instance
- `POST /api/instances/:id/stop` - Stop instance
- `GET /api/vpc-resources` - List VPC resources
- `GET /api/deployments` - List deployments

### Ansible
- `GET /ansible-api/playbooks` - List available playbooks
- `POST /ansible-api/execute` - Execute playbook
- `GET /ansible-api/status/:id` - Get execution status

### GitHub
- `GET /api/github/repos` - List repositories
- `POST /api/github/import` - Import repository
- `GET /api/github/tokens` - List GitHub tokens

## 🔒 Security

### Best Practices
1. **Environment Variables**: Never commit secrets to version control
2. **JWT Secrets**: Use strong, unique secrets for production
3. **Database Security**: Use strong passwords and restrict access
4. **HTTPS**: Always use SSL/TLS in production
5. **Firewall**: Configure proper firewall rules
6. **Updates**: Keep dependencies updated

## 📊 Monitoring

### Health Checks
- Frontend: `GET /health`
- Backend: `GET /api/health`
- Ansible API: `GET /health`

### Logging
- Application logs: `/var/log/terraform-dashboard/`
- Nginx logs: `/var/log/nginx/`
- System logs: `journalctl -u terraform-dashboard-*`

## 🤝 Contributing

1. Fork the repository
2. Create a feature branch (`git checkout -b feature/amazing-feature`)
3. Commit your changes (`git commit -m 'Add amazing feature'`)
4. Push to the branch (`git push origin feature/amazing-feature`)
5. Open a Pull Request

## 📝 License

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.

## 🆘 Support

### Documentation
- [Deployment Guide](DEPLOYMENT.md)
- [Troubleshooting Guide](docs/TROUBLESHOOTING.md)

### Getting Help
1. Check the documentation
2. Search existing issues
3. Create a new issue with detailed information

## 🎯 Roadmap

### Current Version (v1.0)
- ✅ Basic Terraform integration
- ✅ AWS resource management
- ✅ Ansible automation
- ✅ GitHub integration
- ✅ User authentication

### Upcoming Features (v1.1)
- [ ] Multi-cloud support (Azure, GCP)
- [ ] Advanced monitoring and alerting
- [ ] Infrastructure as Code templates
- [ ] Team collaboration features

---

**Made with ❤️ by the Terraform Dashboard Team**
