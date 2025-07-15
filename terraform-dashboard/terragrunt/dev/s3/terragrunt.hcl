# S3 Development Environment Configuration

# Include the root terragrunt.hcl configuration
include "root" {
  path = find_in_parent_folders()
}

# Specify the Terraform module source
terraform {
  source = "../../../terraform-modules/s3"
}

# Environment-specific inputs
inputs = {
  # Environment
  environment = "dev"
  
  # S3 Configuration
  bucket_name   = "terraform-dashboard-dev-${random_id.bucket_suffix.hex}"
  force_destroy = true  # Set to false for production
  
  # Versioning
  versioning_enabled = true
  
  # Encryption
  sse_algorithm    = "aws:kms"
  create_kms_key   = true
  bucket_key_enabled = true
  
  # Public Access Block
  block_public_acls       = true
  block_public_policy     = true
  ignore_public_acls      = true
  restrict_public_buckets = true
  
  # Lifecycle Rules
  lifecycle_rules = [
    {
      id      = "delete_old_versions"
      enabled = true
      noncurrent_version_expiration = {
        days = 30
      }
      transitions = [
        {
          days          = 30
          storage_class = "STANDARD_IA"
        },
        {
          days          = 60
          storage_class = "GLACIER"
        },
        {
          days          = 365
          storage_class = "DEEP_ARCHIVE"
        }
      ]
    },
    {
      id      = "delete_incomplete_multipart_uploads"
      enabled = true
      filter = {
        prefix = "uploads/"
      }
      expiration = {
        days = 7
      }
    }
  ]
  
  # CORS Configuration (if needed for web uploads)
  cors_rules = [
    {
      allowed_headers = ["*"]
      allowed_methods = ["GET", "PUT", "POST"]
      allowed_origins = ["https://terraform-dashboard-dev.example.com"]
      expose_headers  = ["ETag"]
      max_age_seconds = 3000
    }
  ]
  
  # Logging Configuration
  logging_configuration = {
    target_bucket = "terraform-dashboard-dev-access-logs-${random_id.bucket_suffix.hex}"
    target_prefix = "access-logs/"
  }
  
  # Notification Configuration (example for Lambda processing)
  notification_configuration = {
    lambda_configurations = [
      {
        lambda_function_arn = "arn:aws:lambda:us-east-1:123456789012:function:process-uploads"
        events              = ["s3:ObjectCreated:*"]
        filter_prefix       = "uploads/"
        filter_suffix       = ".json"
      }
    ]
  }
  
  # Tags
  tags = {
    Environment = "dev"
    Project     = "terraform-dashboard"
    Component   = "s3"
    Owner       = "devops-team"
    Purpose     = "application-storage"
  }
}

# Generate a random suffix for bucket names to ensure uniqueness
generate "random" {
  path      = "random.tf"
  if_exists = "overwrite_terragrunt"
  contents  = <<EOF
resource "random_id" "bucket_suffix" {
  byte_length = 4
}
EOF
}

# Dependencies
dependencies {
  paths = []
}
