# Production Environment Terragrunt Configuration

# Include the root terragrunt configuration
include "root" {
  path = find_in_parent_folders()
}

# Local values specific to production environment
locals {
  environment = "prod"
  region      = "us-east-1"
  
  # Production-specific settings
  instance_type = "t3.small"  # Larger instance for production
  enable_detailed_monitoring = true
  enable_termination_protection = true
  
  # Production tags
  environment_tags = {
    Environment = "prod"
    CostCenter  = "production"
    Owner       = "ops-team"
    Purpose     = "production-workload"
    Backup      = "required"
    Monitoring  = "critical"
  }
}

# Environment-specific inputs
inputs = {
  # AWS Configuration
  aws_region = local.region
  environment = local.environment
  
  # Production instance configuration
  instance_type = local.instance_type
  enable_detailed_monitoring = local.enable_detailed_monitoring
  enable_termination_protection = local.enable_termination_protection
  
  # Networking (using default VPC for demo)
  vpc_id = "vpc-0517ba79e83effc5c"  # Default VPC
  subnet_ids = [
    "subnet-0ef4db73b57df6c35",     # us-east-1a
    "subnet-0b9dceefd74ac1d4d"      # us-east-1b
  ]
  availability_zones = ["us-east-1a", "us-east-1b"]
  
  # Security - More restrictive for production
  allowed_cidr_blocks = ["10.0.0.0/16"]  # Very restrictive for prod
  ssh_port = 22
  
  # Storage - Larger and more robust for production
  root_volume_size = 50
  root_volume_type = "gp3"
  root_volume_encrypted = true
  
  # Key pair (using existing production key pair)
  key_pair_name = "prod-key"
  
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
  
  # Production-specific settings
  backup_before_operation = true   # Always backup in production
  health_check_enabled = true
  notification_enabled = true      # Enable notifications in production
  monitoring_enabled = true
  log_retention_days = 30          # Longer retention in production
  
  # Production safety settings
  force_operation = false          # Require explicit confirmation for risky operations
  pre_operation_checks = true
  post_operation_checks = true
  rollback_enabled = true
}

# Generate environment-specific variables file
generate "prod_vars" {
  path      = "prod.auto.tfvars"
  if_exists = "overwrite"
  contents  = <<EOF
# Auto-generated production environment variables
# DO NOT EDIT MANUALLY - This file is managed by Terragrunt

environment = "${local.environment}"
aws_region  = "${local.region}"

# Instance defaults for production
instance_type = "${local.instance_type}"
enable_detailed_monitoring = ${local.enable_detailed_monitoring}
enable_termination_protection = ${local.enable_termination_protection}

# Production-specific settings
backup_retention_days = 30
snapshot_retention_days = 30
maintenance_window = "02:00-04:00"  # 2-4 AM UTC maintenance window

# Production safety and compliance
associate_public_ip = false  # No public IPs in production
delete_snapshot_after_success = false  # Keep backups in production
retry_attempts = 5
connection_timeout = 600  # Longer timeout for production
EOF
}

# Production-specific remote state configuration
remote_state {
  backend = "s3"
  
  config = {
    # Use separate state bucket for production
    bucket = "terraform-state-prod-${get_env("AWS_ACCOUNT_ID", "default")}-${local.region}"
    key    = "${path_relative_to_include()}/terraform.tfstate"
    region = local.region
    
    encrypt        = true
    dynamodb_table = "terraform-locks-prod"
    
    # Enhanced security for production state
    versioning = true
    mfa_delete = true
    
    # S3 bucket policies for production
    server_side_encryption_configuration = {
      rule = {
        apply_server_side_encryption_by_default = {
          sse_algorithm     = "aws:kms"
          kms_master_key_id = "alias/terraform-state-key"
        }
      }
    }
    
    # Additional security
    block_public_acls       = true
    block_public_policy     = true
    ignore_public_acls      = true
    restrict_public_buckets = true
  }
}
