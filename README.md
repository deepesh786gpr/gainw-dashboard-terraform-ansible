# AWS EC2 Management with Terraform and Terragrunt

A comprehensive, production-ready AWS EC2 management solution using Terraform modules and Terragrunt for environment management. This project provides a complete infrastructure-as-code framework for deploying, managing, and operating EC2 instances with advanced features like automated volume management, instance operations, and comprehensive monitoring.

## 🚀 Quick Start

```bash
# 1. Validate your setup
./scripts/validate-setup.sh

# 2. Update configuration files with your AWS details
# Edit environments/dev/ec2-instance/terragrunt.hcl

# 3. Deploy your first instance
cd environments/dev/ec2-instance
terragrunt plan && terragrunt apply

# 4. Run integration tests
cd ../../.. && ./scripts/test-deployment.sh
```

**👉 [Complete Getting Started Guide](GETTING_STARTED.md)**

## 📁 Project Structure

```
.
├── modules/                    # 🧩 Reusable Terraform modules
│   ├── ec2-instance/          #   └── Core EC2 instance deployment
│   ├── ebs-volume/            #   └── EBS volume management & expansion
│   └── ec2-operations/        #   └── Instance operations & health checks
├── environments/              # 🌍 Environment-specific configurations
│   ├── dev/                   #   └── Development environment
│   ├── staging/               #   └── Staging environment (template)
│   └── prod/                  #   └── Production environment
├── common/                    # 🔧 Shared configurations and variables
├── examples/                  # 📚 Usage examples and templates
│   └── basic-web-server/      #   └── Complete web server example
├── docs/                      # 📖 Comprehensive documentation
├── scripts/                   # 🛠️ Validation and testing scripts
└── terragrunt.hcl            # 🏗️ Root Terragrunt configuration
```

## ✨ Features

### 🚀 **EC2 Instance Deployment**
- **Smart AMI Selection**: Automatic latest AMI detection with fallback options
- **Flexible Networking**: VPC, subnet, and security group management
- **Custom User Data**: Automated instance initialization scripts
- **Multiple Storage Options**: Root and additional EBS volumes with encryption
- **Comprehensive Tagging**: Automated and custom tagging strategies

### 💾 **EBS Volume Management**
- **Dynamic Resizing**: Increase volume sizes with validation and safety checks
- **Automated File System Expansion**: Support for ext4 and XFS file systems
- **Backup Integration**: Pre-modification snapshots with retention policies
- **Performance Tuning**: IOPS and throughput optimization for gp3 volumes
- **Retry Mechanisms**: Robust error handling and retry logic

### 🔄 **Instance Management Operations**
- **Lifecycle Management**: Start, stop, restart, and terminate operations
- **Health Monitoring**: HTTP and SSH connectivity checks
- **Status Reporting**: Comprehensive instance and system status monitoring
- **Notification Integration**: SNS and Slack notifications for operations
- **Maintenance Windows**: Scheduled operations with safety validations

### 🏗️ **Infrastructure as Code**
- **DRY Configuration**: Terragrunt for environment-specific configurations
- **Modular Design**: Reusable modules with comprehensive input validation
- **Environment Isolation**: Separate state management for dev/staging/prod
- **Version Control**: Git-friendly configuration with proper .gitignore
- **CI/CD Ready**: Hooks and validation for automated deployments

## 📚 Documentation

| Document | Description |
|----------|-------------|
| **[Getting Started](GETTING_STARTED.md)** | Complete setup and deployment guide |
| **[Usage Guide](docs/usage-guide.md)** | Detailed usage instructions and examples |
| **[Module Documentation](docs/modules.md)** | Comprehensive module reference |
| **[Troubleshooting](docs/troubleshooting.md)** | Common issues and solutions |
| **[Examples](examples/README.md)** | Practical usage examples |

## 🧩 Module Overview

### **EC2 Instance Module** (`modules/ec2-instance/`)
Complete EC2 instance deployment with security groups, storage, and networking.

**Key Features:**
- Automated AMI selection with data sources
- Configurable security groups with custom rules
- Multiple EBS volume support with encryption
- User data script execution and validation
- Comprehensive output values for integration

### **EBS Volume Module** (`modules/ebs-volume/`)
Advanced EBS volume management with automated file system expansion.

**Key Features:**
- Volume size increase with safety validations
- Automated file system expansion (ext4/xfs)
- Pre-modification backup creation
- SSH-based remote execution with retry logic
- Performance optimization for gp3 volumes

### **EC2 Operations Module** (`modules/ec2-operations/`)
Instance lifecycle management with monitoring and notifications.

**Key Features:**
- Multiple operations (start, stop, restart, status)
- HTTP and SSH health checks
- CloudWatch logging integration
- SNS and Slack notification support
- Maintenance window enforcement

## 🌍 Environment Management

| Environment | Purpose | Configuration |
|-------------|---------|---------------|
| **Development** | Testing and development | Smaller instances, relaxed security, no backups |
| **Staging** | Pre-production testing | Production-like setup with cost optimizations |
| **Production** | Live workloads | Enhanced security, monitoring, and backup policies |

Each environment includes:
- ✅ Isolated Terraform state management
- ✅ Environment-specific variable configurations
- ✅ Customized security and compliance settings
- ✅ Appropriate resource sizing and cost controls

## 🛠️ Validation and Testing

### **Automated Validation**
```bash
# Comprehensive setup validation
./scripts/validate-setup.sh

# Integration testing
./scripts/test-deployment.sh
```

### **Manual Testing**
```bash
# Test individual modules
cd modules/ec2-instance && terraform validate
cd modules/ebs-volume && terraform validate
cd modules/ec2-operations && terraform validate

# Test environment configurations
cd environments/dev && terragrunt validate-inputs
cd environments/prod && terragrunt validate-inputs
```

## 🔧 Configuration Examples

### **Basic Web Server**
```hcl
# Deploy a simple web server
module "web_server" {
  source = "./modules/ec2-instance"

  name = "web-server-01"
  instance_type = "t3.small"
  vpc_id = "vpc-12345678"
  subnet_id = "subnet-12345678"

  additional_ports = [{
    port = 80
    protocol = "tcp"
    cidr_blocks = ["0.0.0.0/0"]
    description = "HTTP access"
  }]

  user_data = base64encode(file("scripts/web-server-setup.sh"))
}
```

### **Volume Management**
```hcl
# Increase EBS volume size
module "volume_resize" {
  source = "./modules/ebs-volume"

  volume_id = "vol-12345678"
  new_size = 100
  instance_id = "i-12345678"
  expand_file_system = true
  backup_before_modification = true
}
```

### **Instance Operations**
```hcl
# Restart instance with health checks
module "restart_operation" {
  source = "./modules/ec2-operations"

  instance_id = "i-12345678"
  operation = "restart"
  health_check_enabled = true
  notification_enabled = true
}
```

## 🤝 Contributing

We welcome contributions! Please see our contributing guidelines:

1. **Fork the repository** and create a feature branch
2. **Follow Terraform best practices** and module conventions
3. **Add comprehensive tests** for new functionality
4. **Update documentation** for any changes
5. **Test in development environment** before submitting PR

### **Development Workflow**
```bash
# 1. Validate changes
./scripts/validate-setup.sh

# 2. Run tests
./scripts/test-deployment.sh

# 3. Test in development
cd environments/dev && terragrunt plan

# 4. Submit PR with detailed description
```

## 📞 Support

### **Getting Help**
- 📖 **Documentation**: Check the comprehensive docs in `/docs`
- 🐛 **Issues**: Create GitHub issues for bugs or feature requests
- 💬 **Discussions**: Use GitHub Discussions for questions
- 🔍 **Troubleshooting**: See [troubleshooting guide](docs/troubleshooting.md)

### **Common Issues**
- **AWS Permissions**: Ensure proper IAM permissions are configured
- **Resource Limits**: Check AWS service quotas and limits
- **Network Configuration**: Verify VPC, subnet, and security group settings
- **State Management**: Ensure S3 bucket and DynamoDB table are properly configured

## 📄 License

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.

## 🏷️ Tags

`terraform` `terragrunt` `aws` `ec2` `infrastructure-as-code` `devops` `automation` `cloud` `ebs` `volume-management`
