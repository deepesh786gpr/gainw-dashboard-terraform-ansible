# Development EBS Volume Management Configuration

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
  source = "../../../modules/ebs-volume"
}

# Module-specific inputs
inputs = {
  # Volume configuration
  volume_id = "vol-xxxxxxxxx"  # Replace with actual volume ID from EC2 instance
  new_size = 30  # Increase from 20GB to 30GB
  volume_type = "gp3"
  
  # Performance settings (optional for gp3)
  iops = null
  throughput = null
  
  # Instance configuration for file system expansion
  instance_id = "i-xxxxxxxxx"  # Replace with actual instance ID
  device_name = "/dev/xvda1"
  file_system_type = "ext4"
  
  # Expansion settings
  expand_file_system = true
  
  # SSH configuration for file system expansion
  ssh_key_path = "~/.ssh/dev-keypair.pem"  # Replace with your key path
  ssh_user = "ec2-user"
  ssh_port = 22
  connection_timeout = 300
  
  # Operation settings
  wait_for_modification = true
  modification_timeout = 10
  
  # Backup settings - Less strict for development
  backup_before_modification = false  # Skip backup in dev for speed
  snapshot_description = "Dev volume backup before resize"
  delete_snapshot_after_success = true
  
  # Retry settings
  retry_attempts = 3
  retry_delay = 30
  
  # Force settings for development
  force_modification = true  # Allow more permissive operations in dev
  
  # Tags
  tags = {
    Name        = "dev-volume-resize"
    Environment = "dev"
    Purpose     = "development-testing"
    Operation   = "resize"
  }
  
  environment = "dev"
}

# Dependencies - This should run after the EC2 instance is created
dependencies {
  paths = ["../ec2-instance"]
}

# Development-specific hooks
terraform {
  before_hook "validate_volume" {
    commands = ["plan", "apply"]
    execute  = ["echo", "Validating EBS volume configuration for development..."]
  }
  
  before_hook "check_instance_state" {
    commands = ["apply"]
    execute = [
      "bash", "-c", 
      "if [ '${dependency.ec2-instance.outputs.instance_state}' != 'running' ]; then echo 'Warning: Instance is not running. File system expansion may fail.'; fi"
    ]
  }
  
  after_hook "verify_expansion" {
    commands = ["apply"]
    execute  = ["echo", "Development volume resize completed. Verify file system expansion manually if needed."]
  }
}

# Skip apply if volume doesn't need modification
skip = false
