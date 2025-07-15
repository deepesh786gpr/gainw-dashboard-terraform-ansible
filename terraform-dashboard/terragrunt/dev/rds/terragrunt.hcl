# RDS Development Environment Configuration

# Include the root terragrunt.hcl configuration
include "root" {
  path = find_in_parent_folders()
}

# Specify the Terraform module source
terraform {
  source = "../../../terraform-modules/rds"
}

# Environment-specific inputs
inputs = {
  # Environment
  environment = "dev"
  
  # RDS Configuration
  identifier     = "terraform-dashboard-dev"
  engine         = "mysql"
  engine_version = "8.0"
  instance_class = "db.t3.micro"
  
  # Storage Configuration
  allocated_storage     = 20
  max_allocated_storage = 100
  storage_type         = "gp2"
  storage_encrypted    = true
  create_kms_key       = true
  
  # Database Configuration
  db_name  = "dashboard"
  username = "admin"
  port     = 3306
  manage_master_user_password = true
  
  # Network Configuration
  create_vpc = true
  vpc_cidr   = "10.1.0.0/16"
  private_subnet_cidrs = [
    "10.1.1.0/24",
    "10.1.2.0/24"
  ]
  publicly_accessible = false
  allowed_cidr_blocks = ["10.1.0.0/16"]
  
  # Backup Configuration
  backup_retention_period = 7
  backup_window          = "03:00-04:00"
  maintenance_window     = "sun:04:00-sun:05:00"
  copy_tags_to_snapshot  = true
  
  # Monitoring
  monitoring_interval              = 60
  performance_insights_enabled     = true
  performance_insights_retention_period = 7
  enabled_cloudwatch_logs_exports = ["error", "general", "slow_query"]
  
  # Parameter Group
  create_parameter_group = true
  parameter_group_family = "mysql8.0"
  parameters = [
    {
      name  = "innodb_buffer_pool_size"
      value = "{DBInstanceClassMemory*3/4}"
    }
  ]
  
  # High Availability
  multi_az = false  # Set to true for production
  
  # Read Replica
  create_read_replica = false  # Set to true if needed
  
  # Deletion Protection
  deletion_protection = false  # Set to true for production
  skip_final_snapshot = true   # Set to false for production
  
  # Tags
  tags = {
    Environment = "dev"
    Project     = "terraform-dashboard"
    Component   = "rds"
    Owner       = "devops-team"
  }
}

# Dependencies
dependencies {
  paths = []
}
