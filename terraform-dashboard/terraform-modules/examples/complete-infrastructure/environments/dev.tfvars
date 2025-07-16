# Development Environment Configuration

# General
aws_region   = "us-east-1"
environment  = "dev"
project_name = "myapp"

# VPC - Smaller CIDR for dev
vpc_cidr                 = "10.1.0.0/16"
public_subnet_cidrs      = ["10.1.1.0/24", "10.1.2.0/24"]
private_subnet_cidrs     = ["10.1.10.0/24", "10.1.20.0/24"]
database_subnet_cidrs    = ["10.1.100.0/24", "10.1.200.0/24"]
enable_nat_gateway       = true
single_nat_gateway       = true  # Cost optimization for dev

# Database - Minimal for dev
db_engine               = "postgres"
db_engine_version       = "14.9"
db_instance_class       = "db.t3.micro"
db_allocated_storage    = 20
db_max_allocated_storage = 50
db_name                 = "devdb"
db_username             = "devadmin"

# Application Servers - Minimal for dev
app_instance_type    = "t3.small"
app_min_size         = 1
app_max_size         = 3
app_desired_capacity = 1

# EKS - Disabled for dev to save costs
enable_eks               = false
eks_cluster_version      = "1.27"
eks_node_instance_types  = ["t3.small"]
eks_node_min_size        = 1
eks_node_max_size        = 3
eks_node_desired_size    = 1
