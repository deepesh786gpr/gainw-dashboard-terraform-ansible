# Test deployment configuration
include "root" {
  path = find_in_parent_folders()
}

terraform {
  source = "../modules/ec2-instance"
}

inputs = {
  name = "test-instance-1752472141"
  instance_type = "t3.nano"  # Smallest instance for testing
  
  # Use default VPC and subnet for testing
  vpc_id = data.aws_vpc.default.id
  subnet_id = data.aws_subnets.default.ids[0]
  
  create_security_group = true
  security_group_name = "test-instance-1752472141-sg"
  allowed_cidr_blocks = ["10.0.0.0/8"]
  
  # Minimal storage
  root_volume_size = 8
  root_volume_type = "gp3"
  root_volume_encrypted = false  # Disable for testing
  
  # No public IP for testing
  associate_public_ip = false
  
  # Disable monitoring for testing
  enable_detailed_monitoring = false
  enable_termination_protection = false
  
  # Test tags
  instance_tags = {
    Name = "test-instance-1752472141"
    Purpose = "automated-testing"
    Environment = "test"
  }
  
  environment = "test"
}

# Add data sources for default VPC
generate "test_data" {
  path      = "test_data.tf"
  if_exists = "overwrite"
  contents  = <<DATA
data "aws_vpc" "default" {
  default = true
}

data "aws_subnets" "default" {
  filter {
    name   = "vpc-id"
    values = [data.aws_vpc.default.id]
  }
}
DATA
}
