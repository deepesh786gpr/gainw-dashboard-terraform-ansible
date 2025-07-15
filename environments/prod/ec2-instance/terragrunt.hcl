# Production EC2 Instance Configuration

# Include the environment configuration
include "env" {
  path = find_in_parent_folders("terragrunt.hcl")
}

# Include the root configuration
include "root" {
  path = find_in_parent_folders("terragrunt.hcl")
  expose = true
}

# Terraform module source
terraform {
  source = "../../../modules/ec2-instance"
}

# Local values for this specific deployment
locals {
  name_prefix = "prod-web-server"
}

# Module-specific inputs
inputs = {
  # Instance configuration
  name = "${local.name_prefix}-01"
  instance_type = "t3.small"  # Larger instance for production
  
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
  allowed_cidr_blocks = ["10.0.0.0/16"]  # More restrictive for production
  ssh_port = 22
  
  # Additional ports for web server
  additional_ports = [
    {
      port        = 80
      protocol    = "tcp"
      cidr_blocks = ["10.0.0.0/16"]
      description = "HTTP access from VPC"
    },
    {
      port        = 443
      protocol    = "tcp"
      cidr_blocks = ["10.0.0.0/16"]
      description = "HTTPS access from VPC"
    }
  ]
  
  # Key pair
  key_pair_name = "prod-key"  # Using existing production key pair
  
  # Storage - Larger volumes for production
  root_volume_size = 50
  root_volume_type = "gp3"
  root_volume_encrypted = true
  root_volume_kms_key_id = "alias/ebs-encryption-key"  # Use specific KMS key for production
  
  # Additional EBS volumes for production
  additional_ebs_volumes = [
    {
      device_name = "/dev/sdf"
      size        = 100  # Larger data volume for production
      type        = "gp3"
      encrypted   = true
      kms_key_id  = "alias/ebs-encryption-key"
    },
    {
      device_name = "/dev/sdg"
      size        = 50   # Separate log volume
      type        = "gp3"
      encrypted   = true
      kms_key_id  = "alias/ebs-encryption-key"
    }
  ]
  
  # User data script for production setup
  user_data = base64encode(<<-EOF
    #!/bin/bash
    yum update -y
    yum install -y httpd awslogs
    
    # Configure httpd
    systemctl start httpd
    systemctl enable httpd
    
    # Create production index page
    echo "<h1>Production Web Server</h1>" > /var/www/html/index.html
    echo "<p>Instance ID: $(curl -s http://169.254.169.254/latest/meta-data/instance-id)</p>" >> /var/www/html/index.html
    echo "<p>Environment: Production</p>" >> /var/www/html/index.html
    echo "<p>Deployment Time: $(date)</p>" >> /var/www/html/index.html
    
    # Install and configure CloudWatch agent
    wget https://s3.amazonaws.com/amazoncloudwatch-agent/amazon_linux/amd64/latest/amazon-cloudwatch-agent.rpm
    rpm -U ./amazon-cloudwatch-agent.rpm
    
    # Configure CloudWatch agent
    cat > /opt/aws/amazon-cloudwatch-agent/etc/amazon-cloudwatch-agent.json << 'EOL'
    {
      "metrics": {
        "namespace": "EC2/Production",
        "metrics_collected": {
          "cpu": {
            "measurement": ["cpu_usage_idle", "cpu_usage_iowait", "cpu_usage_user", "cpu_usage_system"],
            "metrics_collection_interval": 60
          },
          "disk": {
            "measurement": ["used_percent"],
            "metrics_collection_interval": 60,
            "resources": ["*"]
          },
          "mem": {
            "measurement": ["mem_used_percent"],
            "metrics_collection_interval": 60
          }
        }
      },
      "logs": {
        "logs_collected": {
          "files": {
            "collect_list": [
              {
                "file_path": "/var/log/httpd/access_log",
                "log_group_name": "/aws/ec2/production/httpd/access",
                "log_stream_name": "{instance_id}"
              },
              {
                "file_path": "/var/log/httpd/error_log",
                "log_group_name": "/aws/ec2/production/httpd/error",
                "log_stream_name": "{instance_id}"
              }
            ]
          }
        }
      }
    }
    EOL
    
    # Start CloudWatch agent
    /opt/aws/amazon-cloudwatch-agent/bin/amazon-cloudwatch-agent-ctl \
      -a fetch-config -m ec2 -c file:/opt/aws/amazon-cloudwatch-agent/etc/amazon-cloudwatch-agent.json -s
    
    # Format and mount additional volumes
    if [ -e /dev/xvdf ]; then
      mkfs -t ext4 /dev/xvdf
      mkdir /data
      mount /dev/xvdf /data
      echo '/dev/xvdf /data ext4 defaults,nofail 0 2' >> /etc/fstab
    fi
    
    if [ -e /dev/xvdg ]; then
      mkfs -t ext4 /dev/xvdg
      mkdir /logs
      mount /dev/xvdg /logs
      echo '/dev/xvdg /logs ext4 defaults,nofail 0 2' >> /etc/fstab
    fi
    
    # Configure log rotation
    cat > /etc/logrotate.d/httpd-custom << 'EOL'
    /logs/httpd/*.log {
        daily
        missingok
        rotate 30
        compress
        notifempty
        create 644 apache apache
        postrotate
            /bin/systemctl reload httpd.service > /dev/null 2>/dev/null || true
        endscript
    }
    EOL
  EOF
  )
  
  user_data_base64 = true
  
  # Networking
  associate_public_ip = false  # No public IP in production
  
  # Monitoring and management - Enhanced for production
  enable_detailed_monitoring = true
  enable_termination_protection = true
  
  # Tags
  instance_tags = {
    Name        = "${local.name_prefix}-01"
    Role        = "web-server"
    Application = "production-app"
    Backup      = "required"
    Monitoring  = "critical"
    Compliance  = "required"
  }
  
  volume_tags = {
    Name        = "${local.name_prefix}-volume"
    Application = "production-app"
    Backup      = "required"
  }
  
  environment = "prod"
}

# Dependencies
dependencies {
  paths = []
}

# Production-specific hooks
terraform {
  before_hook "validate_inputs" {
    commands = ["plan", "apply"]
    execute  = ["echo", "Validating production EC2 instance configuration..."]
  }
  
  before_hook "backup_check" {
    commands = ["apply"]
    execute  = ["echo", "Ensure backups are configured before applying production changes."]
  }
  
  after_hook "display_outputs" {
    commands = ["apply"]
    execute  = ["echo", "Production EC2 instance deployment completed. Verify monitoring and alerting."]
  }
  
  after_hook "security_reminder" {
    commands = ["apply"]
    execute  = ["echo", "REMINDER: Verify security groups, access logs, and compliance requirements."]
  }
}
