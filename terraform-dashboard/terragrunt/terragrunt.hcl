# Root Terragrunt Configuration

# Configure Terragrunt to automatically store tfstate files in an S3 bucket
remote_state {
  backend = "s3"
  config = {
    encrypt        = true
    bucket         = "${get_env("TG_BUCKET_PREFIX", "terraform-dashboard")}-tfstate-${get_aws_account_id()}"
    key            = "${path_relative_to_include()}/terraform.tfstate"
    region         = get_env("AWS_DEFAULT_REGION", "us-east-1")
    dynamodb_table = "${get_env("TG_BUCKET_PREFIX", "terraform-dashboard")}-tfstate-lock"
  }
  generate = {
    path      = "backend.tf"
    if_exists = "overwrite_terragrunt"
  }
}

# Generate an AWS provider block
generate "provider" {
  path      = "provider.tf"
  if_exists = "overwrite_terragrunt"
  contents  = <<EOF
terraform {
  required_version = ">= 1.0"
  required_providers {
    aws = {
      source  = "hashicorp/aws"
      version = "~> 5.0"
    }
  }
}

provider "aws" {
  region = var.aws_region
  
  default_tags {
    tags = {
      Terraform   = "true"
      Environment = var.environment
      Project     = "terraform-dashboard"
      ManagedBy   = "terragrunt"
    }
  }
}
EOF
}

# Configure root level variables that all resources can inherit
inputs = {
  aws_region = get_env("AWS_DEFAULT_REGION", "us-east-1")
}
