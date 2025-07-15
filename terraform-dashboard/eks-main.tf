# EKS Module - Production Ready
# Creates EKS cluster with managed node groups, security groups, and IAM roles

# Data sources
data "aws_caller_identity" "current" {}
data "aws_partition" "current" {}

# KMS key for EKS encryption
resource "aws_kms_key" "eks" {
  count = var.create_kms_key ? 1 : 0

  description             = "EKS Secret Encryption Key"
  deletion_window_in_days = var.kms_key_deletion_window

  tags = merge(var.tags, {
    Name = "${var.cluster_name}-eks-kms-key"
    Type = "KMS Key"
  })
}

resource "aws_kms_alias" "eks" {
  count = var.create_kms_key ? 1 : 0

  name          = "alias/${var.cluster_name}-eks"
  target_key_id = aws_kms_key.eks[0].key_id
}

# EKS Cluster Service Role
resource "aws_iam_role" "cluster" {
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

  tags = merge(var.tags, {
    Name = "${var.cluster_name}-cluster-role"
    Type = "IAM Role"
  })
}

# Attach required policies to cluster role
resource "aws_iam_role_policy_attachment" "cluster_AmazonEKSClusterPolicy" {
  policy_arn = "arn:${data.aws_partition.current.partition}:iam::aws:policy/AmazonEKSClusterPolicy"
  role       = aws_iam_role.cluster.name
}

resource "aws_iam_role_policy_attachment" "cluster_AmazonEKSVPCResourceController" {
  policy_arn = "arn:${data.aws_partition.current.partition}:iam::aws:policy/AmazonEKSVPCResourceController"
  role       = aws_iam_role.cluster.name
}

# Additional cluster policies
resource "aws_iam_role_policy_attachment" "cluster_additional" {
  count = length(var.cluster_additional_policies)

  policy_arn = var.cluster_additional_policies[count.index]
  role       = aws_iam_role.cluster.name
}

# EKS Cluster Security Group
resource "aws_security_group" "cluster" {
  count = var.create_cluster_security_group ? 1 : 0

  name_prefix = "${var.cluster_name}-cluster-"
  vpc_id      = var.vpc_id
  description = "EKS cluster security group"

  # Allow all traffic between cluster and nodes
  ingress {
    from_port = 0
    to_port   = 65535
    protocol  = "tcp"
    self      = true
    description = "Allow all traffic from cluster security group"
  }

  # HTTPS API server access
  dynamic "ingress" {
    for_each = var.cluster_endpoint_public_access ? [1] : []
    content {
      from_port   = 443
      to_port     = 443
      protocol    = "tcp"
      cidr_blocks = var.cluster_endpoint_public_access_cidrs
      description = "HTTPS API server access"
    }
  }

  egress {
    from_port   = 0
    to_port     = 0
    protocol    = "-1"
    cidr_blocks = ["0.0.0.0/0"]
    description = "All outbound traffic"
  }

  tags = merge(var.tags, {
    Name = "${var.cluster_name}-cluster-sg"
    Type = "Security Group"
  })
}

# EKS Cluster
resource "aws_eks_cluster" "main" {
  name     = var.cluster_name
  role_arn = aws_iam_role.cluster.arn
  version  = var.cluster_version

  vpc_config {
    subnet_ids              = var.subnet_ids
    endpoint_private_access = var.cluster_endpoint_private_access
    endpoint_public_access  = var.cluster_endpoint_public_access
    public_access_cidrs     = var.cluster_endpoint_public_access_cidrs
    security_group_ids      = var.create_cluster_security_group ? [aws_security_group.cluster[0].id] : var.cluster_security_group_ids
  }

  dynamic "encryption_config" {
    for_each = var.cluster_encryption_config
    content {
      provider {
        key_arn = var.create_kms_key ? aws_kms_key.eks[0].arn : encryption_config.value.provider_key_arn
      }
      resources = encryption_config.value.resources
    }
  }

  enabled_cluster_log_types = var.cluster_enabled_log_types

  depends_on = [
    aws_iam_role_policy_attachment.cluster_AmazonEKSClusterPolicy,
    aws_iam_role_policy_attachment.cluster_AmazonEKSVPCResourceController,
  ]

  tags = merge(var.tags, {
    Name = var.cluster_name
    Type = "EKS Cluster"
  })
}

# EKS Node Group IAM Role
resource "aws_iam_role" "node_group" {
  count = var.create_node_groups ? 1 : 0

  name = "${var.cluster_name}-node-group-role"

  assume_role_policy = jsonencode({
    Version = "2012-10-17"
    Statement = [
      {
        Action = "sts:AssumeRole"
        Effect = "Allow"
        Principal = {
          Service = "ec2.amazonaws.com"
        }
      }
    ]
  })

  tags = merge(var.tags, {
    Name = "${var.cluster_name}-node-group-role"
    Type = "IAM Role"
  })
}

# Attach required policies to node group role
resource "aws_iam_role_policy_attachment" "node_group_AmazonEKSWorkerNodePolicy" {
  count = var.create_node_groups ? 1 : 0

  policy_arn = "arn:${data.aws_partition.current.partition}:iam::aws:policy/AmazonEKSWorkerNodePolicy"
  role       = aws_iam_role.node_group[0].name
}

resource "aws_iam_role_policy_attachment" "node_group_AmazonEKS_CNI_Policy" {
  count = var.create_node_groups ? 1 : 0

  policy_arn = "arn:${data.aws_partition.current.partition}:iam::aws:policy/AmazonEKS_CNI_Policy"
  role       = aws_iam_role.node_group[0].name
}

resource "aws_iam_role_policy_attachment" "node_group_AmazonEC2ContainerRegistryReadOnly" {
  count = var.create_node_groups ? 1 : 0

  policy_arn = "arn:${data.aws_partition.current.partition}:iam::aws:policy/AmazonEC2ContainerRegistryReadOnly"
  role       = aws_iam_role.node_group[0].name
}

# Additional node group policies
resource "aws_iam_role_policy_attachment" "node_group_additional" {
  count = var.create_node_groups ? length(var.node_group_additional_policies) : 0

  policy_arn = var.node_group_additional_policies[count.index]
  role       = aws_iam_role.node_group[0].name
}

# EKS Node Group Security Group
resource "aws_security_group" "node_group" {
  count = var.create_node_groups && var.create_node_group_security_group ? 1 : 0

  name_prefix = "${var.cluster_name}-node-group-"
  vpc_id      = var.vpc_id
  description = "EKS node group security group"

  # Allow all traffic from cluster security group
  ingress {
    from_port                = 0
    to_port                  = 65535
    protocol                 = "tcp"
    source_security_group_id = var.create_cluster_security_group ? aws_security_group.cluster[0].id : var.cluster_security_group_ids[0]
    description              = "Allow all traffic from cluster security group"
  }

  # Allow nodes to communicate with each other
  ingress {
    from_port = 0
    to_port   = 65535
    protocol  = "tcp"
    self      = true
    description = "Allow nodes to communicate with each other"
  }

  # Allow pods to communicate with the cluster API Server
  ingress {
    from_port                = 1025
    to_port                  = 65535
    protocol                 = "tcp"
    source_security_group_id = var.create_cluster_security_group ? aws_security_group.cluster[0].id : var.cluster_security_group_ids[0]
    description              = "Allow pods to communicate with the cluster API Server"
  }

  egress {
    from_port   = 0
    to_port     = 0
    protocol    = "-1"
    cidr_blocks = ["0.0.0.0/0"]
    description = "All outbound traffic"
  }

  tags = merge(var.tags, {
    Name = "${var.cluster_name}-node-group-sg"
    Type = "Security Group"
  })
}

# EKS Managed Node Groups
resource "aws_eks_node_group" "main" {
  for_each = var.create_node_groups ? var.node_groups : {}

  cluster_name    = aws_eks_cluster.main.name
  node_group_name = each.key
  node_role_arn   = aws_iam_role.node_group[0].arn
  subnet_ids      = each.value.subnet_ids != null ? each.value.subnet_ids : var.node_group_subnet_ids

  capacity_type  = each.value.capacity_type
  instance_types = each.value.instance_types
  ami_type       = each.value.ami_type
  disk_size      = each.value.disk_size

  scaling_config {
    desired_size = each.value.desired_size
    max_size     = each.value.max_size
    min_size     = each.value.min_size
  }

  update_config {
    max_unavailable_percentage = each.value.max_unavailable_percentage
  }

  dynamic "remote_access" {
    for_each = each.value.key_name != null ? [1] : []
    content {
      ec2_ssh_key               = each.value.key_name
      source_security_group_ids = each.value.source_security_group_ids
    }
  }

  dynamic "launch_template" {
    for_each = each.value.launch_template != null ? [each.value.launch_template] : []
    content {
      id      = launch_template.value.id
      version = launch_template.value.version
    }
  }

  labels = each.value.labels
  taints = each.value.taints

  depends_on = [
    aws_iam_role_policy_attachment.node_group_AmazonEKSWorkerNodePolicy,
    aws_iam_role_policy_attachment.node_group_AmazonEKS_CNI_Policy,
    aws_iam_role_policy_attachment.node_group_AmazonEC2ContainerRegistryReadOnly,
  ]

  tags = merge(var.tags, each.value.tags, {
    Name = "${var.cluster_name}-${each.key}"
    Type = "EKS Node Group"
  })
}

# EKS Add-ons
resource "aws_eks_addon" "main" {
  for_each = var.cluster_addons

  cluster_name             = aws_eks_cluster.main.name
  addon_name               = each.key
  addon_version            = each.value.addon_version
  resolve_conflicts        = each.value.resolve_conflicts
  service_account_role_arn = each.value.service_account_role_arn

  tags = merge(var.tags, {
    Name = "${var.cluster_name}-${each.key}"
    Type = "EKS Add-on"
  })

  depends_on = [aws_eks_node_group.main]
}
