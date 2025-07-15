# Common variables used across all modules and environments

variable "aws_region" {
  description = "AWS region for resources"
  type        = string
  default     = "us-east-1"
  
  validation {
    condition = can(regex("^[a-z]{2}-[a-z]+-[0-9]$", var.aws_region))
    error_message = "AWS region must be in the format: us-east-1, eu-west-1, etc."
  }
}

variable "environment" {
  description = "Environment name (dev, staging, prod)"
  type        = string
  
  validation {
    condition     = contains(["dev", "staging", "prod"], var.environment)
    error_message = "Environment must be one of: dev, staging, prod."
  }
}

variable "project_name" {
  description = "Name of the project"
  type        = string
  default     = "ec2-management"
  
  validation {
    condition     = can(regex("^[a-z0-9-]+$", var.project_name))
    error_message = "Project name must contain only lowercase letters, numbers, and hyphens."
  }
}

variable "default_tags" {
  description = "Default tags to apply to all resources"
  type        = map(string)
  default = {
    Project   = "ec2-management"
    ManagedBy = "terragrunt"
  }
}

# EC2 Instance Variables
variable "instance_type" {
  description = "EC2 instance type"
  type        = string
  default     = "t3.micro"
  
  validation {
    condition = contains([
      "t3.nano", "t3.micro", "t3.small", "t3.medium", "t3.large", "t3.xlarge", "t3.2xlarge",
      "t2.nano", "t2.micro", "t2.small", "t2.medium", "t2.large", "t2.xlarge", "t2.2xlarge",
      "m5.large", "m5.xlarge", "m5.2xlarge", "m5.4xlarge", "m5.8xlarge", "m5.12xlarge", "m5.16xlarge", "m5.24xlarge",
      "c5.large", "c5.xlarge", "c5.2xlarge", "c5.4xlarge", "c5.9xlarge", "c5.12xlarge", "c5.18xlarge", "c5.24xlarge"
    ], var.instance_type)
    error_message = "Instance type must be a valid EC2 instance type."
  }
}

variable "key_pair_name" {
  description = "Name of the AWS key pair for EC2 access"
  type        = string
  default     = ""
}

variable "vpc_id" {
  description = "VPC ID where resources will be created"
  type        = string
  default     = ""
}

variable "subnet_ids" {
  description = "List of subnet IDs for resource placement"
  type        = list(string)
  default     = []
}

variable "availability_zones" {
  description = "List of availability zones"
  type        = list(string)
  default     = []
}

# Security Group Variables
variable "allowed_cidr_blocks" {
  description = "List of CIDR blocks allowed to access instances"
  type        = list(string)
  default     = ["0.0.0.0/0"]
}

variable "ssh_port" {
  description = "SSH port for instance access"
  type        = number
  default     = 22
  
  validation {
    condition     = var.ssh_port > 0 && var.ssh_port <= 65535
    error_message = "SSH port must be between 1 and 65535."
  }
}

# EBS Volume Variables
variable "root_volume_size" {
  description = "Size of the root EBS volume in GB"
  type        = number
  default     = 20
  
  validation {
    condition     = var.root_volume_size >= 8 && var.root_volume_size <= 16384
    error_message = "Root volume size must be between 8 GB and 16384 GB."
  }
}

variable "root_volume_type" {
  description = "Type of the root EBS volume"
  type        = string
  default     = "gp3"
  
  validation {
    condition     = contains(["gp2", "gp3", "io1", "io2", "sc1", "st1"], var.root_volume_type)
    error_message = "Root volume type must be one of: gp2, gp3, io1, io2, sc1, st1."
  }
}

variable "enable_detailed_monitoring" {
  description = "Enable detailed monitoring for EC2 instances"
  type        = bool
  default     = false
}

variable "enable_termination_protection" {
  description = "Enable termination protection for EC2 instances"
  type        = bool
  default     = false
}
