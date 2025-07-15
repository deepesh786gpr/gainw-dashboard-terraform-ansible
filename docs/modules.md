# Module Documentation

This document provides detailed information about each Terraform module in the AWS EC2 management project.

## Table of Contents

1. [EC2 Instance Module](#ec2-instance-module)
2. [EBS Volume Module](#ebs-volume-module)
3. [EC2 Operations Module](#ec2-operations-module)
4. [Module Usage Patterns](#module-usage-patterns)
5. [Best Practices](#best-practices)

## EC2 Instance Module

**Location:** `modules/ec2-instance/`

### Purpose
Deploys and configures EC2 instances with comprehensive customization options including networking, security, storage, and monitoring.

### Key Features
- Automated AMI selection with data sources
- Configurable security groups with custom rules
- Multiple EBS volume support
- User data script execution
- Comprehensive tagging strategy
- Optional Elastic IP assignment

### Input Variables

| Variable | Type | Default | Description |
|----------|------|---------|-------------|
| `name` | string | - | Name for the EC2 instance |
| `instance_type` | string | `"t3.micro"` | EC2 instance type |
| `ami_id` | string | `""` | AMI ID (auto-detected if empty) |
| `vpc_id` | string | - | VPC ID for instance placement |
| `subnet_id` | string | - | Subnet ID for instance placement |
| `key_pair_name` | string | `""` | SSH key pair name |
| `security_group_ids` | list(string) | `[]` | Additional security group IDs |
| `create_security_group` | bool | `true` | Create default security group |
| `allowed_cidr_blocks` | list(string) | `["0.0.0.0/0"]` | CIDR blocks for SSH access |
| `additional_ports` | list(object) | `[]` | Additional ports to open |
| `user_data` | string | `""` | User data script |
| `root_volume_size` | number | `20` | Root volume size in GB |
| `root_volume_type` | string | `"gp3"` | Root volume type |
| `additional_ebs_volumes` | list(object) | `[]` | Additional EBS volumes |
| `associate_public_ip` | bool | `false` | Associate public IP |
| `enable_detailed_monitoring` | bool | `false` | Enable detailed monitoring |
| `instance_tags` | map(string) | `{}` | Instance tags |

### Outputs

| Output | Description |
|--------|-------------|
| `instance_id` | EC2 instance ID |
| `instance_arn` | EC2 instance ARN |
| `private_ip` | Private IP address |
| `public_ip` | Public IP address |
| `private_dns` | Private DNS name |
| `public_dns` | Public DNS name |
| `security_group_id` | Created security group ID |
| `root_block_device` | Root volume information |
| `ssh_connection` | SSH connection details |

### Usage Example

```hcl
module "web_server" {
  source = "./modules/ec2-instance"
  
  name = "web-server-01"
  instance_type = "t3.small"
  
  vpc_id = "vpc-12345678"
  subnet_id = "subnet-12345678"
  key_pair_name = "my-keypair"
  
  additional_ports = [
    {
      port        = 80
      protocol    = "tcp"
      cidr_blocks = ["0.0.0.0/0"]
      description = "HTTP"
    }
  ]
  
  user_data = base64encode(<<-EOF
    #!/bin/bash
    yum update -y
    yum install -y httpd
    systemctl start httpd
    systemctl enable httpd
  EOF
  )
  
  instance_tags = {
    Role = "web-server"
    Environment = "production"
  }
}
```

## EBS Volume Module

**Location:** `modules/ebs-volume/`

### Purpose
Manages EBS volume operations including size modifications, performance adjustments, and automated file system expansion.

### Key Features
- Volume size increase with validation
- Automated file system expansion (ext4/xfs)
- Pre-modification backup creation
- Retry mechanisms for failed operations
- SSH-based remote execution
- Comprehensive error handling

### Input Variables

| Variable | Type | Default | Description |
|----------|------|---------|-------------|
| `volume_id` | string | - | EBS volume ID to modify |
| `new_size` | number | - | New volume size in GB |
| `volume_type` | string | `"gp3"` | Volume type |
| `iops` | number | `null` | IOPS (for io1/io2/gp3) |
| `throughput` | number | `null` | Throughput for gp3 |
| `instance_id` | string | `""` | Instance ID for file system expansion |
| `device_name` | string | `"/dev/xvda1"` | Device name |
| `file_system_type` | string | `"ext4"` | File system type |
| `expand_file_system` | bool | `true` | Expand file system |
| `ssh_key_path` | string | `""` | SSH private key path |
| `ssh_user` | string | `"ec2-user"` | SSH user |
| `backup_before_modification` | bool | `true` | Create backup snapshot |
| `wait_for_modification` | bool | `true` | Wait for completion |
| `retry_attempts` | number | `3` | Retry attempts |

### Outputs

| Output | Description |
|--------|-------------|
| `volume_id` | Volume ID |
| `original_size` | Original volume size |
| `new_size` | New volume size |
| `modification_id` | Modification operation ID |
| `backup_snapshot_id` | Backup snapshot ID |
| `modification_summary` | Operation summary |
| `operation_status` | Status information |

### Usage Example

```hcl
module "volume_resize" {
  source = "./modules/ebs-volume"
  
  volume_id = "vol-12345678"
  new_size = 100
  instance_id = "i-12345678"
  
  ssh_key_path = "~/.ssh/my-key.pem"
  file_system_type = "ext4"
  
  backup_before_modification = true
  wait_for_modification = true
  
  tags = {
    Operation = "resize"
    Environment = "production"
  }
}
```

## EC2 Operations Module

**Location:** `modules/ec2-operations/`

### Purpose
Performs various EC2 instance management operations including start, stop, restart, and health checks with comprehensive monitoring and notification support.

### Key Features
- Multiple operation types (start, stop, restart, status)
- HTTP and SSH health checks
- CloudWatch logging integration
- SNS and Slack notifications
- Pre/post operation validation
- Maintenance window support

### Input Variables

| Variable | Type | Default | Description |
|----------|------|---------|-------------|
| `instance_id` | string | - | Instance ID to manage |
| `operation` | string | `"status"` | Operation to perform |
| `wait_for_completion` | bool | `true` | Wait for operation completion |
| `timeout_minutes` | number | `10` | Operation timeout |
| `health_check_enabled` | bool | `true` | Enable health checks |
| `health_check_url` | string | `""` | Health check URL |
| `health_check_retries` | number | `5` | Health check retry count |
| `ssh_enabled` | bool | `false` | Enable SSH checks |
| `ssh_key_path` | string | `""` | SSH private key path |
| `notification_enabled` | bool | `false` | Enable notifications |
| `sns_topic_arn` | string | `""` | SNS topic ARN |
| `force_operation` | bool | `false` | Force operation |
| `backup_before_operation` | bool | `false` | Create backup |
| `monitoring_enabled` | bool | `true` | Enable CloudWatch logging |

### Outputs

| Output | Description |
|--------|-------------|
| `instance_id` | Instance ID |
| `operation` | Performed operation |
| `operation_timestamp` | Operation timestamp |
| `instance_state` | Current instance state |
| `operation_summary` | Operation summary |
| `instance_metadata` | Complete instance information |
| `cloudwatch_log_group` | Log group name |

### Usage Example

```hcl
module "instance_restart" {
  source = "./modules/ec2-operations"
  
  instance_id = "i-12345678"
  operation = "restart"
  
  wait_for_completion = true
  health_check_enabled = true
  health_check_url = "http://10.0.1.100/health"
  
  notification_enabled = true
  sns_topic_arn = "arn:aws:sns:us-east-1:123456789012:alerts"
  
  operation_reason = "Scheduled maintenance"
}
```

## Module Usage Patterns

### Pattern 1: Complete Infrastructure Deployment

```hcl
# Deploy instance
module "app_server" {
  source = "./modules/ec2-instance"
  # ... configuration
}

# Configure volumes
module "data_volume" {
  source = "./modules/ebs-volume"
  
  volume_id = module.app_server.root_block_device.volume_id
  new_size = 100
  instance_id = module.app_server.instance_id
  
  depends_on = [module.app_server]
}

# Perform health check
module "health_check" {
  source = "./modules/ec2-operations"
  
  instance_id = module.app_server.instance_id
  operation = "health_check"
  
  depends_on = [module.data_volume]
}
```

### Pattern 2: Maintenance Operations

```hcl
# Stop instance
module "stop_instance" {
  source = "./modules/ec2-operations"
  
  instance_id = var.instance_id
  operation = "stop"
  wait_for_completion = true
}

# Resize volume while stopped
module "resize_volume" {
  source = "./modules/ebs-volume"
  
  volume_id = var.volume_id
  new_size = var.new_size
  expand_file_system = false  # Will expand after restart
  
  depends_on = [module.stop_instance]
}

# Start instance
module "start_instance" {
  source = "./modules/ec2-operations"
  
  instance_id = var.instance_id
  operation = "start"
  health_check_enabled = true
  
  depends_on = [module.resize_volume]
}
```

## Best Practices

### Security
1. **Use least privilege IAM policies**
2. **Enable encryption for all volumes**
3. **Restrict security group access**
4. **Use private subnets when possible**
5. **Regularly rotate SSH keys**

### Operations
1. **Always test in development first**
2. **Use maintenance windows for production**
3. **Enable monitoring and logging**
4. **Implement proper backup strategies**
5. **Document all operations**

### Cost Optimization
1. **Use appropriate instance types**
2. **Enable detailed monitoring only when needed**
3. **Clean up unused snapshots**
4. **Use gp3 volumes for better price/performance**
5. **Schedule instances for cost savings**

### Reliability
1. **Implement health checks**
2. **Use multiple availability zones**
3. **Enable termination protection for critical instances**
4. **Regular backup and restore testing**
5. **Monitor resource limits and quotas**
