# Development EC2 Instance Configuration
# This configuration deploys an EC2 instance in the development environment
# with proper VPC integration and security configurations

# Include the root configuration (skip the environment level)
include "root" {
  path = find_in_parent_folders("terragrunt.hcl")
  skip_outputs = true
}

# Terraform module source
terraform {
  source = "../../../modules/ec2-instance"
}

# Local values for this specific deployment
locals {
  name_prefix = "dev-web-server"
  environment = "dev"

  # VPC Configuration - Use data sources instead of hardcoded values
  vpc_name_filter = "default"  # Will find default VPC
  subnet_name_filter = "*public*"  # Will find public subnets
}

# Module-specific inputs
inputs = {
  # Instance configuration
  name = "${local.name_prefix}-01"
  instance_type = "t3.micro"

  # AMI configuration - use latest Amazon Linux 2
  ami_id = ""  # Will use data source to find latest
  ami_name_filter = "amzn2-ami-hvm-*-x86_64-gp2"
  ami_owner = "amazon"

  # Networking - Use dynamic VPC/subnet discovery
  # These will be resolved by data sources in the module
  vpc_id = ""  # Will be discovered using default VPC
  subnet_id = ""  # Will be discovered using first available public subnet
  
  # Security
  create_security_group = true
  security_group_name = "${local.name_prefix}-sg"
  # Use VPC CIDR for internal access, plus specific external access
  allowed_cidr_blocks = ["172.31.0.0/16", "10.0.0.0/8"]  # Default VPC + private networks
  ssh_port = 22

  # Additional ports for web server
  additional_ports = [
    {
      port        = 80
      protocol    = "tcp"
      cidr_blocks = ["0.0.0.0/0"]  # HTTP should be publicly accessible
      description = "HTTP access from internet"
    },
    {
      port        = 443
      protocol    = "tcp"
      cidr_blocks = ["0.0.0.0/0"]  # HTTPS should be publicly accessible
      description = "HTTPS access from internet"
    },
    {
      port        = 8080
      protocol    = "tcp"
      cidr_blocks = ["172.31.0.0/16"]  # Application port for internal access
      description = "Application port for internal access"
    }
  ]
  
  # Key pair
  key_pair_name = "sonar"  # Using existing key pair
  
  # Storage
  root_volume_size = 20
  root_volume_type = "gp3"
  root_volume_encrypted = true
  
  # Additional EBS volumes for development
  additional_ebs_volumes = [
    {
      device_name = "/dev/sdf"
      size        = 10
      type        = "gp3"
      encrypted   = true
      kms_key_id  = ""
    }
  ]
  
  # Enhanced user data script with error handling and logging
  user_data = base64encode(<<-EOF
    #!/bin/bash
    set -e  # Exit on any error

    # Setup logging
    exec > >(tee /var/log/user-data.log)
    exec 2>&1

    echo "Starting user data script execution at $(date)"

    # Update system
    echo "Updating system packages..."
    yum update -y || { echo "Failed to update packages"; exit 1; }

    # Install required packages
    echo "Installing web server and utilities..."
    yum install -y httpd awscli jq || { echo "Failed to install packages"; exit 1; }

    # Configure and start web server
    echo "Configuring web server..."
    systemctl start httpd || { echo "Failed to start httpd"; exit 1; }
    systemctl enable httpd || { echo "Failed to enable httpd"; exit 1; }

    # Create enhanced index page with instance metadata
    echo "Creating web content..."
    cat > /var/www/html/index.html << 'HTML'
<!DOCTYPE html>
<html>
<head>
    <title>Development Web Server</title>
    <style>
        body { font-family: Arial, sans-serif; margin: 40px; background: #f5f5f5; }
        .container { background: white; padding: 30px; border-radius: 8px; box-shadow: 0 2px 10px rgba(0,0,0,0.1); }
        .header { color: #2196F3; border-bottom: 2px solid #2196F3; padding-bottom: 10px; }
        .info { margin: 20px 0; }
        .label { font-weight: bold; color: #333; }
        .value { color: #666; margin-left: 10px; }
    </style>
</head>
<body>
    <div class="container">
        <h1 class="header">🚀 Development Web Server</h1>
        <div class="info">
            <div><span class="label">Instance ID:</span><span class="value" id="instance-id">Loading...</span></div>
            <div><span class="label">Environment:</span><span class="value">Development</span></div>
            <div><span class="label">Region:</span><span class="value" id="region">Loading...</span></div>
            <div><span class="label">Availability Zone:</span><span class="value" id="az">Loading...</span></div>
            <div><span class="label">Instance Type:</span><span class="value" id="instance-type">Loading...</span></div>
            <div><span class="label">Private IP:</span><span class="value" id="private-ip">Loading...</span></div>
            <div><span class="label">Public IP:</span><span class="value" id="public-ip">Loading...</span></div>
            <div><span class="label">Deployment Time:</span><span class="value">$(date)</span></div>
        </div>
        <p><strong>Status:</strong> ✅ Server is running successfully!</p>
        <p><em>Managed by Terraform Dashboard</em></p>
    </div>

    <script>
        // Fetch instance metadata
        fetch('/meta-data/instance-id').then(r => r.text()).then(d => document.getElementById('instance-id').textContent = d).catch(() => {});
        fetch('/meta-data/placement/region').then(r => r.text()).then(d => document.getElementById('region').textContent = d).catch(() => {});
        fetch('/meta-data/placement/availability-zone').then(r => r.text()).then(d => document.getElementById('az').textContent = d).catch(() => {});
        fetch('/meta-data/instance-type').then(r => r.text()).then(d => document.getElementById('instance-type').textContent = d).catch(() => {});
        fetch('/meta-data/local-ipv4').then(r => r.text()).then(d => document.getElementById('private-ip').textContent = d).catch(() => {});
        fetch('/meta-data/public-ipv4').then(r => r.text()).then(d => document.getElementById('public-ip').textContent = d).catch(e => document.getElementById('public-ip').textContent = 'Not assigned');
    </script>
</body>
</html>
HTML

    # Install and configure CloudWatch agent
    echo "Installing CloudWatch agent..."
    wget -q https://s3.amazonaws.com/amazoncloudwatch-agent/amazon_linux/amd64/latest/amazon-cloudwatch-agent.rpm || { echo "Failed to download CloudWatch agent"; }
    if [ -f amazon-cloudwatch-agent.rpm ]; then
        rpm -U ./amazon-cloudwatch-agent.rpm || echo "CloudWatch agent installation failed"
        rm -f amazon-cloudwatch-agent.rpm
    fi

    # Format and mount additional volume with error handling
    echo "Checking for additional volumes..."
    if [ -e /dev/xvdf ]; then
        echo "Found additional volume /dev/xvdf, formatting and mounting..."
        # Check if already formatted
        if ! blkid /dev/xvdf; then
            mkfs -t ext4 /dev/xvdf || { echo "Failed to format volume"; exit 1; }
        fi

        # Create mount point and mount
        mkdir -p /data
        mount /dev/xvdf /data || { echo "Failed to mount volume"; exit 1; }

        # Add to fstab for persistent mounting
        if ! grep -q "/dev/xvdf" /etc/fstab; then
            echo '/dev/xvdf /data ext4 defaults,nofail 0 2' >> /etc/fstab
        fi

        # Set permissions
        chown ec2-user:ec2-user /data
        chmod 755 /data

        echo "Additional volume mounted successfully at /data"
    else
        echo "No additional volumes found"
    fi

    # Create a simple health check endpoint
    cat > /var/www/html/health << 'HEALTH'
{
  "status": "healthy",
  "timestamp": "$(date -Iseconds)",
  "service": "development-web-server",
  "version": "1.0.0"
}
HEALTH

    # Set proper permissions
    chown -R apache:apache /var/www/html
    chmod -R 644 /var/www/html/*

    echo "User data script completed successfully at $(date)"
    echo "Web server is available at http://$(curl -s http://169.254.169.254/latest/meta-data/public-ipv4 2>/dev/null || echo 'private-ip-only')"
  EOF
  )
  
  user_data_base64 = true
  
  # Networking
  associate_public_ip = true  # Enable public IP for development access
  
  # Monitoring and management
  enable_detailed_monitoring = false
  enable_termination_protection = false
  
  # Enhanced tags for better resource management
  instance_tags = {
    Name         = "${local.name_prefix}-01"
    Role         = "web-server"
    Application  = "terraform-dashboard-demo"
    Environment  = local.environment
    Backup       = "daily"
    Owner        = "terraform-dashboard"
    CostCenter   = "development"
    AutoShutdown = "true"  # For cost optimization
    Monitoring   = "enabled"
  }

  volume_tags = {
    Name        = "${local.name_prefix}-volume"
    Application = "terraform-dashboard-demo"
    Environment = local.environment
    VolumeType  = "additional-storage"
    Backup      = "daily"
  }

  environment = local.environment
}

# Dependencies - Define what this deployment depends on
dependencies {
  paths = [
    # Add VPC dependencies if using custom VPC
    # "../vpc",
    # "../security-groups",
    # "../key-pairs"
  ]
}

# Dependency validation
dependency "vpc_validation" {
  config_path = "."
  mock_outputs = {
    vpc_id = "vpc-mock"
    subnet_id = "subnet-mock"
  }
  mock_outputs_allowed_terraform_commands = ["validate", "plan"]
  skip_outputs = true
}

# Enhanced hooks for validation and post-deployment actions
terraform {
  before_hook "validate_inputs" {
    commands = ["plan", "apply"]
    execute  = ["echo", "🔍 Validating development EC2 instance configuration..."]
  }

  before_hook "check_aws_credentials" {
    commands = ["plan", "apply"]
    execute  = ["bash", "-c", "aws sts get-caller-identity > /dev/null || { echo '❌ AWS credentials not configured'; exit 1; }"]
  }

  after_hook "display_outputs" {
    commands = ["apply"]
    execute  = ["echo", "✅ Development EC2 instance deployment completed. Check outputs for connection details."]
  }

  after_hook "show_connection_info" {
    commands = ["apply"]
    execute  = ["bash", "-c", "echo '🌐 Web server will be available at: http://$(terragrunt output -raw public_ip 2>/dev/null || echo 'pending')'"]
  }

  # Error handling hook
  error_hook "deployment_failed" {
    commands = ["plan", "apply"]
    execute  = ["echo", "❌ Deployment failed. Check the logs above for details."]
  }
}
