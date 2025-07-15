# EC2 Instance Module Outputs

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

output "instance_type" {
  description = "Type of the EC2 instance"
  value       = aws_instance.main.instance_type
}

output "ami_id" {
  description = "AMI ID used for the instance"
  value       = aws_instance.main.ami
}

output "availability_zone" {
  description = "Availability zone of the instance"
  value       = aws_instance.main.availability_zone
}

output "placement_group" {
  description = "Placement group of the instance"
  value       = aws_instance.main.placement_group
}

output "key_name" {
  description = "Key pair name used for the instance"
  value       = aws_instance.main.key_name
}

# Network Information
output "private_ip" {
  description = "Private IP address of the instance"
  value       = aws_instance.main.private_ip
}

output "private_dns" {
  description = "Private DNS name of the instance"
  value       = aws_instance.main.private_dns
}

output "public_ip" {
  description = "Public IP address of the instance"
  value       = aws_instance.main.public_ip
}

output "public_dns" {
  description = "Public DNS name of the instance"
  value       = aws_instance.main.public_dns
}

output "elastic_ip" {
  description = "Elastic IP address (if created)"
  value       = var.associate_public_ip ? aws_eip.instance[0].public_ip : null
}

output "elastic_ip_allocation_id" {
  description = "Allocation ID of the Elastic IP (if created)"
  value       = var.associate_public_ip ? aws_eip.instance[0].allocation_id : null
}

# Network Configuration
output "subnet_id" {
  description = "Subnet ID where the instance is placed"
  value       = aws_instance.main.subnet_id
}

output "vpc_security_group_ids" {
  description = "List of VPC security group IDs associated with the instance"
  value       = aws_instance.main.vpc_security_group_ids
}

output "security_group_id" {
  description = "ID of the created security group (if created)"
  value       = var.create_security_group ? aws_security_group.instance[0].id : null
}

output "security_group_arn" {
  description = "ARN of the created security group (if created)"
  value       = var.create_security_group ? aws_security_group.instance[0].arn : null
}

output "security_group_name" {
  description = "Name of the created security group (if created)"
  value       = var.create_security_group ? aws_security_group.instance[0].name : null
}

# Storage Information
output "root_block_device" {
  description = "Root block device information"
  value = {
    device_name = aws_instance.main.root_block_device[0].device_name
    volume_id   = aws_instance.main.root_block_device[0].volume_id
    volume_size = aws_instance.main.root_block_device[0].volume_size
    volume_type = aws_instance.main.root_block_device[0].volume_type
    encrypted   = aws_instance.main.root_block_device[0].encrypted
    kms_key_id  = aws_instance.main.root_block_device[0].kms_key_id
  }
}

output "ebs_block_devices" {
  description = "Additional EBS block devices information"
  value = [
    for device in aws_instance.main.ebs_block_device : {
      device_name = device.device_name
      volume_id   = device.volume_id
      volume_size = device.volume_size
      volume_type = device.volume_type
      encrypted   = device.encrypted
      kms_key_id  = device.kms_key_id
    }
  ]
}

# Monitoring and Management
output "monitoring" {
  description = "Whether detailed monitoring is enabled"
  value       = aws_instance.main.monitoring
}

output "disable_api_termination" {
  description = "Whether termination protection is enabled"
  value       = aws_instance.main.disable_api_termination
}

# Tags
output "tags" {
  description = "Tags assigned to the instance"
  value       = aws_instance.main.tags
}

# Connection Information
output "ssh_connection" {
  description = "SSH connection information"
  value = {
    host        = var.associate_public_ip ? (aws_instance.main.public_ip != "" ? aws_instance.main.public_ip : aws_eip.instance[0].public_ip) : aws_instance.main.private_ip
    port        = var.ssh_port
    user        = "ec2-user"  # Default for Amazon Linux
    private_key = var.key_pair_name != "" ? "~/.ssh/${var.key_pair_name}.pem" : null
  }
  sensitive = false
}

# Instance metadata
output "instance_metadata" {
  description = "Instance metadata information"
  value = {
    instance_id       = aws_instance.main.id
    instance_type     = aws_instance.main.instance_type
    availability_zone = aws_instance.main.availability_zone
    private_ip        = aws_instance.main.private_ip
    public_ip         = aws_instance.main.public_ip
    state             = aws_instance.main.instance_state
    launch_time       = aws_instance.main.instance_state == "running" ? "available" : "not_available"
  }
}
