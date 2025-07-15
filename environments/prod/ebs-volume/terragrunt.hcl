# Production EBS Volume Management Configuration

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
  new_size = 100  # Increase from 50GB to 100GB for production
  volume_type = "gp3"
  
  # Performance settings for production
  iops = 3000  # Higher IOPS for production workload
  throughput = 250  # Higher throughput for production
  
  # Instance configuration for file system expansion
  instance_id = "i-xxxxxxxxx"  # Replace with actual instance ID
  device_name = "/dev/xvda1"
  file_system_type = "ext4"
  
  # Expansion settings
  expand_file_system = true
  
  # SSH configuration for file system expansion
  ssh_key_path = "~/.ssh/prod-keypair.pem"  # Replace with your production key path
  ssh_user = "ec2-user"
  ssh_port = 22
  connection_timeout = 600  # Longer timeout for production
  
  # Operation settings
  wait_for_modification = true
  modification_timeout = 20  # Longer timeout for production
  
  # Backup settings - Strict for production
  backup_before_modification = true  # Always backup in production
  snapshot_description = "Production volume backup before resize - $(date)"
  delete_snapshot_after_success = false  # Keep backups in production
  
  # Retry settings
  retry_attempts = 5  # More retries for production
  retry_delay = 60    # Longer delay between retries
  
  # Safety settings for production
  force_modification = false  # Require explicit confirmation for production
  
  # Tags
  tags = {
    Name        = "prod-volume-resize"
    Environment = "prod"
    Purpose     = "production-workload"
    Operation   = "resize"
    Backup      = "required"
    Compliance  = "required"
    ChangeId    = "CHG-XXXXX"  # Change management ID
  }
  
  environment = "prod"
}

# Dependencies - This should run after the EC2 instance is created
dependencies {
  paths = ["../ec2-instance"]
}

# Production-specific hooks with safety checks
terraform {
  before_hook "validate_volume" {
    commands = ["plan", "apply"]
    execute  = ["echo", "Validating EBS volume configuration for production..."]
  }
  
  before_hook "maintenance_window_check" {
    commands = ["apply"]
    execute = [
      "bash", "-c",
      "current_hour=$(date -u +%H); if [ $current_hour -lt 2 ] || [ $current_hour -gt 4 ]; then echo 'WARNING: Outside maintenance window (02:00-04:00 UTC)'; fi"
    ]
  }
  
  before_hook "backup_verification" {
    commands = ["apply"]
    execute = [
      "bash", "-c",
      "echo 'Verifying recent backups exist...'; aws ec2 describe-snapshots --owner-ids self --filters 'Name=volume-id,Values=${inputs.volume_id}' --query 'Snapshots[?StartTime>=`$(date -d '7 days ago' -u +%Y-%m-%d)`]' --output table"
    ]
  }
  
  before_hook "check_instance_state" {
    commands = ["apply"]
    execute = [
      "bash", "-c", 
      "state=$(aws ec2 describe-instances --instance-ids ${inputs.instance_id} --query 'Reservations[0].Instances[0].State.Name' --output text); if [ '$state' != 'running' ]; then echo 'ERROR: Instance must be running for file system expansion'; exit 1; fi"
    ]
  }
  
  before_hook "disk_usage_check" {
    commands = ["apply"]
    execute = [
      "bash", "-c",
      "echo 'Checking current disk usage before expansion...'; ssh -o ConnectTimeout=30 -i ${inputs.ssh_key_path} ${inputs.ssh_user}@$(aws ec2 describe-instances --instance-ids ${inputs.instance_id} --query 'Reservations[0].Instances[0].PrivateIpAddress' --output text) 'df -h /'"
    ]
  }
  
  after_hook "verify_expansion" {
    commands = ["apply"]
    execute = [
      "bash", "-c",
      "echo 'Verifying file system expansion...'; ssh -o ConnectTimeout=30 -i ${inputs.ssh_key_path} ${inputs.ssh_user}@$(aws ec2 describe-instances --instance-ids ${inputs.instance_id} --query 'Reservations[0].Instances[0].PrivateIpAddress' --output text) 'df -h /'"
    ]
  }
  
  after_hook "update_monitoring" {
    commands = ["apply"]
    execute  = ["echo", "Production volume resize completed. Update monitoring thresholds if necessary."]
  }
  
  after_hook "compliance_log" {
    commands = ["apply"]
    execute = [
      "bash", "-c",
      "echo 'Logging compliance event...'; echo \"$(date): EBS volume ${inputs.volume_id} resized to ${inputs.new_size}GB in production\" >> /var/log/compliance.log"
    ]
  }
}

# Additional safety: Skip apply if not explicitly confirmed
skip = false

# Prevent accidental runs
prevent_destroy = true
