const axios = require('axios');

const API_BASE = 'http://localhost:5000/api';

// Enhanced EC2 Instance Template based on your actual module
const enhancedEC2Template = {
  name: "Enhanced EC2 Instance",
  description: "Deploy a comprehensive EC2 instance with security group, EBS volumes, and advanced configurations based on your ec2-instance module",
  category: "Compute",
  terraformCode: `# Enhanced EC2 Instance Module
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
}

locals {
  ami_id = var.ami_id != "" ? var.ami_id : data.aws_ami.selected[0].id
  security_group_name = var.security_group_name != "" ? var.security_group_name : "\${var.name}-sg"
}

# Security Group
resource "aws_security_group" "instance" {
  count       = var.create_security_group ? 1 : 0
  name        = local.security_group_name
  description = "Security group for \${var.name} EC2 instance"
  vpc_id      = var.vpc_id
  
  ingress {
    description = "SSH access"
    from_port   = var.ssh_port
    to_port     = var.ssh_port
    protocol    = "tcp"
    cidr_blocks = var.allowed_cidr_blocks
  }
  
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
  
  egress {
    description = "All outbound traffic"
    from_port   = 0
    to_port     = 0
    protocol    = "-1"
    cidr_blocks = ["0.0.0.0/0"]
  }
  
  tags = merge(var.instance_tags, {
    Name        = local.security_group_name
    Environment = var.environment
  })
}

# EC2 Instance
resource "aws_instance" "main" {
  ami           = local.ami_id
  instance_type = var.instance_type
  key_name      = var.key_pair_name != "" ? var.key_pair_name : null
  subnet_id     = var.subnet_id
  
  vpc_security_group_ids      = var.create_security_group ? [aws_security_group.instance[0].id] : var.security_group_ids
  associate_public_ip_address = var.associate_public_ip
  
  user_data                   = var.user_data != "" ? (var.user_data_base64 ? var.user_data : base64encode(var.user_data)) : null
  monitoring                 = var.enable_detailed_monitoring
  disable_api_termination    = var.enable_termination_protection
  
  root_block_device {
    volume_type = var.root_volume_type
    volume_size = var.root_volume_size
    encrypted   = var.root_volume_encrypted
    kms_key_id  = var.root_volume_kms_key_id != "" ? var.root_volume_kms_key_id : null
    
    tags = merge(var.volume_tags, {
      Name        = "\${var.name}-root-volume"
      Environment = var.environment
    })
  }
  
  dynamic "ebs_block_device" {
    for_each = var.additional_ebs_volumes
    content {
      device_name = ebs_block_device.value.device_name
      volume_size = ebs_block_device.value.size
      volume_type = ebs_block_device.value.type
      encrypted   = ebs_block_device.value.encrypted
      kms_key_id  = ebs_block_device.value.kms_key_id != "" ? ebs_block_device.value.kms_key_id : null
      
      tags = merge(var.volume_tags, {
        Name        = "\${var.name}-\${ebs_block_device.value.device_name}"
        Environment = var.environment
      })
    }
  }
  
  tags = merge(var.instance_tags, {
    Name        = var.name
    Environment = var.environment
    Module      = "enhanced-ec2-instance"
  })
  
  depends_on = [aws_security_group.instance]
}

# Outputs
output "instance_id" {
  description = "ID of the EC2 instance"
  value       = aws_instance.main.id
}

output "instance_arn" {
  description = "ARN of the EC2 instance"
  value       = aws_instance.main.arn
}

output "instance_state" {
  description = "State of the EC2 instance"
  value       = aws_instance.main.instance_state
}

output "public_ip" {
  description = "Public IP address of the instance"
  value       = aws_instance.main.public_ip
}

output "private_ip" {
  description = "Private IP address of the instance"
  value       = aws_instance.main.private_ip
}

output "security_group_id" {
  description = "ID of the security group"
  value       = var.create_security_group ? aws_security_group.instance[0].id : null
}`,
  variables: [
    // Basic Configuration
    {"name": "name", "type": "string", "description": "Name for the EC2 instance", "required": true},
    {"name": "instance_type", "type": "string", "description": "EC2 instance type", "required": false, "default": "t3.micro", "options": ["t3.nano", "t3.micro", "t3.small", "t3.medium", "t3.large", "t3.xlarge", "t3.2xlarge", "t2.nano", "t2.micro", "t2.small", "t2.medium", "t2.large", "m5.large", "m5.xlarge", "c5.large", "c5.xlarge", "r5.large", "r5.xlarge"]},
    {"name": "environment", "type": "string", "description": "Environment name", "required": false, "default": "dev", "options": ["dev", "staging", "prod"]},
    
    // AMI Configuration
    {"name": "ami_id", "type": "string", "description": "AMI ID for the instance (leave empty for latest Amazon Linux 2)", "required": false, "default": ""},
    {"name": "ami_name_filter", "type": "string", "description": "Name filter for AMI lookup", "required": false, "default": "amzn2-ami-hvm-*-x86_64-gp2"},
    {"name": "ami_owner", "type": "string", "description": "Owner of the AMI", "required": false, "default": "amazon", "options": ["amazon", "self", "aws-marketplace"]},
    
    // Network Configuration
    {"name": "vpc_id", "type": "string", "description": "VPC ID where the instance will be created", "required": true},
    {"name": "subnet_id", "type": "string", "description": "Subnet ID where the instance will be placed", "required": true},
    {"name": "associate_public_ip", "type": "boolean", "description": "Whether to associate a public IP address", "required": false, "default": false},
    
    // Security Configuration
    {"name": "key_pair_name", "type": "string", "description": "AWS key pair name for EC2 access", "required": false, "default": ""},
    {"name": "create_security_group", "type": "boolean", "description": "Whether to create a default security group", "required": false, "default": true},
    {"name": "security_group_name", "type": "string", "description": "Name for the security group", "required": false, "default": ""},
    {"name": "ssh_port", "type": "number", "description": "SSH port for instance access", "required": false, "default": 22},
    
    // Storage Configuration
    {"name": "root_volume_size", "type": "number", "description": "Size of the root EBS volume in GB", "required": false, "default": 20},
    {"name": "root_volume_type", "type": "string", "description": "Type of the root EBS volume", "required": false, "default": "gp3", "options": ["gp2", "gp3", "io1", "io2", "sc1", "st1"]},
    {"name": "root_volume_encrypted", "type": "boolean", "description": "Whether to encrypt the root EBS volume", "required": false, "default": true},
    {"name": "root_volume_kms_key_id", "type": "string", "description": "KMS key ID for root volume encryption", "required": false, "default": ""},
    
    // Advanced Configuration
    {"name": "user_data", "type": "string", "description": "User data script for instance initialization", "required": false, "default": ""},
    {"name": "user_data_base64", "type": "boolean", "description": "Whether user_data is base64 encoded", "required": false, "default": false},
    {"name": "enable_detailed_monitoring", "type": "boolean", "description": "Enable detailed monitoring", "required": false, "default": false},
    {"name": "enable_termination_protection", "type": "boolean", "description": "Enable termination protection", "required": false, "default": false}
  ]
};

// EBS Volume Management Template
const ebsVolumeTemplate = {
  name: "EBS Volume Management",
  description: "Manage EBS volumes - resize, modify type, and optimize performance based on your ebs-volume module",
  category: "Storage",
  terraformCode: `# EBS Volume Management Module
data "aws_ebs_volume" "target" {
  filter {
    name   = "volume-id"
    values = [var.volume_id]
  }
}

locals {
  current_size = data.aws_ebs_volume.target.size
  current_type = data.aws_ebs_volume.target.volume_type
  size_changed = var.new_size != local.current_size
  type_changed = var.volume_type != local.current_type
  needs_modification = local.size_changed || local.type_changed || var.iops != null || var.throughput != null
}

# Volume modification
resource "aws_ebs_volume_modification" "main" {
  count = local.needs_modification ? 1 : 0
  
  volume_id = var.volume_id
  size      = var.new_size
  volume_type = var.volume_type
  iops      = var.iops
  throughput = var.throughput
}

# Wait for modification to complete
resource "null_resource" "wait_for_modification" {
  count = local.needs_modification ? 1 : 0
  
  depends_on = [aws_ebs_volume_modification.main]
  
  provisioner "local-exec" {
    command = <<-EOT
      echo "Waiting for volume modification to complete..."
      aws ec2 wait volume-in-use --volume-ids \${var.volume_id}
      echo "Volume modification completed"
    EOT
  }
}

# File system expansion (if enabled)
resource "null_resource" "expand_filesystem" {
  count = var.expand_filesystem && local.size_changed ? 1 : 0
  
  depends_on = [null_resource.wait_for_modification]
  
  provisioner "local-exec" {
    command = var.filesystem_expansion_command
  }
}

# Outputs
output "volume_id" {
  description = "ID of the modified volume"
  value       = var.volume_id
}

output "original_size" {
  description = "Original size of the volume"
  value       = local.current_size
}

output "new_size" {
  description = "New size of the volume"
  value       = var.new_size
}

output "modification_state" {
  description = "State of the volume modification"
  value       = local.needs_modification ? aws_ebs_volume_modification.main[0].modification_state : "no-modification-needed"
}`,
  variables: [
    {"name": "volume_id", "type": "string", "description": "ID of the EBS volume to manage (vol-xxxxxxxx)", "required": true},
    {"name": "new_size", "type": "number", "description": "New size for the EBS volume in GB", "required": true},
    {"name": "volume_type", "type": "string", "description": "Type of the EBS volume", "required": false, "default": "gp3", "options": ["gp2", "gp3", "io1", "io2", "sc1", "st1"]},
    {"name": "iops", "type": "number", "description": "IOPS for the volume (only for io1, io2, gp3)", "required": false, "default": null},
    {"name": "throughput", "type": "number", "description": "Throughput for gp3 volumes in MB/s", "required": false, "default": null},
    {"name": "expand_filesystem", "type": "boolean", "description": "Whether to expand the filesystem after volume resize", "required": false, "default": true},
    {"name": "filesystem_expansion_command", "type": "string", "description": "Command to expand filesystem", "required": false, "default": "sudo resize2fs /dev/xvdf"}
  ]
};

async function addTemplate(template) {
  try {
    const response = await axios.post(`${API_BASE}/templates`, template);
    console.log(`✅ Added template: ${template.name}`);
    return response.data;
  } catch (error) {
    console.error(`❌ Failed to add template ${template.name}:`, error.response?.data || error.message);
    return null;
  }
}

async function main() {
  console.log('🚀 Adding enhanced templates based on your actual Terraform modules...');
  
  // Add templates
  await addTemplate(enhancedEC2Template);
  await addTemplate(ebsVolumeTemplate);
  
  console.log('✅ All templates added successfully!');
  console.log('');
  console.log('🎯 Available Templates:');
  console.log('   1. Enhanced EC2 Instance - Comprehensive EC2 deployment with all your module features');
  console.log('   2. EBS Volume Management - Resize and optimize EBS volumes');
  console.log('');
  console.log('🌐 Access your dashboard at: http://localhost:3000 or http://localhost:3007');
}

main().catch(console.error);
