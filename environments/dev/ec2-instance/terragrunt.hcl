# Development EC2 Instance Configuration

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
  
  # Networking
  vpc_id = "vpc-0517ba79e83effc5c"  # Default VPC
  subnet_id = "subnet-0ef4db73b57df6c35"  # us-east-1a subnet
  
  # Security
  create_security_group = true
  security_group_name = "${local.name_prefix}-sg"
  allowed_cidr_blocks = ["10.0.0.0/8"]
  ssh_port = 22
  
  # Additional ports for web server
  additional_ports = [
    {
      port        = 80
      protocol    = "tcp"
      cidr_blocks = ["10.0.0.0/8"]
      description = "HTTP access"
    },
    {
      port        = 443
      protocol    = "tcp"
      cidr_blocks = ["10.0.0.0/8"]
      description = "HTTPS access"
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
  
  # User data script for basic setup
  user_data = base64encode(<<-EOF
    #!/bin/bash
    yum update -y
    yum install -y httpd
    systemctl start httpd
    systemctl enable httpd
    
    # Create a simple index page
    echo "<h1>Development Web Server</h1>" > /var/www/html/index.html
    echo "<p>Instance ID: $(curl -s http://169.254.169.254/latest/meta-data/instance-id)</p>" >> /var/www/html/index.html
    echo "<p>Environment: Development</p>" >> /var/www/html/index.html
    
    # Install CloudWatch agent
    wget https://s3.amazonaws.com/amazoncloudwatch-agent/amazon_linux/amd64/latest/amazon-cloudwatch-agent.rpm
    rpm -U ./amazon-cloudwatch-agent.rpm
    
    # Format and mount additional volume
    if [ -e /dev/xvdf ]; then
      mkfs -t ext4 /dev/xvdf
      mkdir /data
      mount /dev/xvdf /data
      echo '/dev/xvdf /data ext4 defaults,nofail 0 2' >> /etc/fstab
    fi
  EOF
  )
  
  user_data_base64 = true
  
  # Networking
  associate_public_ip = false  # Use private IP in dev
  
  # Monitoring and management
  enable_detailed_monitoring = false
  enable_termination_protection = false
  
  # Tags
  instance_tags = {
    Name        = "${local.name_prefix}-01"
    Role        = "web-server"
    Application = "demo-app"
    Backup      = "daily"
  }
  
  volume_tags = {
    Name        = "${local.name_prefix}-volume"
    Application = "demo-app"
  }
  
  environment = "dev"
}

# Dependencies
dependencies {
  paths = []
}

# Hooks for additional operations
terraform {
  before_hook "validate_inputs" {
    commands = ["plan", "apply"]
    execute  = ["echo", "Validating development EC2 instance configuration..."]
  }
  
  after_hook "display_outputs" {
    commands = ["apply"]
    execute  = ["echo", "Development EC2 instance deployment completed. Check outputs for connection details."]
  }
}
