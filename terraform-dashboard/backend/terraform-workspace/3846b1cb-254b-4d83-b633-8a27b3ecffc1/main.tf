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
      Environment = var.environment
      ManagedBy   = "terraform-dashboard"
      Project     = "terraform-dashboard"
    }
  }
}

variable "aws_region" {
  type        = string
  description = "AWS region"
  default     = "us-east-1"
}

variable "environment" {
  type        = string
  description = "Environment name"
  default     = "dev"
}

variable "name" {
  type = string
  description = "Variable name"
}

variable "bucket_name" {
  type = string
  description = "Variable bucket_name"
}

variable "use_random_suffix" {
  type = string
  description = "Variable use_random_suffix"
}

variable "versioning_enabled" {
  type = string
  description = "Variable versioning_enabled"
}

variable "sse_algorithm" {
  type = string
  description = "Variable sse_algorithm"
}

variable "block_public_acls" {
  type = string
  description = "Variable block_public_acls"
}

variable "block_public_policy" {
  type = string
  description = "Variable block_public_policy"
}

variable "lifecycle_rules" {
  type = string
  description = "Variable lifecycle_rules"
}

# S3 Module - Production Ready
# Creates S3 bucket with security, versioning, encryption, and lifecycle policies

# Random suffix for bucket name uniqueness
resource "random_string" "bucket_suffix" {
  count   = var.use_random_suffix ? 1 : 0
  length  = 8
  special = false
  upper   = false
}

locals {
  bucket_name = var.use_random_suffix ? "${var.bucket_name}-${random_string.bucket_suffix[0].result}" : var.bucket_name
}

# S3 Bucket
resource "aws_s3_bucket" "main" {
  bucket        = local.bucket_name
  force_destroy = var.force_destroy

  tags = merge(var.tags, {
    Name = local.bucket_name
    Type = "S3 Bucket"
  })
}

# S3 Bucket Versioning
resource "aws_s3_bucket_versioning" "main" {
  bucket = aws_s3_bucket.main.id
  versioning_configuration {
    status = var.versioning_enabled ? "Enabled" : "Suspended"
  }
}

# S3 Bucket Server Side Encryption Configuration
resource "aws_s3_bucket_server_side_encryption_configuration" "main" {
  bucket = aws_s3_bucket.main.id

  rule {
    apply_server_side_encryption_by_default {
      kms_master_key_id = var.kms_master_key_id
      sse_algorithm     = var.sse_algorithm
    }
    bucket_key_enabled = var.bucket_key_enabled
  }
}

# S3 Bucket Public Access Block
resource "aws_s3_bucket_public_access_block" "main" {
  bucket = aws_s3_bucket.main.id

  block_public_acls       = var.block_public_acls
  block_public_policy     = var.block_public_policy
  ignore_public_acls      = var.ignore_public_acls
  restrict_public_buckets = var.restrict_public_buckets
}

# S3 Bucket ACL
resource "aws_s3_bucket_acl" "main" {
  count = var.acl != null ? 1 : 0

  bucket = aws_s3_bucket.main.id
  acl    = var.acl

  depends_on = [aws_s3_bucket_ownership_controls.main]
}

# S3 Bucket Ownership Controls
resource "aws_s3_bucket_ownership_controls" "main" {
  bucket = aws_s3_bucket.main.id

  rule {
    object_ownership = var.object_ownership
  }
}

# S3 Bucket Lifecycle Configuration
resource "aws_s3_bucket_lifecycle_configuration" "main" {
  count = length(var.lifecycle_rules) > 0 ? 1 : 0

  bucket = aws_s3_bucket.main.id

  dynamic "rule" {
    for_each = var.lifecycle_rules
    content {
      id     = rule.value.id
      status = rule.value.status

      dynamic "filter" {
        for_each = rule.value.filter != null ? [rule.value.filter] : []
        content {
          prefix = filter.value.prefix
          dynamic "tag" {
            for_each = filter.value.tags != null ? filter.value.tags : {}
            content {
              key   = tag.key
              value = tag.value
            }
          }
        }
      }

      dynamic "expiration" {
        for_each = rule.value.expiration != null ? [rule.value.expiration] : []
        content {
          days                         = expiration.value.days
          date                         = expiration.value.date
          expired_object_delete_marker = expiration.value.expired_object_delete_marker
        }
      }

      dynamic "noncurrent_version_expiration" {
        for_each = rule.value.noncurrent_version_expiration != null ? [rule.value.noncurrent_version_expiration] : []
        content {
          noncurrent_days = noncurrent_version_expiration.value.noncurrent_days
        }
      }

      dynamic "transition" {
        for_each = rule.value.transitions != null ? rule.value.transitions : []
        content {
          days          = transition.value.days
          date          = transition.value.date
          storage_class = transition.value.storage_class
        }
      }

      dynamic "noncurrent_version_transition" {
        for_each = rule.value.noncurrent_version_transitions != null ? rule.value.noncurrent_version_transitions : []
        content {
          noncurrent_days = noncurrent_version_transition.value.noncurrent_days
          storage_class   = noncurrent_version_transition.value.storage_class
        }
      }
    }
  }

  depends_on = [aws_s3_bucket_versioning.main]
}

# S3 Bucket CORS Configuration
resource "aws_s3_bucket_cors_configuration" "main" {
  count = length(var.cors_rules) > 0 ? 1 : 0

  bucket = aws_s3_bucket.main.id

  dynamic "cors_rule" {
    for_each = var.cors_rules
    content {
      allowed_headers = cors_rule.value.allowed_headers
      allowed_methods = cors_rule.value.allowed_methods
      allowed_origins = cors_rule.value.allowed_origins
      expose_headers  = cors_rule.value.expose_headers
      max_age_seconds = cors_rule.value.max_age_seconds
    }
  }
}

# S3 Bucket Website Configuration
resource "aws_s3_bucket_website_configuration" "main" {
  count = var.website_configuration != null ? 1 : 0

  bucket = aws_s3_bucket.main.id

  dynamic "index_document" {
    for_each = var.website_configuration.index_document != null ? [var.website_configuration.index_document] : []
    content {
      suffix = index_document.value.suffix
    }
  }

  dynamic "error_document" {
    for_each = var.website_configuration.error_document != null ? [var.website_configuration.error_document] : []
    content {
      key = error_document.value.key
    }
  }

  dynamic "redirect_all_requests_to" {
    for_each = var.website_configuration.redirect_all_requests_to != null ? [var.website_configuration.redirect_all_requests_to] : []
    content {
      host_name = redirect_all_requests_to.value.host_name
      protocol  = redirect_all_requests_to.value.protocol
    }
  }

  dynamic "routing_rule" {
    for_each = var.website_configuration.routing_rules != null ? var.website_configuration.routing_rules : []
    content {
      dynamic "condition" {
        for_each = routing_rule.value.condition != null ? [routing_rule.value.condition] : []
        content {
          http_error_code_returned_equals = condition.value.http_error_code_returned_equals
          key_prefix_equals               = condition.value.key_prefix_equals
        }
      }

      redirect {
        host_name               = routing_rule.value.redirect.host_name
        http_redirect_code      = routing_rule.value.redirect.http_redirect_code
        protocol                = routing_rule.value.redirect.protocol
        replace_key_prefix_with = routing_rule.value.redirect.replace_key_prefix_with
        replace_key_with        = routing_rule.value.redirect.replace_key_with
      }
    }
  }
}

# S3 Bucket Logging
resource "aws_s3_bucket_logging" "main" {
  count = var.logging_configuration != null ? 1 : 0

  bucket = aws_s3_bucket.main.id

  target_bucket = var.logging_configuration.target_bucket
  target_prefix = var.logging_configuration.target_prefix
}

# S3 Bucket Notification
resource "aws_s3_bucket_notification" "main" {
  count = var.notification_configuration != null ? 1 : 0

  bucket = aws_s3_bucket.main.id

  dynamic "topic" {
    for_each = var.notification_configuration.topic_configurations != null ? var.notification_configuration.topic_configurations : []
    content {
      topic_arn     = topic.value.topic_arn
      events        = topic.value.events
      filter_prefix = topic.value.filter_prefix
      filter_suffix = topic.value.filter_suffix
    }
  }

  dynamic "queue" {
    for_each = var.notification_configuration.queue_configurations != null ? var.notification_configuration.queue_configurations : []
    content {
      queue_arn     = queue.value.queue_arn
      events        = queue.value.events
      filter_prefix = queue.value.filter_prefix
      filter_suffix = queue.value.filter_suffix
    }
  }

  dynamic "lambda_function" {
    for_each = var.notification_configuration.lambda_configurations != null ? var.notification_configuration.lambda_configurations : []
    content {
      lambda_function_arn = lambda_function.value.lambda_function_arn
      events              = lambda_function.value.events
      filter_prefix       = lambda_function.value.filter_prefix
      filter_suffix       = lambda_function.value.filter_suffix
    }
  }
}

# S3 Bucket Policy
resource "aws_s3_bucket_policy" "main" {
  count = var.bucket_policy != null ? 1 : 0

  bucket = aws_s3_bucket.main.id
  policy = var.bucket_policy

  depends_on = [aws_s3_bucket_public_access_block.main]
}
