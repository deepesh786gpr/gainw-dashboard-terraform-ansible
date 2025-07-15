# EBS Volume Management Module Variables

variable "volume_id" {
  description = "ID of the EBS volume to manage"
  type        = string
  
  validation {
    condition     = can(regex("^vol-[a-f0-9]{8,17}$", var.volume_id))
    error_message = "Volume ID must be a valid EBS volume ID (vol-xxxxxxxx)."
  }
}

variable "new_size" {
  description = "New size for the EBS volume in GB"
  type        = number
  
  validation {
    condition     = var.new_size >= 1 && var.new_size <= 65536
    error_message = "Volume size must be between 1 GB and 65536 GB."
  }
}

variable "volume_type" {
  description = "Type of the EBS volume"
  type        = string
  default     = "gp3"
  
  validation {
    condition     = contains(["gp2", "gp3", "io1", "io2", "sc1", "st1"], var.volume_type)
    error_message = "Volume type must be one of: gp2, gp3, io1, io2, sc1, st1."
  }
}

variable "iops" {
  description = "IOPS for the volume (only for io1, io2, gp3)"
  type        = number
  default     = null
  
  validation {
    condition = var.iops == null || (var.iops >= 100 && var.iops <= 64000)
    error_message = "IOPS must be between 100 and 64000 when specified."
  }
}

variable "throughput" {
  description = "Throughput for gp3 volumes in MB/s"
  type        = number
  default     = null
  
  validation {
    condition = var.throughput == null || (var.throughput >= 125 && var.throughput <= 1000)
    error_message = "Throughput must be between 125 and 1000 MB/s when specified."
  }
}

variable "instance_id" {
  description = "ID of the EC2 instance attached to the volume (for file system expansion)"
  type        = string
  default     = ""
  
  validation {
    condition = var.instance_id == "" || can(regex("^i-[a-f0-9]{8,17}$", var.instance_id))
    error_message = "Instance ID must be a valid EC2 instance ID (i-xxxxxxxx) or empty."
  }
}

variable "device_name" {
  description = "Device name of the volume on the instance (e.g., /dev/xvda1, /dev/nvme0n1p1)"
  type        = string
  default     = "/dev/xvda1"
}

variable "file_system_type" {
  description = "File system type for expansion (ext4, xfs)"
  type        = string
  default     = "ext4"
  
  validation {
    condition     = contains(["ext4", "xfs"], var.file_system_type)
    error_message = "File system type must be either ext4 or xfs."
  }
}

variable "expand_file_system" {
  description = "Whether to expand the file system after volume modification"
  type        = bool
  default     = true
}

variable "ssh_key_path" {
  description = "Path to SSH private key for connecting to instance"
  type        = string
  default     = ""
}

variable "ssh_user" {
  description = "SSH user for connecting to instance"
  type        = string
  default     = "ec2-user"
}

variable "ssh_port" {
  description = "SSH port for connecting to instance"
  type        = number
  default     = 22
  
  validation {
    condition     = var.ssh_port > 0 && var.ssh_port <= 65535
    error_message = "SSH port must be between 1 and 65535."
  }
}

variable "connection_timeout" {
  description = "Timeout for SSH connections in seconds"
  type        = number
  default     = 300
  
  validation {
    condition     = var.connection_timeout > 0 && var.connection_timeout <= 3600
    error_message = "Connection timeout must be between 1 and 3600 seconds."
  }
}

variable "wait_for_modification" {
  description = "Whether to wait for volume modification to complete"
  type        = bool
  default     = true
}

variable "modification_timeout" {
  description = "Timeout for volume modification in minutes"
  type        = number
  default     = 10
  
  validation {
    condition     = var.modification_timeout > 0 && var.modification_timeout <= 60
    error_message = "Modification timeout must be between 1 and 60 minutes."
  }
}

variable "tags" {
  description = "Tags to apply to the volume modification"
  type        = map(string)
  default     = {}
}

variable "environment" {
  description = "Environment name"
  type        = string
  default     = "dev"
}

variable "force_modification" {
  description = "Force volume modification even if it may cause data loss"
  type        = bool
  default     = false
}

variable "backup_before_modification" {
  description = "Create a snapshot before modifying the volume"
  type        = bool
  default     = true
}

variable "snapshot_description" {
  description = "Description for the backup snapshot"
  type        = string
  default     = "Backup before volume modification"
}

variable "delete_snapshot_after_success" {
  description = "Delete the backup snapshot after successful modification"
  type        = bool
  default     = false
}

variable "retry_attempts" {
  description = "Number of retry attempts for file system expansion"
  type        = number
  default     = 3
  
  validation {
    condition     = var.retry_attempts >= 1 && var.retry_attempts <= 10
    error_message = "Retry attempts must be between 1 and 10."
  }
}

variable "retry_delay" {
  description = "Delay between retry attempts in seconds"
  type        = number
  default     = 30
  
  validation {
    condition     = var.retry_delay >= 5 && var.retry_delay <= 300
    error_message = "Retry delay must be between 5 and 300 seconds."
  }
}
