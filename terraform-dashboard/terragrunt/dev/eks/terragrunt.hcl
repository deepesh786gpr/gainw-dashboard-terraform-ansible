# EKS Development Environment Configuration

# Include the root terragrunt.hcl configuration
include "root" {
  path = find_in_parent_folders()
}

# Specify the Terraform module source
terraform {
  source = "../../../terraform-modules/eks"
}

# Environment-specific inputs
inputs = {
  # Environment
  environment = "dev"
  
  # EKS Configuration
  cluster_name       = "terraform-dashboard-dev"
  kubernetes_version = "1.28"
  
  # VPC Configuration
  vpc_cidr = "10.0.0.0/16"
  public_subnet_cidrs = [
    "10.0.1.0/24",
    "10.0.2.0/24"
  ]
  private_subnet_cidrs = [
    "10.0.10.0/24",
    "10.0.20.0/24"
  ]
  
  # Node Group Configuration
  node_instance_types = ["t3.medium"]
  desired_capacity    = 2
  max_capacity        = 4
  min_capacity        = 1
  disk_size          = 20
  
  # Security Configuration
  endpoint_private_access = true
  endpoint_public_access  = true
  public_access_cidrs    = ["0.0.0.0/0"]
  
  # Logging
  cluster_log_types = [
    "api",
    "audit",
    "authenticator",
    "controllerManager",
    "scheduler"
  ]
  
  # Tags
  tags = {
    Environment = "dev"
    Project     = "terraform-dashboard"
    Component   = "eks"
    Owner       = "devops-team"
  }
}

# Dependencies
dependencies {
  paths = []
}
