# Root Terragrunt configuration
# This file contains shared configuration for all environments

# Configure Terragrunt to automatically retry on transient errors
retryable_errors = [
  "(?s).*Error installing provider.*tcp.*connection reset by peer.*",
  "(?s).*ssh_exchange_identification.*Connection closed by remote host.*",
  "(?s).*Client\\.Timeout exceeded while awaiting headers.*",
  "(?s).*connection reset by peer.*",
  "(?s).*TLS handshake timeout.*",
]

# Configure remote state backend
remote_state {
  backend = "s3"
  
  generate = {
    path      = "backend.tf"
    if_exists = "overwrite_terragrunt"
  }
  
  config = {
    bucket = "terraform-state-${get_env("AWS_ACCOUNT_ID", "default")}-${get_env("AWS_REGION", "us-east-1")}"
    key    = "${path_relative_to_include()}/terraform.tfstate"
    region = get_env("AWS_REGION", "us-east-1")
    
    encrypt        = true
    dynamodb_table = "terraform-locks"
    
    # S3 bucket versioning
    versioning = true
    
    # S3 server-side encryption
    server_side_encryption_configuration = {
      rule = {
        apply_server_side_encryption_by_default = {
          sse_algorithm = "AES256"
        }
      }
    }
  }
}

# Generate provider configuration
generate "provider" {
  path      = "provider.tf"
  if_exists = "overwrite_terragrunt"
  contents  = <<EOF
terraform {
  required_version = ">= 1.0"
  
  required_providers {
    aws = {
      source  = "hashicorp/aws"
      version = ">= 4.0"
    }
    null = {
      source  = "hashicorp/null"
      version = ">= 3.0"
    }
    local = {
      source  = "hashicorp/local"
      version = ">= 2.0"
    }
  }
}

provider "aws" {
  region = var.aws_region
  
  default_tags {
    tags = var.default_tags
  }
}
EOF
}

# Input variables that will be available to all child configurations
inputs = {
  # AWS Configuration
  aws_region = get_env("AWS_REGION", "us-east-1")
  
  # Default tags applied to all resources
  default_tags = {
    Project     = "ec2-management"
    ManagedBy   = "terragrunt"
    Environment = local.environment
    Repository  = "new-dashboard"
  }
}

# Local values for reuse
locals {
  # Extract environment from the path
  environment = regex("environments/([^/]+)/.*", path_relative_to_include())[0]
  
  # Common naming prefix
  name_prefix = "ec2-mgmt-${local.environment}"
  
  # Account and region info
  account_id = get_env("AWS_ACCOUNT_ID", "")
  region     = get_env("AWS_REGION", "us-east-1")
}
