# Lambda Development Environment Configuration

# Include the root terragrunt.hcl configuration
include "root" {
  path = find_in_parent_folders()
}

# Specify the Terraform module source
terraform {
  source = "../../../terraform-modules/lambda"
}

# Environment-specific inputs
inputs = {
  # Environment
  environment = "dev"
  
  # Lambda Configuration
  function_name = "terraform-dashboard-processor-dev"
  handler      = "index.handler"
  runtime      = "python3.9"
  timeout      = 30
  memory_size  = 256
  
  # Code Configuration
  source_path = "../../../lambda-functions/processor"  # Path to your Lambda code
  
  # Environment Variables
  environment_variables = {
    ENVIRONMENT = "dev"
    LOG_LEVEL   = "DEBUG"
    S3_BUCKET   = "terraform-dashboard-dev-bucket"
    RDS_ENDPOINT = "terraform-dashboard-dev.cluster-xyz.us-east-1.rds.amazonaws.com"
  }
  
  # VPC Configuration (if Lambda needs to access RDS)
  vpc_config = {
    subnet_ids = [
      "subnet-12345678",  # Replace with actual subnet IDs from RDS module
      "subnet-87654321"
    ]
    security_group_ids = [
      "sg-12345678"  # Replace with actual security group ID
    ]
  }
  
  # Dead Letter Queue
  dead_letter_target_arn = "arn:aws:sqs:us-east-1:123456789012:lambda-dlq-dev"
  
  # Tracing
  tracing_mode = "Active"
  
  # Layers (if you have custom layers)
  layers = [
    "arn:aws:lambda:us-east-1:123456789012:layer:python-dependencies:1"
  ]
  
  # Concurrency
  reserved_concurrent_executions = 10
  
  # Versioning
  publish = true
  
  # Alias
  alias_name             = "dev"
  alias_description      = "Development alias"
  alias_function_version = "$LATEST"
  
  # CloudWatch Logs
  log_retention_in_days = 7
  
  # Custom IAM Policies
  custom_policies = [
    {
      Effect = "Allow"
      Action = [
        "s3:GetObject",
        "s3:PutObject",
        "s3:DeleteObject"
      ]
      Resource = [
        "arn:aws:s3:::terraform-dashboard-dev-*/*"
      ]
    },
    {
      Effect = "Allow"
      Action = [
        "rds:DescribeDBInstances",
        "rds:DescribeDBClusters"
      ]
      Resource = "*"
    },
    {
      Effect = "Allow"
      Action = [
        "secretsmanager:GetSecretValue"
      ]
      Resource = [
        "arn:aws:secretsmanager:us-east-1:*:secret:terraform-dashboard-dev-*"
      ]
    }
  ]
  
  # Triggers
  triggers = [
    {
      type                = "cloudwatch_event"
      principal           = "events.amazonaws.com"
      schedule_expression = "rate(5 minutes)"  # Run every 5 minutes
    },
    {
      type       = "s3"
      principal  = "s3.amazonaws.com"
      source_arn = "arn:aws:s3:::terraform-dashboard-dev-*"
    }
  ]
  
  # API Gateway Integration
  create_api_gateway     = true
  api_gateway_stage_name = "dev"
  
  # Tags
  tags = {
    Environment = "dev"
    Project     = "terraform-dashboard"
    Component   = "lambda"
    Owner       = "devops-team"
    Purpose     = "data-processing"
  }
}

# Dependencies - Lambda depends on S3 and RDS
dependencies {
  paths = [
    "../s3",
    "../rds"
  ]
}

# Dependency outputs that can be referenced
dependency "s3" {
  config_path = "../s3"
  
  mock_outputs = {
    bucket_id = "mock-bucket-id"
  }
  mock_outputs_allowed_terraform_commands = ["validate", "plan"]
}

dependency "rds" {
  config_path = "../rds"
  
  mock_outputs = {
    db_instance_endpoint = "mock-rds-endpoint"
    security_group_id    = "sg-mock123"
    private_subnet_ids   = ["subnet-mock1", "subnet-mock2"]
  }
  mock_outputs_allowed_terraform_commands = ["validate", "plan"]
}

# Override inputs with dependency outputs
inputs = merge(
  local.base_inputs,
  {
    environment_variables = merge(
      local.base_inputs.environment_variables,
      {
        S3_BUCKET    = dependency.s3.outputs.bucket_id
        RDS_ENDPOINT = dependency.rds.outputs.db_instance_endpoint
      }
    )
    vpc_config = {
      subnet_ids         = dependency.rds.outputs.private_subnet_ids
      security_group_ids = [dependency.rds.outputs.security_group_id]
    }
  }
)

locals {
  base_inputs = {
    # Environment
    environment = "dev"
    
    # Lambda Configuration
    function_name = "terraform-dashboard-processor-dev"
    handler      = "index.handler"
    runtime      = "python3.9"
    timeout      = 30
    memory_size  = 256
    
    # Environment Variables (base set)
    environment_variables = {
      ENVIRONMENT = "dev"
      LOG_LEVEL   = "DEBUG"
    }
    
    # Other configurations...
    tracing_mode = "Active"
    publish      = true
    alias_name   = "dev"
    log_retention_in_days = 7
    
    # Custom IAM Policies
    custom_policies = [
      {
        Effect = "Allow"
        Action = [
          "s3:GetObject",
          "s3:PutObject",
          "s3:DeleteObject"
        ]
        Resource = [
          "arn:aws:s3:::terraform-dashboard-dev-*/*"
        ]
      }
    ]
    
    # API Gateway
    create_api_gateway     = true
    api_gateway_stage_name = "dev"
    
    # Tags
    tags = {
      Environment = "dev"
      Project     = "terraform-dashboard"
      Component   = "lambda"
      Owner       = "devops-team"
    }
  }
}
