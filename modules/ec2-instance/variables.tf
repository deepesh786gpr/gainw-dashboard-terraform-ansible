# EC2 Instance Module Variables

variable "name" {
  description = "Name for the EC2 instance"
  type        = string
  
  validation {
    condition     = length(var.name) > 0 && length(var.name) <= 255
    error_message = "Name must be between 1 and 255 characters."
  }
}

variable "instance_type" {
  description = "EC2 instance type"
  type        = string
  default     = "t3.micro"
  
  validation {
    condition = contains([
      "t3.nano", "t3.micro", "t3.small", "t3.medium", "t3.large", "t3.xlarge", "t3.2xlarge",
      "t2.nano", "t2.micro", "t2.small", "t2.medium", "t2.large", "t2.xlarge", "t2.2xlarge",
      "m5.large", "m5.xlarge", "m5.2xlarge", "m5.4xlarge", "m5.8xlarge", "m5.12xlarge", "m5.16xlarge", "m5.24xlarge",
      "c5.large", "c5.xlarge", "c5.2xlarge", "c5.4xlarge", "c5.9xlarge", "c5.12xlarge", "c5.18xlarge", "c5.24xlarge",
      "r5.large", "r5.xlarge", "r5.2xlarge", "r5.4xlarge", "r5.8xlarge", "r5.12xlarge", "r5.16xlarge", "r5.24xlarge"
    ], var.instance_type)
    error_message = "Instance type must be a valid EC2 instance type."
  }
}

variable "ami_id" {
  description = "AMI ID for the instance. If not provided, latest Amazon Linux 2 will be used"
  type        = string
  default     = ""
}

variable "ami_name_filter" {
  description = "Name filter for AMI lookup when ami_id is not provided"
  type        = string
  default     = "amzn2-ami-hvm-*-x86_64-gp2"
}

variable "ami_owner" {
  description = "Owner of the AMI when using ami_name_filter"
  type        = string
  default     = "amazon"
}

variable "key_pair_name" {
  description = "Name of the AWS key pair for EC2 access"
  type        = string
  default     = ""
}

variable "vpc_id" {
  description = "VPC ID where the instance will be created"
  type        = string
}

variable "subnet_id" {
  description = "Subnet ID where the instance will be placed"
  type        = string
}

variable "security_group_ids" {
  description = "List of security group IDs to attach to the instance"
  type        = list(string)
  default     = []
}

variable "create_security_group" {
  description = "Whether to create a default security group"
  type        = bool
  default     = true
}

variable "security_group_name" {
  description = "Name for the security group (if created)"
  type        = string
  default     = ""
}

variable "allowed_cidr_blocks" {
  description = "List of CIDR blocks allowed to access the instance"
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

variable "additional_ports" {
  description = "Additional ports to open in security group"
  type = list(object({
    port        = number
    protocol    = string
    cidr_blocks = list(string)
    description = string
  }))
  default = []
}

variable "user_data" {
  description = "User data script for instance initialization"
  type        = string
  default     = ""
}

variable "user_data_base64" {
  description = "Whether user_data is base64 encoded"
  type        = bool
  default     = false
}

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

variable "root_volume_encrypted" {
  description = "Whether to encrypt the root EBS volume"
  type        = bool
  default     = true
}

variable "root_volume_kms_key_id" {
  description = "KMS key ID for root volume encryption"
  type        = string
  default     = ""
}

variable "additional_ebs_volumes" {
  description = "Additional EBS volumes to attach"
  type = list(object({
    device_name = string
    size        = number
    type        = string
    encrypted   = bool
    kms_key_id  = string
  }))
  default = []
}

variable "associate_public_ip" {
  description = "Whether to associate a public IP address"
  type        = bool
  default     = false
}

variable "enable_detailed_monitoring" {
  description = "Enable detailed monitoring for the instance"
  type        = bool
  default     = false
}

variable "enable_termination_protection" {
  description = "Enable termination protection for the instance"
  type        = bool
  default     = false
}

variable "instance_tags" {
  description = "Additional tags for the EC2 instance"
  type        = map(string)
  default     = {}
}

variable "volume_tags" {
  description = "Additional tags for EBS volumes"
  type        = map(string)
  default     = {}
}

variable "environment" {
  description = "Environment name"
  type        = string
  default     = "dev"
}
