# EC2 Operations Module Outputs

output "instance_id" {
  description = "ID of the managed EC2 instance"
  value       = var.instance_id
}

output "operation" {
  description = "Operation performed on the instance"
  value       = var.operation
}

output "operation_timestamp" {
  description = "Timestamp when the operation was performed"
  value       = local.timestamp
}

output "instance_state" {
  description = "Current state of the EC2 instance"
  value       = data.aws_instance.target.instance_state
}

output "instance_type" {
  description = "Type of the EC2 instance"
  value       = data.aws_instance.target.instance_type
}

output "availability_zone" {
  description = "Availability zone of the instance"
  value       = data.aws_instance.target.availability_zone
}

output "private_ip" {
  description = "Private IP address of the instance"
  value       = data.aws_instance.target.private_ip
}

output "public_ip" {
  description = "Public IP address of the instance"
  value       = data.aws_instance.target.public_ip
}

output "private_dns" {
  description = "Private DNS name of the instance"
  value       = data.aws_instance.target.private_dns
}

output "public_dns" {
  description = "Public DNS name of the instance"
  value       = data.aws_instance.target.public_dns
}

output "subnet_id" {
  description = "Subnet ID where the instance is located"
  value       = data.aws_instance.target.subnet_id
}

output "vpc_id" {
  description = "VPC ID where the instance is located"
  value       = data.aws_instance.target.subnet_id != null ? data.aws_subnet.target[0].vpc_id : null
}

# Data source for subnet information
data "aws_subnet" "target" {
  count = data.aws_instance.target.subnet_id != null ? 1 : 0
  id    = data.aws_instance.target.subnet_id
}

output "security_groups" {
  description = "Security groups associated with the instance"
  value       = data.aws_instance.target.vpc_security_group_ids
}

output "key_name" {
  description = "Key pair name associated with the instance"
  value       = data.aws_instance.target.key_name
}

output "monitoring" {
  description = "Whether detailed monitoring is enabled"
  value       = data.aws_instance.target.monitoring
}

output "tags" {
  description = "Tags associated with the instance"
  value       = data.aws_instance.target.tags
}

output "health_check_url" {
  description = "URL used for health checks"
  value       = var.health_check_enabled ? local.health_check_url : null
  sensitive   = false
}

output "ssh_connection" {
  description = "SSH connection information"
  value = var.ssh_enabled ? {
    host        = local.instance_ip
    port        = var.ssh_port
    user        = var.ssh_user
    private_key = var.ssh_key_path
  } : null
  sensitive = false
}

output "operation_summary" {
  description = "Summary of the operation performed"
  value = {
    instance_id           = var.instance_id
    operation            = var.operation
    timestamp            = local.timestamp
    reason               = var.operation_reason
    wait_for_completion  = var.wait_for_completion
    health_check_enabled = var.health_check_enabled
    notification_sent    = var.notification_enabled
    dry_run              = var.dry_run
  }
}

output "instance_metadata" {
  description = "Complete instance metadata"
  value = {
    instance_id       = data.aws_instance.target.id
    instance_type     = data.aws_instance.target.instance_type
    state             = data.aws_instance.target.instance_state
    availability_zone = data.aws_instance.target.availability_zone
    subnet_id         = data.aws_instance.target.subnet_id
    private_ip        = data.aws_instance.target.private_ip
    public_ip         = data.aws_instance.target.public_ip
    private_dns       = data.aws_instance.target.private_dns
    public_dns        = data.aws_instance.target.public_dns
    key_name          = data.aws_instance.target.key_name
    security_groups   = data.aws_instance.target.vpc_security_group_ids
    monitoring        = data.aws_instance.target.monitoring
    launch_time       = data.aws_instance.target.launch_time
    ami               = data.aws_instance.target.ami
  }
}

output "operation_config" {
  description = "Configuration used for the operation"
  value = {
    operation                = var.operation
    wait_for_completion     = var.wait_for_completion
    timeout_minutes         = var.timeout_minutes
    health_check_enabled    = var.health_check_enabled
    health_check_retries    = var.health_check_retries
    health_check_timeout    = var.health_check_timeout
    ssh_enabled             = var.ssh_enabled
    notification_enabled    = var.notification_enabled
    force_operation         = var.force_operation
    pre_operation_checks    = var.pre_operation_checks
    post_operation_checks   = var.post_operation_checks
    backup_before_operation = var.backup_before_operation
    dry_run                 = var.dry_run
    rollback_enabled        = var.rollback_enabled
    monitoring_enabled      = var.monitoring_enabled
  }
}

output "cloudwatch_log_group" {
  description = "CloudWatch log group for operations (if enabled)"
  value       = var.monitoring_enabled ? aws_cloudwatch_log_group.operations[0].name : null
}

output "cloudwatch_log_group_arn" {
  description = "ARN of the CloudWatch log group (if enabled)"
  value       = var.monitoring_enabled ? aws_cloudwatch_log_group.operations[0].arn : null
}

output "operation_status" {
  description = "Status of the operation"
  value = {
    completed             = true
    operation            = var.operation
    instance_id          = var.instance_id
    final_state          = data.aws_instance.target.instance_state
    timestamp            = local.timestamp
    health_checks_passed = var.health_check_enabled
    notifications_sent   = var.notification_enabled
  }
}

output "next_steps" {
  description = "Recommended next steps based on the operation"
  value = {
    monitor_instance = var.operation != "terminate"
    verify_application = var.operation == "restart" || var.operation == "reboot"
    check_logs = var.operation == "start" || var.operation == "restart"
    update_dns = var.operation == "start" && data.aws_instance.target.public_ip != ""
    backup_recommended = var.operation == "start" && !var.backup_before_operation
  }
}

output "troubleshooting_info" {
  description = "Information for troubleshooting"
  value = {
    instance_id          = var.instance_id
    operation           = var.operation
    instance_state      = data.aws_instance.target.instance_state
    connection_ip       = local.instance_ip
    ssh_enabled         = var.ssh_enabled
    health_check_url    = var.health_check_enabled ? local.health_check_url : null
    log_group           = var.monitoring_enabled ? aws_cloudwatch_log_group.operations[0].name : null
    timeout_minutes     = var.timeout_minutes
    retry_attempts      = var.health_check_retries
  }
  sensitive = false
}
