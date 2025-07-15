# EC2 Instance Module Main Configuration

terraform {
  required_version = ">= 1.0"
  
  required_providers {
    aws = {
      source  = "hashicorp/aws"
      version = ">= 4.0"
    }
  }
}

# Data source for latest AMI if not provided
data "aws_ami" "selected" {
  count       = var.ami_id == "" ? 1 : 0
  most_recent = true
  owners      = [var.ami_owner]
  
  filter {
    name   = "name"
    values = [var.ami_name_filter]
  }
  
  filter {
    name   = "virtualization-type"
    values = ["hvm"]
  }
  
  filter {
    name   = "state"
    values = ["available"]
  }
}

# Data source for availability zones
data "aws_availability_zones" "available" {
  state = "available"
}

# Data source for subnet information
data "aws_subnet" "selected" {
  id = var.subnet_id
}

# Local values for computed configurations
locals {
  ami_id = var.ami_id != "" ? var.ami_id : data.aws_ami.selected[0].id
  
  security_group_name = var.security_group_name != "" ? var.security_group_name : "${var.name}-sg"
  
  # Combine provided security groups with created one
  all_security_group_ids = var.create_security_group ? concat([aws_security_group.instance[0].id], var.security_group_ids) : var.security_group_ids
  
  # Common tags
  common_tags = merge(
    var.instance_tags,
    {
      Name        = var.name
      Environment = var.environment
      Module      = "ec2-instance"
    }
  )
  
  # Volume tags
  volume_tags = merge(
    var.volume_tags,
    {
      Name        = "${var.name}-volume"
      Environment = var.environment
      Module      = "ec2-instance"
    }
  )
}

# Security Group for the instance
resource "aws_security_group" "instance" {
  count       = var.create_security_group ? 1 : 0
  name        = local.security_group_name
  description = "Security group for ${var.name} EC2 instance"
  vpc_id      = var.vpc_id
  
  # SSH access
  ingress {
    description = "SSH access"
    from_port   = var.ssh_port
    to_port     = var.ssh_port
    protocol    = "tcp"
    cidr_blocks = var.allowed_cidr_blocks
  }
  
  # Additional ports
  dynamic "ingress" {
    for_each = var.additional_ports
    content {
      description = ingress.value.description
      from_port   = ingress.value.port
      to_port     = ingress.value.port
      protocol    = ingress.value.protocol
      cidr_blocks = ingress.value.cidr_blocks
    }
  }
  
  # Outbound internet access
  egress {
    description = "All outbound traffic"
    from_port   = 0
    to_port     = 0
    protocol    = "-1"
    cidr_blocks = ["0.0.0.0/0"]
  }
  
  tags = merge(
    local.common_tags,
    {
      Name = local.security_group_name
    }
  )
  
  lifecycle {
    create_before_destroy = true
  }
}

# EC2 Instance
resource "aws_instance" "main" {
  ami           = local.ami_id
  instance_type = var.instance_type
  key_name      = var.key_pair_name != "" ? var.key_pair_name : null
  
  subnet_id                   = var.subnet_id
  vpc_security_group_ids      = local.all_security_group_ids
  associate_public_ip_address = var.associate_public_ip
  
  user_data                   = var.user_data != "" && !var.user_data_base64 ? var.user_data : null
  user_data_base64           = var.user_data != "" && var.user_data_base64 ? var.user_data : null
  
  monitoring                 = var.enable_detailed_monitoring
  disable_api_termination    = var.enable_termination_protection
  
  # Root volume configuration
  root_block_device {
    volume_type = var.root_volume_type
    volume_size = var.root_volume_size
    encrypted   = var.root_volume_encrypted
    kms_key_id  = var.root_volume_kms_key_id != "" ? var.root_volume_kms_key_id : null
    
    tags = local.volume_tags
    
    delete_on_termination = true
  }
  
  # Additional EBS volumes
  dynamic "ebs_block_device" {
    for_each = var.additional_ebs_volumes
    content {
      device_name = ebs_block_device.value.device_name
      volume_size = ebs_block_device.value.size
      volume_type = ebs_block_device.value.type
      encrypted   = ebs_block_device.value.encrypted
      kms_key_id  = ebs_block_device.value.kms_key_id != "" ? ebs_block_device.value.kms_key_id : null
      
      tags = merge(
        local.volume_tags,
        {
          Name = "${var.name}-${ebs_block_device.value.device_name}"
        }
      )
      
      delete_on_termination = true
    }
  }
  
  tags = local.common_tags
  
  lifecycle {
    ignore_changes = [
      # Ignore changes to AMI as it might be updated externally
      ami,
      # Ignore changes to user_data to prevent unnecessary recreation
      user_data,
      user_data_base64
    ]
  }
  
  # Ensure security group is created before instance
  depends_on = [aws_security_group.instance]
}

# Elastic IP (optional)
resource "aws_eip" "instance" {
  count    = var.associate_public_ip ? 1 : 0
  instance = aws_instance.main.id
  domain   = "vpc"
  
  tags = merge(
    local.common_tags,
    {
      Name = "${var.name}-eip"
    }
  )
  
  depends_on = [aws_instance.main]
}
