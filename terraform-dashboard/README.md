# Terraform Dashboard

A comprehensive web application for managing Terraform infrastructure with an intuitive GUI interface. Deploy and manage AWS resources including EKS clusters, RDS databases, Lambda functions, and EC2 instances with real-time modification capabilities.

## 🚀 New Features Added

### ✅ **Enhanced Infrastructure Templates**
- **EKS Cluster**: Complete Kubernetes cluster with VPC, node groups, and security
- **RDS Database**: Multi-engine database with HA, backups, and encryption
- **Lambda Function**: Serverless functions with API Gateway integration
- **Enhanced EC2**: Advanced instance management with comprehensive options

### ✅ **Real-time Instance Management**
- **Live Modification**: Change running instances through GUI
- **Instance Operations**: Start, stop, restart, and schedule actions
- **Detailed Monitoring**: CloudWatch metrics integration
- **Tag Management**: Dynamic tag editing and management

### ✅ **Advanced GUI Features**
- **Form Validation**: Real-time validation for all templates
- **Variable Management**: Dynamic form generation based on template variables
- **Deployment Tracking**: Monitor deployment status and logs
- **Instance Scheduling**: Automated start/stop scheduling

## Features

### 🚀 **Core Functionality**
- **Interactive Terraform Management**: Plan, apply, and destroy infrastructure through a web interface
- **Variable Management**: Easy-to-use forms for setting Terraform variables
- **Module Templates**: Create and manage custom Terraform module templates
- **Real-time Deployment**: Live progress tracking for Terraform operations

### 🎛️ **Dashboard Features**
- **EC2 Instance Management**: List, monitor, and manage running instances
- **Instance Scheduling**: Schedule EC2 instances to start/stop automatically
- **Resource Monitoring**: Real-time status of your AWS resources
- **Deployment History**: Track all deployments with logs and status

### 🛠️ **Advanced Features**
- **Custom Module Builder**: Create your own Terraform modules with variable definitions
- **Template Library**: Pre-built templates for common infrastructure patterns
- **Variable Validation**: Built-in validation for Terraform variables
- **Multi-Environment Support**: Manage dev, staging, and production environments

## Architecture

```
terraform-dashboard/
├── frontend/          # React.js dashboard application
├── backend/           # Node.js API server
├── database/          # SQLite database for storing templates and history
└── docker/           # Docker configuration for deployment
```

## Quick Start

### Prerequisites
- Node.js 18+
- Docker (optional)
- AWS CLI configured
- Terraform installed

### Installation

1. **Clone and setup:**
   ```bash
   cd terraform-dashboard
   npm run setup
   ```

2. **Start development servers:**
   ```bash
   npm run dev
   ```

3. **Access the dashboard:**
   - Frontend: http://localhost:3000
   - API: http://localhost:5000

### Production Deployment

```bash
# Using Docker
docker-compose up -d

# Or manual deployment
npm run build
npm run start
```

## Usage

### 1. **Deploy Infrastructure**
- Select a module template (EC2, VPC, etc.)
- Fill in required variables through the GUI
- Review the Terraform plan
- Deploy with one click

### 2. **Manage Instances**
- View all running EC2 instances
- Start/stop instances
- Schedule automatic operations
- Monitor resource usage

### 3. **Create Custom Templates**
- Define your own Terraform modules
- Set variable types and validation rules
- Save as reusable templates
- Share with your team

## Configuration

### Environment Variables
```bash
# Backend Configuration
PORT=5000
NODE_ENV=development
DATABASE_URL=./database/terraform-dashboard.db

# AWS Configuration
AWS_REGION=us-east-1
AWS_PROFILE=default

# Terraform Configuration
TERRAFORM_PATH=/usr/local/bin/terraform
TERRAGRUNT_PATH=/usr/local/bin/terragrunt
```

### AWS Permissions
The application requires the following AWS permissions:
- EC2: Full access for instance management
- IAM: Read access for role information
- CloudWatch: Read access for monitoring
- S3: Access to Terraform state buckets

## API Endpoints

### Terraform Operations
- `POST /api/terraform/plan` - Generate Terraform plan
- `POST /api/terraform/apply` - Apply Terraform configuration
- `POST /api/terraform/destroy` - Destroy infrastructure
- `GET /api/terraform/status` - Get operation status

### Instance Management
- `GET /api/instances` - List EC2 instances
- `POST /api/instances/:id/start` - Start instance
- `POST /api/instances/:id/stop` - Stop instance
- `POST /api/instances/:id/schedule` - Schedule operations

### Templates
- `GET /api/templates` - List available templates
- `POST /api/templates` - Create new template
- `PUT /api/templates/:id` - Update template
- `DELETE /api/templates/:id` - Delete template

## Development

### Frontend Development
```bash
cd frontend
npm install
npm start
```

### Backend Development
```bash
cd backend
npm install
npm run dev
```

### Database Setup
```bash
cd database
npm run migrate
npm run seed
```

## Contributing

1. Fork the repository
2. Create a feature branch
3. Make your changes
4. Add tests
5. Submit a pull request

## License

MIT License - see LICENSE file for details

## Support

- Documentation: [docs/](docs/)
- Issues: GitHub Issues
- Discussions: GitHub Discussions
