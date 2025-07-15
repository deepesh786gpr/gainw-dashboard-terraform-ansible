# Complete Infrastructure Example Outputs

# VPC Outputs
output "vpc_id" {
  description = "ID of the VPC"
  value       = module.vpc.vpc_id
}

output "vpc_cidr_block" {
  description = "CIDR block of the VPC"
  value       = module.vpc.vpc_cidr_block
}

output "public_subnets" {
  description = "List of IDs of public subnets"
  value       = module.vpc.public_subnets
}

output "private_subnets" {
  description = "List of IDs of private subnets"
  value       = module.vpc.private_subnets
}

output "database_subnets" {
  description = "List of IDs of database subnets"
  value       = module.vpc.database_subnets
}

# S3 Outputs
output "app_storage_bucket_id" {
  description = "ID of the application storage bucket"
  value       = module.app_storage.bucket_id
}

output "app_storage_bucket_arn" {
  description = "ARN of the application storage bucket"
  value       = module.app_storage.bucket_arn
}

output "backup_storage_bucket_id" {
  description = "ID of the backup storage bucket"
  value       = module.backup_storage.bucket_id
}

output "backup_storage_bucket_arn" {
  description = "ARN of the backup storage bucket"
  value       = module.backup_storage.bucket_arn
}

# Database Outputs
output "database_endpoint" {
  description = "RDS instance endpoint"
  value       = module.database.db_instance_endpoint
}

output "database_port" {
  description = "RDS instance port"
  value       = module.database.db_instance_port
}

output "database_name" {
  description = "RDS instance database name"
  value       = module.database.db_instance_name
}

output "database_username" {
  description = "RDS instance master username"
  value       = module.database.db_instance_username
  sensitive   = true
}

# EC2 Application Server Outputs
output "app_server_autoscaling_group_name" {
  description = "Name of the Auto Scaling Group"
  value       = module.app_servers.autoscaling_group_name
}

output "app_server_launch_template_id" {
  description = "ID of the launch template"
  value       = module.app_servers.launch_template_id
}

output "app_server_security_group_id" {
  description = "ID of the application server security group"
  value       = module.app_servers.security_group_id
}

# EKS Outputs (conditional)
output "eks_cluster_id" {
  description = "EKS cluster ID"
  value       = var.enable_eks ? module.eks_cluster[0].cluster_id : null
}

output "eks_cluster_endpoint" {
  description = "Endpoint for EKS control plane"
  value       = var.enable_eks ? module.eks_cluster[0].cluster_endpoint : null
}

output "eks_cluster_security_group_id" {
  description = "Security group ID attached to the EKS cluster"
  value       = var.enable_eks ? module.eks_cluster[0].cluster_security_group_id : null
}

output "eks_cluster_certificate_authority_data" {
  description = "Base64 encoded certificate data required to communicate with the cluster"
  value       = var.enable_eks ? module.eks_cluster[0].cluster_certificate_authority_data : null
}

output "eks_node_groups" {
  description = "EKS node groups"
  value       = var.enable_eks ? module.eks_cluster[0].node_groups : null
}

# Lambda Outputs
output "api_function_arn" {
  description = "ARN of the API Lambda function"
  value       = module.api_function.lambda_function_arn
}

output "api_function_url" {
  description = "Function URL for the API Lambda"
  value       = module.api_function.lambda_function_url
}

output "api_function_name" {
  description = "Name of the API Lambda function"
  value       = module.api_function.lambda_function_name
}

output "data_processor_function_arn" {
  description = "ARN of the data processor Lambda function"
  value       = module.data_processor.lambda_function_arn
}

output "data_processor_function_name" {
  description = "Name of the data processor Lambda function"
  value       = module.data_processor.lambda_function_name
}

# Connection Information
output "connection_info" {
  description = "Connection information for the infrastructure"
  value = {
    vpc = {
      id         = module.vpc.vpc_id
      cidr_block = module.vpc.vpc_cidr_block
    }
    database = {
      endpoint = module.database.db_instance_endpoint
      port     = module.database.db_instance_port
      name     = module.database.db_instance_name
    }
    storage = {
      app_bucket    = module.app_storage.bucket_id
      backup_bucket = module.backup_storage.bucket_id
    }
    compute = {
      asg_name          = module.app_servers.autoscaling_group_name
      security_group_id = module.app_servers.security_group_id
    }
    serverless = {
      api_function_url  = module.api_function.lambda_function_url
      api_function_name = module.api_function.lambda_function_name
    }
    kubernetes = var.enable_eks ? {
      cluster_endpoint = module.eks_cluster[0].cluster_endpoint
      cluster_name     = module.eks_cluster[0].cluster_id
    } : null
  }
}

# Resource ARNs for IAM policies
output "resource_arns" {
  description = "ARNs of created resources for IAM policy references"
  value = {
    vpc_arn                    = module.vpc.vpc_arn
    app_storage_bucket_arn     = module.app_storage.bucket_arn
    backup_storage_bucket_arn  = module.backup_storage.bucket_arn
    database_arn               = module.database.db_instance_arn
    api_function_arn           = module.api_function.lambda_function_arn
    data_processor_function_arn = module.data_processor.lambda_function_arn
    eks_cluster_arn            = var.enable_eks ? module.eks_cluster[0].cluster_arn : null
  }
}

# Security Group IDs for cross-referencing
output "security_group_ids" {
  description = "Security group IDs for cross-referencing"
  value = {
    database_sg    = module.database.security_group_id
    app_server_sg  = module.app_servers.security_group_id
    api_function_sg = module.api_function.lambda_security_group_id
    eks_cluster_sg = var.enable_eks ? module.eks_cluster[0].cluster_security_group_id : null
  }
}
