# Development Environment Terragrunt Configuration

# Include the root terragrunt configuration
include "root" {
  path = find_in_parent_folders()
}

# Local values specific to development environment
locals {
  environment = "dev"
  region      = "us-east-1"
  
  # Development-specific settings
  instance_type = "t3.micro"
  enable_detailed_monitoring = false
  enable_termination_protection = false
  
  # Development tags
  environment_tags = {
    Environment = "dev"
    CostCenter  = "development"
    Owner       = "dev-team"
    Purpose     = "development-testing"
  }
}

# Environment-specific inputs
inputs = {
  # AWS Configuration
  aws_region = local.region
  environment = local.environment
  
  # Default instance configuration for dev
  instance_type = local.instance_type
  enable_detailed_monitoring = local.enable_detailed_monitoring
  enable_termination_protection = local.enable_termination_protection
  
  # Networking (using default VPC)
  vpc_id = "vpc-0517ba79e83effc5c"  # Default VPC
  subnet_ids = [
    "subnet-0ef4db73b57df6c35",     # us-east-1a
    "subnet-0b9dceefd74ac1d4d"      # us-east-1b
  ]
  availability_zones = ["us-east-1a", "us-east-1b"]
  
  # Security
  allowed_cidr_blocks = ["10.0.0.0/8", "172.16.0.0/12"]  # More restrictive for dev
  ssh_port = 22
  
  # Storage
  root_volume_size = 20
  root_volume_type = "gp3"
  root_volume_encrypted = true
  
  # Key pair (using existing key pair)
  key_pair_name = "sonar"
  
  # Tags
  default_tags = merge(
    {
      Project     = "ec2-management"
      ManagedBy   = "terragrunt"
      Environment = local.environment
      Repository  = "new-dashboard"
    },
    local.environment_tags
  )
  
  # Development-specific overrides
  backup_before_operation = false  # Skip backups in dev for faster operations
  health_check_enabled = true
  notification_enabled = false     # Disable notifications in dev
  monitoring_enabled = true
  log_retention_days = 3           # Shorter retention in dev
}

# Generate environment-specific variables file
generate "dev_vars" {
  path      = "dev.auto.tfvars"
  if_exists = "overwrite"
  contents  = <<EOF
# Auto-generated development environment variables
# DO NOT EDIT MANUALLY - This file is managed by Terragrunt

environment = "${local.environment}"
aws_region  = "${local.region}"

# Instance defaults for development
instance_type = "${local.instance_type}"
enable_detailed_monitoring = ${local.enable_detailed_monitoring}
enable_termination_protection = ${local.enable_termination_protection}

# Development-specific settings
backup_retention_days = 7
snapshot_retention_days = 3
force_operation = true  # Allow more permissive operations in dev

# Cost optimization for dev
associate_public_ip = false  # Use private IPs to save costs
EOF
}
