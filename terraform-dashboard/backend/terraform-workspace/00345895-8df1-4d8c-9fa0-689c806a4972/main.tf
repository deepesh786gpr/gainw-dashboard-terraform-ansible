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

variable "instance_type" {
  type = string
  description = "Variable instance_type"
}

resource "aws_instance" "main" {
  ami = "ami-0c02fb55956c7d316"
  instance_type = var.instance_type
  tags = {
    Name = var.name
  }
}