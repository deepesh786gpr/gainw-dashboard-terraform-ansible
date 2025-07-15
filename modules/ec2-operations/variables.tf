# EC2 Operations Module Variables

variable "instance_id" {
  description = "ID of the EC2 instance to manage"
  type        = string
  
  validation {
    condition     = can(regex("^i-[a-f0-9]{8,17}$", var.instance_id))
    error_message = "Instance ID must be a valid EC2 instance ID (i-xxxxxxxx)."
  }
}

variable "operation" {
  description = "Operation to perform on the instance"
  type        = string
  default     = "status"
  
  validation {
    condition = contains([
      "status", "start", "stop", "restart", "reboot", 
      "terminate", "health_check", "wait_for_running", 
      "wait_for_stopped", "force_stop"
    ], var.operation)
    error_message = "Operation must be one of: status, start, stop, restart, reboot, terminate, health_check, wait_for_running, wait_for_stopped, force_stop."
  }
}

variable "wait_for_completion" {
  description = "Whether to wait for the operation to complete"
  type        = bool
  default     = true
}

variable "timeout_minutes" {
  description = "Timeout for operations in minutes"
  type        = number
  default     = 10
  
  validation {
    condition     = var.timeout_minutes > 0 && var.timeout_minutes <= 60
    error_message = "Timeout must be between 1 and 60 minutes."
  }
}

variable "health_check_enabled" {
  description = "Enable health checks after operations"
  type        = bool
  default     = true
}

variable "health_check_url" {
  description = "URL for HTTP health checks"
  type        = string
  default     = ""
}

variable "health_check_port" {
  description = "Port for health checks"
  type        = number
  default     = 80
  
  validation {
    condition     = var.health_check_port > 0 && var.health_check_port <= 65535
    error_message = "Health check port must be between 1 and 65535."
  }
}

variable "health_check_path" {
  description = "Path for HTTP health checks"
  type        = string
  default     = "/"
}

variable "health_check_timeout" {
  description = "Timeout for health checks in seconds"
  type        = number
  default     = 30
  
  validation {
    condition     = var.health_check_timeout > 0 && var.health_check_timeout <= 300
    error_message = "Health check timeout must be between 1 and 300 seconds."
  }
}

variable "health_check_retries" {
  description = "Number of health check retries"
  type        = number
  default     = 5
  
  validation {
    condition     = var.health_check_retries >= 1 && var.health_check_retries <= 20
    error_message = "Health check retries must be between 1 and 20."
  }
}

variable "ssh_enabled" {
  description = "Enable SSH connectivity checks"
  type        = bool
  default     = false
}

variable "ssh_user" {
  description = "SSH user for connectivity checks"
  type        = string
  default     = "ec2-user"
}

variable "ssh_port" {
  description = "SSH port for connectivity checks"
  type        = number
  default     = 22
  
  validation {
    condition     = var.ssh_port > 0 && var.ssh_port <= 65535
    error_message = "SSH port must be between 1 and 65535."
  }
}

variable "ssh_key_path" {
  description = "Path to SSH private key"
  type        = string
  default     = ""
}

variable "notification_enabled" {
  description = "Enable notifications for operations"
  type        = bool
  default     = false
}

variable "sns_topic_arn" {
  description = "SNS topic ARN for notifications"
  type        = string
  default     = ""
}

variable "slack_webhook_url" {
  description = "Slack webhook URL for notifications"
  type        = string
  default     = ""
  sensitive   = true
}

variable "tags" {
  description = "Tags to apply to resources"
  type        = map(string)
  default     = {}
}

variable "environment" {
  description = "Environment name"
  type        = string
  default     = "dev"
}

variable "force_operation" {
  description = "Force the operation even if instance is in unexpected state"
  type        = bool
  default     = false
}

variable "pre_operation_checks" {
  description = "Enable pre-operation validation checks"
  type        = bool
  default     = true
}

variable "post_operation_checks" {
  description = "Enable post-operation validation checks"
  type        = bool
  default     = true
}

variable "backup_before_operation" {
  description = "Create EBS snapshots before destructive operations"
  type        = bool
  default     = false
}

variable "operation_reason" {
  description = "Reason for performing the operation (for logging)"
  type        = string
  default     = "Automated operation via Terraform"
}

variable "maintenance_window" {
  description = "Maintenance window for operations (HH:MM-HH:MM UTC)"
  type        = string
  default     = ""
  
  validation {
    condition = var.maintenance_window == "" || can(regex("^([0-1][0-9]|2[0-3]):[0-5][0-9]-([0-1][0-9]|2[0-3]):[0-5][0-9]$", var.maintenance_window))
    error_message = "Maintenance window must be in format HH:MM-HH:MM (24-hour format)."
  }
}

variable "dry_run" {
  description = "Perform a dry run without executing the actual operation"
  type        = bool
  default     = false
}

variable "rollback_enabled" {
  description = "Enable automatic rollback on operation failure"
  type        = bool
  default     = false
}

variable "monitoring_enabled" {
  description = "Enable CloudWatch monitoring during operations"
  type        = bool
  default     = true
}

variable "log_retention_days" {
  description = "CloudWatch log retention in days"
  type        = number
  default     = 7
  
  validation {
    condition = contains([1, 3, 5, 7, 14, 30, 60, 90, 120, 150, 180, 365, 400, 545, 731, 1827, 3653], var.log_retention_days)
    error_message = "Log retention days must be a valid CloudWatch retention period."
  }
}
