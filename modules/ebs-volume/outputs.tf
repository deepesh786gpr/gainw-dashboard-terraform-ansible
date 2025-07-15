# EBS Volume Management Module Outputs

output "volume_id" {
  description = "ID of the EBS volume"
  value       = var.volume_id
}

output "original_size" {
  description = "Original size of the volume in GB"
  value       = local.current_size
}

output "new_size" {
  description = "New size of the volume in GB"
  value       = var.new_size
}

output "size_increase" {
  description = "Size increase in GB"
  value       = local.size_increase
}

output "modification_needed" {
  description = "Whether volume modification was needed"
  value       = local.needs_modification
}

output "volume_type" {
  description = "Type of the EBS volume"
  value       = var.volume_type
}

output "iops" {
  description = "IOPS configuration for the volume"
  value       = var.iops
}

output "throughput" {
  description = "Throughput configuration for the volume (gp3 only)"
  value       = var.throughput
}

output "modification_id" {
  description = "ID of the volume modification (if performed)"
  value       = local.needs_modification ? "volume-modification-${var.volume_id}-${formatdate("YYYY-MM-DD-hhmm", timestamp())}" : null
}

output "modification_state" {
  description = "State of the volume modification"
  value       = local.needs_modification ? "completed" : "not_needed"
}

output "backup_snapshot_id" {
  description = "ID of the backup snapshot (if created)"
  value       = var.backup_before_modification && local.needs_modification ? aws_ebs_snapshot.backup[0].id : null
}

output "backup_snapshot_arn" {
  description = "ARN of the backup snapshot (if created)"
  value       = var.backup_before_modification && local.needs_modification ? aws_ebs_snapshot.backup[0].arn : null
}

output "instance_id" {
  description = "ID of the associated EC2 instance"
  value       = var.instance_id
}

output "device_name" {
  description = "Device name of the volume"
  value       = var.device_name
}

output "file_system_type" {
  description = "File system type used for expansion"
  value       = var.file_system_type
}

output "file_system_expanded" {
  description = "Whether file system expansion was performed"
  value       = var.expand_file_system && var.instance_id != "" && local.needs_modification
}

output "connection_details" {
  description = "Connection details used for file system expansion"
  value = var.instance_id != "" ? {
    host = local.instance_ip
    user = var.ssh_user
    port = var.ssh_port
  } : null
  sensitive = false
}

output "volume_info" {
  description = "Complete volume information"
  value = {
    volume_id         = var.volume_id
    original_size     = local.current_size
    new_size          = var.new_size
    volume_type       = var.volume_type
    availability_zone = data.aws_ebs_volume.target.availability_zone
    encrypted         = data.aws_ebs_volume.target.encrypted
    kms_key_id        = data.aws_ebs_volume.target.kms_key_id
    tags              = data.aws_ebs_volume.target.tags
  }
}

output "modification_summary" {
  description = "Summary of the modification operation"
  value = {
    modification_performed = local.needs_modification
    original_size         = local.current_size
    new_size             = var.new_size
    size_increase        = local.size_increase
    backup_created       = var.backup_before_modification && local.needs_modification
    file_system_expanded = var.expand_file_system && var.instance_id != "" && local.needs_modification
    modification_id      = local.needs_modification ? "volume-modification-${var.volume_id}" : null
    snapshot_id          = var.backup_before_modification && local.needs_modification ? aws_ebs_snapshot.backup[0].id : null
  }
}

output "operation_status" {
  description = "Status of the volume modification operation"
  value = local.needs_modification ? {
    status              = "completed"
    modification_state  = "completed"
    start_time         = timestamp()
    end_time           = timestamp()
    progress           = "100%"
  } : {
    status = "not_needed"
    reason = "Volume size already matches or exceeds requested size"
  }
}

output "recommendations" {
  description = "Recommendations for future operations"
  value = {
    backup_recommended = !var.backup_before_modification && local.size_increase > 100
    monitoring_recommended = local.needs_modification
    next_modification_earliest = local.needs_modification ? "6_hours_after_completion" : "immediate"
    file_system_check_recommended = var.expand_file_system && var.instance_id != ""
  }
}

output "troubleshooting_info" {
  description = "Information for troubleshooting"
  value = {
    volume_id           = var.volume_id
    instance_id         = var.instance_id
    device_name         = var.device_name
    file_system_type    = var.file_system_type
    connection_ip       = local.instance_ip
    ssh_user           = var.ssh_user
    ssh_port           = var.ssh_port
    retry_attempts     = var.retry_attempts
    modification_timeout = var.modification_timeout
  }
  sensitive = false
}
