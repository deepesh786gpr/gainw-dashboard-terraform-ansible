
terraform {
  required_providers {
    aws = {
      source  = "hashicorp/aws"
      version = "~> 5.0"
    }
  }
}

provider "aws" {
  region = var.region
}

variable "name" {
  description = "Name of the EC2 instance"
  type        = string
  default     = " test"
}

variable "instance_type" {
  description = "EC2 instance type"
  type        = string
  default     = "t3.micro"
}

variable "region" {
  description = "AWS region"
  type        = string
  default     = "us-east-1"
}

variable "environment" {
  description = "Environment tag"
  type        = string
  default     = "development"
}

variable "ami_id" {
  description = "AMI ID (leave empty for latest Amazon Linux 2)"
  type        = string
  default     = ""
}

variable "key_name" {
  description = "EC2 Key Pair name"
  type        = string
  default     = ""
}

variable "vpc_security_group_ids" {
  description = "List of security group IDs"
  type        = list(string)
  default     = []
}

variable "subnet_id" {
  description = "Subnet ID"
  type        = string
  default     = ""
}

variable "associate_public_ip_address" {
  description = "Associate a public IP address"
  type        = bool
  default     = true
}

# Get default VPC
data "aws_vpc" "default" {
  default = true
}

# Get default subnet (only if subnet_id is not provided)
data "aws_subnet" "default" {
  count             = var.subnet_id == "" ? 1 : 0
  vpc_id            = data.aws_vpc.default.id
  availability_zone = data.aws_availability_zones.available.names[0]
}

# Get specific subnet if provided
data "aws_subnet" "specified" {
  count = var.subnet_id != "" ? 1 : 0
  id    = var.subnet_id
}

data "aws_availability_zones" "available" {
  state = "available"
}

# Get latest Amazon Linux 2 AMI (only if ami_id is not provided)
data "aws_ami" "amazon_linux" {
  count       = var.ami_id == "" ? 1 : 0
  most_recent = true
  owners      = ["amazon"]

  filter {
    name   = "name"
    values = ["amzn2-ami-hvm-*-x86_64-gp2"]
  }
}

# Security group
resource "aws_security_group" "instance_sg" {
  name_prefix = "${var.name}-sg"
  vpc_id      = data.aws_vpc.default.id

  ingress {
    from_port   = 22
    to_port     = 22
    protocol    = "tcp"
    cidr_blocks = ["0.0.0.0/0"]
  }

  ingress {
    from_port   = 80
    to_port     = 80
    protocol    = "tcp"
    cidr_blocks = ["0.0.0.0/0"]
  }

  egress {
    from_port   = 0
    to_port     = 0
    protocol    = "-1"
    cidr_blocks = ["0.0.0.0/0"]
  }

  tags = {
    Name        = "${var.name}-sg"
    Environment = var.environment
    ManagedBy   = "terraform-dashboard"
  }
}

# EC2 Instance
resource "aws_instance" "main" {
  ami                         = var.ami_id != "" ? var.ami_id : data.aws_ami.amazon_linux[0].id
  instance_type               = var.instance_type
  subnet_id                   = var.subnet_id != "" ? data.aws_subnet.specified[0].id : data.aws_subnet.default[0].id
  vpc_security_group_ids      = length(var.vpc_security_group_ids) > 0 ? var.vpc_security_group_ids : [aws_security_group.instance_sg.id]
  key_name                    = var.key_name != "" ? var.key_name : null
  associate_public_ip_address = var.associate_public_ip_address

  user_data = <<-EOF
    #!/bin/bash
    yum update -y
    yum install -y httpd
    systemctl start httpd
    systemctl enable httpd
    echo "<h1>Hello from ${var.name}</h1>" > /var/www/html/index.html
  EOF

  tags = {
    Name        = var.name
    Environment = var.environment
    ManagedBy   = "terraform-dashboard"
  }
}

# Outputs
output "instance_id" {
  description = "ID of the EC2 instance"
  value       = aws_instance.main.id
}

output "instance_public_ip" {
  description = "Public IP address of the EC2 instance"
  value       = aws_instance.main.public_ip
}

output "instance_private_ip" {
  description = "Private IP address of the EC2 instance"
  value       = aws_instance.main.private_ip
}

output "security_group_id" {
  description = "ID of the security group"
  value       = aws_security_group.instance_sg.id
}
