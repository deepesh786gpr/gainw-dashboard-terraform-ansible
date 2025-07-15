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

variable "cluster_name" {
  type = string
  description = "Variable cluster_name"
}

variable "kubernetes_version" {
  type = string
  description = "Variable kubernetes_version"
}

variable "vpc_cidr" {
  type = string
  description = "Variable vpc_cidr"
}

# Data sources for availability zones
data "aws_availability_zones" "available" {
  state = "available"
}

# Local values for computed configurations
locals {
  azs = slice(data.aws_availability_zones.available.names, 0, 2)
  
  common_tags = {
    Name        = var.cluster_name
    Environment = var.environment
    Module      = "eks-cluster"
    Terraform   = "true"
  }
}

# VPC for EKS cluster
resource "aws_vpc" "eks_vpc" {
  cidr_block           = var.vpc_cidr
  enable_dns_hostnames = true
  enable_dns_support   = true
  
  tags = merge(
    local.common_tags,
    {
      Name = "${var.cluster_name}-vpc"
      "kubernetes.io/cluster/${var.cluster_name}" = "shared"
    }
  )
}

# Internet Gateway
resource "aws_internet_gateway" "eks_igw" {
  vpc_id = aws_vpc.eks_vpc.id
  
  tags = merge(
    local.common_tags,
    {
      Name = "${var.cluster_name}-igw"
    }
  )
}

# Public Subnets
resource "aws_subnet" "public" {
  count = length(var.public_subnet_cidrs)
  
  vpc_id                  = aws_vpc.eks_vpc.id
  cidr_block              = var.public_subnet_cidrs[count.index]
  availability_zone       = local.azs[count.index]
  map_public_ip_on_launch = true
  
  tags = merge(
    local.common_tags,
    {
      Name = "${var.cluster_name}-public-${local.azs[count.index]}"
      "kubernetes.io/cluster/${var.cluster_name}" = "shared"
      "kubernetes.io/role/elb" = "1"
    }
  )
}

# Private Subnets
resource "aws_subnet" "private" {
  count = length(var.private_subnet_cidrs)
  
  vpc_id            = aws_vpc.eks_vpc.id
  cidr_block        = var.private_subnet_cidrs[count.index]
  availability_zone = local.azs[count.index]
  
  tags = merge(
    local.common_tags,
    {
      Name = "${var.cluster_name}-private-${local.azs[count.index]}"
      "kubernetes.io/cluster/${var.cluster_name}" = "shared"
      "kubernetes.io/role/internal-elb" = "1"
    }
  )
}

# EKS Cluster IAM Role
resource "aws_iam_role" "eks_cluster_role" {
  name = "${var.cluster_name}-cluster-role"
  
  assume_role_policy = jsonencode({
    Version = "2012-10-17"
    Statement = [
      {
        Action = "sts:AssumeRole"
        Effect = "Allow"
        Principal = {
          Service = "eks.amazonaws.com"
        }
      }
    ]
  })
  
  tags = local.common_tags
}

resource "aws_iam_role_policy_attachment" "eks_cluster_policy" {
  policy_arn = "arn:aws:iam::aws:policy/AmazonEKSClusterPolicy"
  role       = aws_iam_role.eks_cluster_role.name
}

# EKS Cluster
resource "aws_eks_cluster" "main" {
  name     = var.cluster_name
  role_arn = aws_iam_role.eks_cluster_role.arn
  version  = var.kubernetes_version
  
  vpc_config {
    subnet_ids              = concat(aws_subnet.public[*].id, aws_subnet.private[*].id)
    endpoint_private_access = var.endpoint_private_access
    endpoint_public_access  = var.endpoint_public_access
    public_access_cidrs     = var.public_access_cidrs
  }
  
  enabled_cluster_log_types = var.cluster_log_types
  
  dynamic "encryption_config" {
    for_each = var.kms_key_arn != null ? [1] : []
    content {
      provider {
        key_arn = var.kms_key_arn
      }
      resources = ["secrets"]
    }
  }
  
  tags = local.common_tags
  
  depends_on = [
    aws_iam_role_policy_attachment.eks_cluster_policy
  ]
}