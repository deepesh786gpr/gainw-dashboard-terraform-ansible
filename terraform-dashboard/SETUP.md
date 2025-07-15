# Terraform Dashboard Setup Guide

## 🚀 Quick Start

### Prerequisites

1. **Node.js 18+** - [Download here](https://nodejs.org/)
2. **AWS CLI configured** - [Setup guide](https://docs.aws.amazon.com/cli/latest/userguide/getting-started-install.html)
3. **Terraform** (optional but recommended) - [Download here](https://www.terraform.io/downloads)
4. **Terragrunt** (optional) - [Download here](https://terragrunt.gruntwork.io/docs/getting-started/install/)

### Installation

1. **Clone or extract the project:**
   ```bash
   cd terraform-dashboard
   ```

2. **Run the setup script:**
   ```bash
   ./start.sh
   ```

3. **Configure AWS credentials:**
   - Edit `backend/.env` with your AWS credentials
   - Or ensure AWS CLI is configured with `aws configure`

4. **Access the dashboard:**
   - Frontend: http://localhost:3000
   - Backend API: http://localhost:5000

## 📋 Manual Setup

If you prefer manual setup:

### 1. Install Dependencies

```bash
# Install root dependencies
npm install

# Install backend dependencies
cd backend && npm install && cd ..

# Install frontend dependencies
cd frontend && npm install && cd ..
```

### 2. Configure Environment

```bash
# Copy environment template
cp backend/.env.example backend/.env

# Edit the configuration
nano backend/.env
```

### 3. Build and Start

```bash
# Build backend
cd backend && npm run build && cd ..

# Start both frontend and backend
npm run dev
```

## ⚙️ Configuration

### Environment Variables

Edit `backend/.env`:

```bash
# Server Configuration
PORT=5000
NODE_ENV=development
FRONTEND_URL=http://localhost:3000

# AWS Configuration
AWS_REGION=us-east-1
AWS_ACCESS_KEY_ID=your-access-key
AWS_SECRET_ACCESS_KEY=your-secret-key

# JWT Secret (change in production)
JWT_SECRET=your-super-secret-jwt-key

# Terraform Paths
TERRAFORM_PATH=/usr/local/bin/terraform
TERRAGRUNT_PATH=/usr/local/bin/terragrunt
```

### AWS Permissions

Your AWS user/role needs these permissions:

```json
{
  "Version": "2012-10-17",
  "Statement": [
    {
      "Effect": "Allow",
      "Action": [
        "ec2:*",
        "iam:ListRoles",
        "iam:PassRole",
        "s3:*",
        "cloudwatch:GetMetricStatistics",
        "cloudwatch:ListMetrics"
      ],
      "Resource": "*"
    }
  ]
}
```

## 🐳 Docker Setup

### Using Docker Compose

1. **Set environment variables:**
   ```bash
   export AWS_ACCESS_KEY_ID=your-access-key
   export AWS_SECRET_ACCESS_KEY=your-secret-key
   export AWS_REGION=us-east-1
   ```

2. **Start with Docker:**
   ```bash
   docker-compose up -d
   ```

3. **View logs:**
   ```bash
   docker-compose logs -f
   ```

### Manual Docker Build

```bash
# Build images
docker-compose build

# Start services
docker-compose up -d

# Stop services
docker-compose down
```

## 🎯 First Time Setup

### 1. Create Admin User

When you first access the dashboard:

1. Go to http://localhost:3000
2. You'll be prompted to create an admin user
3. Fill in the registration form
4. Login with your new credentials

### 2. Configure Settings

1. Go to Settings → AWS Configuration
2. Set your AWS region and credentials
3. Test the connection
4. Configure Terraform paths if needed

### 3. Create Your First Template

1. Go to Templates
2. Click "New Template"
3. Use the built-in EC2 template or create your own
4. Define variables and Terraform code

### 4. Deploy Infrastructure

1. Go to Deployments
2. Click "New Deployment"
3. Select a template
4. Fill in variables
5. Review and deploy

## 🛠️ Features Overview

### 📊 Dashboard
- Real-time infrastructure overview
- Instance status monitoring
- Recent activity tracking
- Quick action buttons

### 🚀 Deployments
- Interactive deployment wizard
- Variable form generation
- Real-time progress tracking
- Plan/Apply/Destroy operations

### 💻 Instance Management
- List all EC2 instances
- Start/Stop/Reboot instances
- Schedule automated actions
- View instance metrics

### 📝 Template Management
- Create custom Terraform modules
- Variable type validation
- Template categories
- Usage tracking

### ⚙️ Settings
- AWS configuration
- Terraform settings
- Notification preferences
- Security policies

## 🔧 Troubleshooting

### Common Issues

1. **Port already in use:**
   ```bash
   # Kill processes on ports 3000 and 5000
   lsof -ti:3000 | xargs kill -9
   lsof -ti:5000 | xargs kill -9
   ```

2. **AWS credentials not working:**
   ```bash
   # Test AWS CLI
   aws sts get-caller-identity
   
   # Check credentials file
   cat ~/.aws/credentials
   ```

3. **Terraform not found:**
   ```bash
   # Install Terraform
   brew install terraform  # macOS
   # or download from https://www.terraform.io/downloads
   ```

4. **Database issues:**
   ```bash
   # Remove database and restart
   rm backend/data/terraform-dashboard.db
   npm run dev
   ```

### Logs

- Backend logs: `backend/logs/terraform-dashboard.log`
- Frontend logs: Browser console
- Docker logs: `docker-compose logs`

## 🔒 Security

### Production Deployment

1. **Change JWT secret:**
   ```bash
   JWT_SECRET=$(openssl rand -base64 32)
   ```

2. **Use HTTPS:**
   - Configure reverse proxy (nginx/Apache)
   - Use SSL certificates

3. **Restrict access:**
   - Use VPN or IP whitelisting
   - Configure firewall rules

4. **Secure AWS credentials:**
   - Use IAM roles instead of access keys
   - Rotate credentials regularly

## 📚 API Documentation

### Authentication
```bash
# Login
curl -X POST http://localhost:5000/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{"username":"admin","password":"password"}'

# Use token in subsequent requests
curl -H "Authorization: Bearer YOUR_TOKEN" \
  http://localhost:5000/api/instances
```

### Endpoints

- `GET /api/instances` - List EC2 instances
- `POST /api/instances/:id/start` - Start instance
- `POST /api/instances/:id/stop` - Stop instance
- `GET /api/templates` - List templates
- `POST /api/templates` - Create template
- `POST /api/terraform/plan` - Plan deployment
- `POST /api/terraform/apply` - Apply deployment

## 🤝 Support

- **Documentation:** Check this README and inline help
- **Issues:** Create GitHub issues for bugs
- **Features:** Submit feature requests
- **Community:** Join discussions

## 📄 License

MIT License - see LICENSE file for details.
