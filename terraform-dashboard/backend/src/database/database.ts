import sqlite3 from 'sqlite3';
import { promisify } from 'util';
import path from 'path';

const DB_PATH = process.env.DATABASE_PATH || path.join(__dirname, '../../data/terraform-dashboard.db');

class Database {
  private db: sqlite3.Database;

  constructor() {
    this.db = new sqlite3.Database(DB_PATH);
  }

  async run(sql: string, params: any[] = []): Promise<sqlite3.RunResult> {
    return new Promise((resolve, reject) => {
      this.db.run(sql, params, function(err) {
        if (err) reject(err);
        else resolve(this);
      });
    });
  }

  async get(sql: string, params: any[] = []): Promise<any> {
    return new Promise((resolve, reject) => {
      this.db.get(sql, params, (err, row) => {
        if (err) reject(err);
        else resolve(row);
      });
    });
  }

  async all(sql: string, params: any[] = []): Promise<any[]> {
    return new Promise((resolve, reject) => {
      this.db.all(sql, params, (err, rows) => {
        if (err) reject(err);
        else resolve(rows);
      });
    });
  }

  close(): void {
    this.db.close();
  }
}

export const db = new Database();

export async function initializeDatabase(): Promise<void> {
  try {
    // Create tables
    await createTables();
    await seedInitialData();
    console.log('Database initialized successfully');
  } catch (error) {
    console.error('Database initialization failed:', error);
    throw error;
  }
}

async function createTables(): Promise<void> {
  // Templates table
  await db.run(`
    CREATE TABLE IF NOT EXISTS templates (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      description TEXT,
      category TEXT,
      terraform_code TEXT NOT NULL,
      variables TEXT, -- JSON string
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      usage_count INTEGER DEFAULT 0
    )
  `);

  // Add indexes for templates table
  await db.run(`CREATE INDEX IF NOT EXISTS idx_templates_category ON templates(category)`);
  await db.run(`CREATE INDEX IF NOT EXISTS idx_templates_name ON templates(name)`);
  await db.run(`CREATE INDEX IF NOT EXISTS idx_templates_usage_count ON templates(usage_count)`);
  await db.run(`CREATE INDEX IF NOT EXISTS idx_templates_created_at ON templates(created_at)`);

  // Deployments table (enhanced with user tracking)
  await db.run(`
    CREATE TABLE IF NOT EXISTS deployments (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      template_id TEXT,
      user_id TEXT,
      status TEXT NOT NULL,
      environment TEXT,
      variables TEXT, -- JSON string
      terraform_state TEXT,
      logs TEXT,
      workspace_path TEXT,
      last_action TEXT,
      last_action_by TEXT,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (template_id) REFERENCES templates (id),
      FOREIGN KEY (user_id) REFERENCES users (id),
      FOREIGN KEY (last_action_by) REFERENCES users (id)
    )
  `);

  // Add indexes for deployments table
  await db.run(`CREATE INDEX IF NOT EXISTS idx_deployments_status ON deployments(status)`);
  await db.run(`CREATE INDEX IF NOT EXISTS idx_deployments_environment ON deployments(environment)`);
  await db.run(`CREATE INDEX IF NOT EXISTS idx_deployments_template_id ON deployments(template_id)`);
  await db.run(`CREATE INDEX IF NOT EXISTS idx_deployments_user_id ON deployments(user_id)`);
  await db.run(`CREATE INDEX IF NOT EXISTS idx_deployments_created_at ON deployments(created_at)`);
  await db.run(`CREATE INDEX IF NOT EXISTS idx_deployments_name ON deployments(name)`);

  // Instances table (cached from AWS)
  await db.run(`
    CREATE TABLE IF NOT EXISTS instances (
      id TEXT PRIMARY KEY,
      name TEXT,
      type TEXT,
      state TEXT,
      public_ip TEXT,
      private_ip TEXT,
      availability_zone TEXT,
      launch_time DATETIME,
      environment TEXT,
      deployment_id TEXT,
      last_updated DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (deployment_id) REFERENCES deployments (id)
    )
  `);

  // Scheduled actions table
  await db.run(`
    CREATE TABLE IF NOT EXISTS scheduled_actions (
      id TEXT PRIMARY KEY,
      instance_id TEXT NOT NULL,
      action TEXT NOT NULL,
      scheduled_time DATETIME NOT NULL,
      recurring BOOLEAN DEFAULT FALSE,
      enabled BOOLEAN DEFAULT TRUE,
      last_executed DATETIME,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (instance_id) REFERENCES instances (id)
    )
  `);

  // Settings table
  await db.run(`
    CREATE TABLE IF NOT EXISTS settings (
      key TEXT PRIMARY KEY,
      value TEXT NOT NULL,
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
    )
  `);

  // Audit log table (enhanced)
  await db.run(`
    CREATE TABLE IF NOT EXISTS audit_log (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id TEXT,
      action TEXT NOT NULL,
      resource_type TEXT,
      resource_id TEXT,
      details TEXT, -- JSON string
      ip_address TEXT,
      user_agent TEXT,
      success BOOLEAN DEFAULT TRUE,
      error_message TEXT,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (user_id) REFERENCES users (id)
    )
  `);

  // Add indexes for audit_log table
  await db.run(`CREATE INDEX IF NOT EXISTS idx_audit_log_user_id ON audit_log(user_id)`);
  await db.run(`CREATE INDEX IF NOT EXISTS idx_audit_log_action ON audit_log(action)`);
  await db.run(`CREATE INDEX IF NOT EXISTS idx_audit_log_resource ON audit_log(resource_type, resource_id)`);
  await db.run(`CREATE INDEX IF NOT EXISTS idx_audit_log_created_at ON audit_log(created_at)`);

  // Users table (enhanced for authentication)
  await db.run(`
    CREATE TABLE IF NOT EXISTS users (
      id TEXT PRIMARY KEY,
      username TEXT UNIQUE NOT NULL,
      email TEXT UNIQUE NOT NULL,
      password_hash TEXT NOT NULL,
      role_id TEXT NOT NULL DEFAULT 'viewer',
      first_name TEXT,
      last_name TEXT,
      avatar_url TEXT,
      is_active BOOLEAN DEFAULT TRUE,
      email_verified BOOLEAN DEFAULT FALSE,
      last_login DATETIME,
      login_count INTEGER DEFAULT 0,
      password_reset_token TEXT,
      password_reset_expires DATETIME,
      email_verification_token TEXT,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (role_id) REFERENCES roles (id)
    )
  `);

  // Roles table
  await db.run(`
    CREATE TABLE IF NOT EXISTS roles (
      id TEXT PRIMARY KEY,
      name TEXT UNIQUE NOT NULL,
      description TEXT,
      permissions TEXT, -- JSON string of permissions array
      is_system_role BOOLEAN DEFAULT FALSE,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
    )
  `);

  // User tokens table (for GitHub tokens and other integrations)
  await db.run(`
    CREATE TABLE IF NOT EXISTS user_tokens (
      id TEXT PRIMARY KEY,
      user_id TEXT NOT NULL,
      token_type TEXT NOT NULL, -- 'github', 'aws', 'azure', etc.
      token_name TEXT, -- User-friendly name for the token
      encrypted_token TEXT NOT NULL,
      token_metadata TEXT, -- JSON string for additional token info
      expires_at DATETIME,
      last_used DATETIME,
      is_active BOOLEAN DEFAULT TRUE,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (user_id) REFERENCES users (id) ON DELETE CASCADE
    )
  `);

  // User sessions table (for JWT session management)
  await db.run(`
    CREATE TABLE IF NOT EXISTS user_sessions (
      id TEXT PRIMARY KEY,
      user_id TEXT NOT NULL,
      session_token TEXT UNIQUE NOT NULL,
      refresh_token TEXT UNIQUE,
      ip_address TEXT,
      user_agent TEXT,
      expires_at DATETIME NOT NULL,
      is_active BOOLEAN DEFAULT TRUE,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      last_activity DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (user_id) REFERENCES users (id) ON DELETE CASCADE
    )
  `);

  // Add indexes for users table
  await db.run(`CREATE INDEX IF NOT EXISTS idx_users_username ON users(username)`);
  await db.run(`CREATE INDEX IF NOT EXISTS idx_users_email ON users(email)`);
  await db.run(`CREATE INDEX IF NOT EXISTS idx_users_role_id ON users(role_id)`);
  await db.run(`CREATE INDEX IF NOT EXISTS idx_users_is_active ON users(is_active)`);
  await db.run(`CREATE INDEX IF NOT EXISTS idx_users_created_at ON users(created_at)`);

  // Add indexes for user_tokens table
  await db.run(`CREATE INDEX IF NOT EXISTS idx_user_tokens_user_id ON user_tokens(user_id)`);
  await db.run(`CREATE INDEX IF NOT EXISTS idx_user_tokens_type ON user_tokens(token_type)`);
  await db.run(`CREATE INDEX IF NOT EXISTS idx_user_tokens_active ON user_tokens(is_active)`);

  // Add indexes for user_sessions table
  await db.run(`CREATE INDEX IF NOT EXISTS idx_user_sessions_user_id ON user_sessions(user_id)`);
  await db.run(`CREATE INDEX IF NOT EXISTS idx_user_sessions_token ON user_sessions(session_token)`);
  await db.run(`CREATE INDEX IF NOT EXISTS idx_user_sessions_active ON user_sessions(is_active)`);
  await db.run(`CREATE INDEX IF NOT EXISTS idx_user_sessions_expires ON user_sessions(expires_at)`);
}

async function seedInitialData(): Promise<void> {
  // Check if templates already exist
  const existingTemplates = await db.get('SELECT COUNT(*) as count FROM templates');
  
  if (existingTemplates.count === 0) {
    // Seed default templates
    const defaultTemplates = [
      {
        id: 'ec2-instance',
        name: 'EC2 Instance',
        description: 'Deploy a single EC2 instance with security group',
        category: 'Compute',
        terraform_code: `resource "aws_instance" "main" {
  ami           = data.aws_ami.latest.id
  instance_type = var.instance_type
  key_name      = var.key_pair_name
  subnet_id     = var.subnet_id
  
  vpc_security_group_ids = [aws_security_group.main.id]
  
  root_block_device {
    volume_size = var.root_volume_size
    volume_type = var.root_volume_type
    encrypted   = var.root_volume_encrypted
  }
  
  tags = {
    Name        = var.name
    Environment = var.environment
  }
}

resource "aws_security_group" "main" {
  name_prefix = "\${var.name}-"
  vpc_id      = var.vpc_id
  
  ingress {
    from_port   = 22
    to_port     = 22
    protocol    = "tcp"
    cidr_blocks = var.allowed_cidr_blocks
  }
  
  egress {
    from_port   = 0
    to_port     = 0
    protocol    = "-1"
    cidr_blocks = ["0.0.0.0/0"]
  }
  
  tags = {
    Name = "\${var.name}-sg"
  }
}

data "aws_ami" "latest" {
  most_recent = true
  owners      = ["amazon"]
  
  filter {
    name   = "name"
    values = ["amzn2-ami-hvm-*-x86_64-gp2"]
  }
}`,
        variables: JSON.stringify([
          { name: 'name', type: 'string', description: 'Name for the EC2 instance', required: true },
          { name: 'instance_type', type: 'string', description: 'EC2 instance type', required: true, default: 't3.micro', options: ['t3.nano', 't3.micro', 't3.small', 't3.medium', 't3.large'] },
          { name: 'vpc_id', type: 'string', description: 'VPC ID', required: true },
          { name: 'subnet_id', type: 'string', description: 'Subnet ID', required: true },
          { name: 'key_pair_name', type: 'string', description: 'EC2 Key Pair name', required: true },
          { name: 'environment', type: 'string', description: 'Environment', required: true, options: ['dev', 'staging', 'prod'] },
          { name: 'root_volume_size', type: 'number', description: 'Root volume size in GB', required: false, default: 20 },
          { name: 'root_volume_type', type: 'string', description: 'Root volume type', required: false, default: 'gp3' },
          { name: 'root_volume_encrypted', type: 'boolean', description: 'Encrypt root volume', required: false, default: true },
          { name: 'allowed_cidr_blocks', type: 'list', description: 'Allowed CIDR blocks for SSH', required: false, default: ['10.0.0.0/8'] }
        ])
      },
      {
        id: 'vpc-subnets',
        name: 'VPC with Subnets',
        description: 'Create a VPC with public and private subnets',
        category: 'Network',
        terraform_code: `resource "aws_vpc" "main" {
  cidr_block           = var.cidr_block
  enable_dns_hostnames = true
  enable_dns_support   = true
  
  tags = {
    Name = var.vpc_name
  }
}

resource "aws_subnet" "public" {
  count = length(var.availability_zones)
  
  vpc_id            = aws_vpc.main.id
  cidr_block        = cidrsubnet(var.cidr_block, 8, count.index)
  availability_zone = var.availability_zones[count.index]
  
  map_public_ip_on_launch = true
  
  tags = {
    Name = "\${var.vpc_name}-public-\${count.index + 1}"
    Type = "public"
  }
}

resource "aws_subnet" "private" {
  count = length(var.availability_zones)
  
  vpc_id            = aws_vpc.main.id
  cidr_block        = cidrsubnet(var.cidr_block, 8, count.index + 10)
  availability_zone = var.availability_zones[count.index]
  
  tags = {
    Name = "\${var.vpc_name}-private-\${count.index + 1}"
    Type = "private"
  }
}

resource "aws_internet_gateway" "main" {
  vpc_id = aws_vpc.main.id
  
  tags = {
    Name = "\${var.vpc_name}-igw"
  }
}`,
        variables: JSON.stringify([
          { name: 'vpc_name', type: 'string', description: 'Name for the VPC', required: true },
          { name: 'cidr_block', type: 'string', description: 'CIDR block for the VPC', required: true, default: '10.0.0.0/16' },
          { name: 'availability_zones', type: 'list', description: 'List of availability zones', required: true, default: ['us-east-1a', 'us-east-1b'] }
        ])
      },
      {
        id: 's3-bucket',
        name: 'S3 Bucket',
        description: 'Create an S3 bucket with encryption and versioning',
        category: 'Storage',
        terraform_code: `resource "aws_s3_bucket" "main" {
  bucket = var.bucket_name

  tags = {
    Name        = var.bucket_name
    Environment = var.environment
  }
}

resource "aws_s3_bucket_versioning" "main" {
  bucket = aws_s3_bucket.main.id
  versioning_configuration {
    status = var.versioning_enabled ? "Enabled" : "Disabled"
  }
}

resource "aws_s3_bucket_server_side_encryption_configuration" "main" {
  bucket = aws_s3_bucket.main.id

  rule {
    apply_server_side_encryption_by_default {
      sse_algorithm = var.encryption_algorithm
    }
    bucket_key_enabled = var.bucket_key_enabled
  }
}

resource "aws_s3_bucket_public_access_block" "main" {
  bucket = aws_s3_bucket.main.id

  block_public_acls       = var.block_public_access
  block_public_policy     = var.block_public_access
  ignore_public_acls      = var.block_public_access
  restrict_public_buckets = var.block_public_access
}

resource "aws_s3_bucket_lifecycle_configuration" "main" {
  count  = var.enable_lifecycle ? 1 : 0
  bucket = aws_s3_bucket.main.id

  rule {
    id     = "lifecycle_rule"
    status = "Enabled"

    expiration {
      days = var.lifecycle_expiration_days
    }

    noncurrent_version_expiration {
      noncurrent_days = var.lifecycle_noncurrent_expiration_days
    }
  }
}`,
        variables: JSON.stringify([
          { name: 'bucket_name', type: 'string', description: 'S3 bucket name (must be globally unique)', required: true },
          { name: 'versioning_enabled', type: 'boolean', description: 'Enable S3 bucket versioning', required: false, default: true },
          { name: 'encryption_algorithm', type: 'string', description: 'Server-side encryption algorithm', required: false, default: 'AES256', options: ['AES256', 'aws:kms'] },
          { name: 'bucket_key_enabled', type: 'boolean', description: 'Enable S3 bucket key for KMS encryption', required: false, default: true },
          { name: 'block_public_access', type: 'boolean', description: 'Block all public access to the bucket', required: false, default: true },
          { name: 'enable_lifecycle', type: 'boolean', description: 'Enable lifecycle management', required: false, default: false },
          { name: 'lifecycle_expiration_days', type: 'number', description: 'Days after which objects expire', required: false, default: 365 },
          { name: 'lifecycle_noncurrent_expiration_days', type: 'number', description: 'Days after which non-current versions expire', required: false, default: 30 }
        ])
      },
      {
        id: 'rds-mysql',
        name: 'RDS MySQL Database',
        description: 'Create an RDS MySQL database instance with security group',
        category: 'Database',
        terraform_code: `resource "aws_db_subnet_group" "main" {
  name       = "\${var.db_identifier}-subnet-group"
  subnet_ids = var.subnet_ids

  tags = {
    Name        = "\${var.db_identifier}-subnet-group"
    Environment = var.environment
  }
}

resource "aws_security_group" "rds" {
  name_prefix = "\${var.db_identifier}-rds-"
  vpc_id      = var.vpc_id

  ingress {
    from_port   = 3306
    to_port     = 3306
    protocol    = "tcp"
    cidr_blocks = var.allowed_cidr_blocks
  }

  egress {
    from_port   = 0
    to_port     = 0
    protocol    = "-1"
    cidr_blocks = ["0.0.0.0/0"]
  }

  tags = {
    Name        = "\${var.db_identifier}-rds-sg"
    Environment = var.environment
  }
}

resource "aws_db_instance" "main" {
  identifier = var.db_identifier

  engine         = "mysql"
  engine_version = var.engine_version
  instance_class = var.instance_class

  allocated_storage     = var.allocated_storage
  max_allocated_storage = var.max_allocated_storage
  storage_type          = var.storage_type
  storage_encrypted     = var.storage_encrypted

  db_name  = var.database_name
  username = var.master_username
  password = var.master_password

  vpc_security_group_ids = [aws_security_group.rds.id]
  db_subnet_group_name   = aws_db_subnet_group.main.name

  backup_retention_period = var.backup_retention_period
  backup_window          = var.backup_window
  maintenance_window     = var.maintenance_window

  skip_final_snapshot = var.skip_final_snapshot
  deletion_protection = var.deletion_protection

  multi_az               = var.multi_az
  publicly_accessible    = var.publicly_accessible
  auto_minor_version_upgrade = var.auto_minor_version_upgrade

  tags = {
    Name        = var.db_identifier
    Environment = var.environment
  }
}`,
        variables: JSON.stringify([
          { name: 'db_identifier', type: 'string', description: 'Database identifier', required: true },
          { name: 'vpc_id', type: 'string', description: 'VPC ID where RDS will be created', required: true },
          { name: 'subnet_ids', type: 'list', description: 'List of subnet IDs for DB subnet group', required: true },
          { name: 'engine_version', type: 'string', description: 'MySQL engine version', required: false, default: '8.0', options: ['8.0', '5.7'] },
          { name: 'instance_class', type: 'string', description: 'RDS instance class', required: false, default: 'db.t3.micro', options: ['db.t3.micro', 'db.t3.small', 'db.t3.medium', 'db.t3.large'] },
          { name: 'allocated_storage', type: 'number', description: 'Initial allocated storage in GB', required: false, default: 20 },
          { name: 'max_allocated_storage', type: 'number', description: 'Maximum allocated storage in GB', required: false, default: 100 },
          { name: 'storage_type', type: 'string', description: 'Storage type', required: false, default: 'gp2', options: ['gp2', 'gp3', 'io1'] },
          { name: 'storage_encrypted', type: 'boolean', description: 'Enable storage encryption', required: false, default: true },
          { name: 'database_name', type: 'string', description: 'Initial database name', required: true },
          { name: 'master_username', type: 'string', description: 'Master username', required: false, default: 'admin' },
          { name: 'master_password', type: 'string', description: 'Master password', required: true },
          { name: 'allowed_cidr_blocks', type: 'list', description: 'CIDR blocks allowed to access the database', required: false, default: ['10.0.0.0/8'] },
          { name: 'backup_retention_period', type: 'number', description: 'Backup retention period in days', required: false, default: 7 },
          { name: 'backup_window', type: 'string', description: 'Backup window', required: false, default: '03:00-04:00' },
          { name: 'maintenance_window', type: 'string', description: 'Maintenance window', required: false, default: 'sun:04:00-sun:05:00' },
          { name: 'skip_final_snapshot', type: 'boolean', description: 'Skip final snapshot when deleting', required: false, default: true },
          { name: 'deletion_protection', type: 'boolean', description: 'Enable deletion protection', required: false, default: false },
          { name: 'multi_az', type: 'boolean', description: 'Enable Multi-AZ deployment', required: false, default: false },
          { name: 'publicly_accessible', type: 'boolean', description: 'Make database publicly accessible', required: false, default: false },
          { name: 'auto_minor_version_upgrade', type: 'boolean', description: 'Enable automatic minor version upgrades', required: false, default: true }
        ])
      },
      {
        id: 'eks-cluster',
        name: 'EKS Cluster',
        description: 'Create an EKS cluster with managed node group',
        category: 'Container',
        terraform_code: `# Data sources
data "aws_availability_zones" "available" {
  state = "available"
}

# EKS Cluster IAM Role
resource "aws_iam_role" "eks_cluster_role" {
  name = "\${var.cluster_name}-cluster-role"

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

  tags = {
    Name        = "\${var.cluster_name}-cluster-role"
    Environment = var.environment
  }
}

resource "aws_iam_role_policy_attachment" "eks_cluster_policy" {
  policy_arn = "arn:aws:iam::aws:policy/AmazonEKSClusterPolicy"
  role       = aws_iam_role.eks_cluster_role.name
}

# EKS Node Group IAM Role
resource "aws_iam_role" "eks_node_role" {
  name = "\${var.cluster_name}-node-role"

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

  tags = {
    Name        = "\${var.cluster_name}-node-role"
    Environment = var.environment
  }
}

resource "aws_iam_role_policy_attachment" "eks_worker_node_policy" {
  policy_arn = "arn:aws:iam::aws:policy/AmazonEKSWorkerNodePolicy"
  role       = aws_iam_role.eks_node_role.name
}

resource "aws_iam_role_policy_attachment" "eks_cni_policy" {
  policy_arn = "arn:aws:iam::aws:policy/AmazonEKS_CNI_Policy"
  role       = aws_iam_role.eks_node_role.name
}

resource "aws_iam_role_policy_attachment" "eks_container_registry_policy" {
  policy_arn = "arn:aws:iam::aws:policy/AmazonEC2ContainerRegistryReadOnly"
  role       = aws_iam_role.eks_node_role.name
}

# EKS Cluster
resource "aws_eks_cluster" "main" {
  name     = var.cluster_name
  role_arn = aws_iam_role.eks_cluster_role.arn
  version  = var.kubernetes_version

  vpc_config {
    subnet_ids              = var.subnet_ids
    endpoint_private_access = var.endpoint_private_access
    endpoint_public_access  = var.endpoint_public_access
    public_access_cidrs     = var.public_access_cidrs
  }

  enabled_cluster_log_types = var.cluster_log_types

  tags = {
    Name        = var.cluster_name
    Environment = var.environment
  }

  depends_on = [
    aws_iam_role_policy_attachment.eks_cluster_policy
  ]
}

# EKS Node Group
resource "aws_eks_node_group" "main" {
  cluster_name    = aws_eks_cluster.main.name
  node_group_name = "\${var.cluster_name}-nodes"
  node_role_arn   = aws_iam_role.eks_node_role.arn
  subnet_ids      = var.private_subnet_ids

  instance_types = var.node_instance_types
  capacity_type  = var.capacity_type
  disk_size      = var.node_disk_size

  scaling_config {
    desired_size = var.desired_capacity
    max_size     = var.max_capacity
    min_size     = var.min_capacity
  }

  update_config {
    max_unavailable = var.max_unavailable
  }

  tags = {
    Name        = "\${var.cluster_name}-nodes"
    Environment = var.environment
  }

  depends_on = [
    aws_iam_role_policy_attachment.eks_worker_node_policy,
    aws_iam_role_policy_attachment.eks_cni_policy,
    aws_iam_role_policy_attachment.eks_container_registry_policy,
  ]
}`,
        variables: JSON.stringify([
          { name: 'cluster_name', type: 'string', description: 'EKS cluster name', required: true },
          { name: 'kubernetes_version', type: 'string', description: 'Kubernetes version', required: false, default: '1.28', options: ['1.28', '1.27', '1.26'] },
          { name: 'subnet_ids', type: 'list', description: 'List of subnet IDs for the EKS cluster', required: true },
          { name: 'private_subnet_ids', type: 'list', description: 'List of private subnet IDs for worker nodes', required: true },
          { name: 'endpoint_private_access', type: 'boolean', description: 'Enable private API server endpoint', required: false, default: true },
          { name: 'endpoint_public_access', type: 'boolean', description: 'Enable public API server endpoint', required: false, default: true },
          { name: 'public_access_cidrs', type: 'list', description: 'CIDR blocks that can access the public API server endpoint', required: false, default: ['0.0.0.0/0'] },
          { name: 'cluster_log_types', type: 'list', description: 'List of control plane logging to enable', required: false, default: ['api', 'audit'] },
          { name: 'node_instance_types', type: 'list', description: 'Instance types for EKS node group', required: false, default: ['t3.medium'] },
          { name: 'capacity_type', type: 'string', description: 'Type of capacity associated with the EKS Node Group', required: false, default: 'ON_DEMAND', options: ['ON_DEMAND', 'SPOT'] },
          { name: 'node_disk_size', type: 'number', description: 'Disk size in GiB for worker nodes', required: false, default: 20 },
          { name: 'desired_capacity', type: 'number', description: 'Desired number of worker nodes', required: false, default: 2 },
          { name: 'max_capacity', type: 'number', description: 'Maximum number of worker nodes', required: false, default: 4 },
          { name: 'min_capacity', type: 'number', description: 'Minimum number of worker nodes', required: false, default: 1 },
          { name: 'max_unavailable', type: 'number', description: 'Maximum number of nodes unavailable during update', required: false, default: 1 }
        ])
      }
    ];

    for (const template of defaultTemplates) {
      await db.run(
        'INSERT INTO templates (id, name, description, category, terraform_code, variables) VALUES (?, ?, ?, ?, ?, ?)',
        [template.id, template.name, template.description, template.category, template.terraform_code, template.variables]
      );
    }
  }

  // Seed default settings
  const defaultSettings = [
    { key: 'aws_region', value: 'us-east-1' },
    { key: 'aws_profile', value: 'default' },
    { key: 'terraform_path', value: '/usr/local/bin/terraform' },
    { key: 'terragrunt_path', value: '/usr/local/bin/terragrunt' },
    { key: 'working_directory', value: './terraform-workspace' },
    { key: 'auto_approve', value: 'false' },
    { key: 'parallelism', value: '10' },
    { key: 'email_notifications', value: 'false' },
    { key: 'slack_notifications', value: 'false' },
    { key: 'require_approval', value: 'true' },
    { key: 'session_timeout', value: '60' },
    { key: 'enable_audit_log', value: 'true' }
  ];

  for (const setting of defaultSettings) {
    const existing = await db.get('SELECT key FROM settings WHERE key = ?', [setting.key]);
    if (!existing) {
      await db.run('INSERT INTO settings (key, value) VALUES (?, ?)', [setting.key, setting.value]);
    }
  }

  // Seed default roles
  const defaultRoles = [
    {
      id: 'admin',
      name: 'Administrator',
      description: 'Full access to all features and settings',
      permissions: JSON.stringify([
        'users:read', 'users:write', 'users:delete',
        'roles:read', 'roles:write', 'roles:delete',
        'templates:read', 'templates:write', 'templates:delete',
        'deployments:read', 'deployments:write', 'deployments:delete', 'deployments:execute',
        'instances:read', 'instances:write', 'instances:start', 'instances:stop', 'instances:terminate',
        'settings:read', 'settings:write',
        'audit:read',
        'github:read', 'github:write',
        'aws:read', 'aws:write'
      ]),
      is_system_role: true
    },
    {
      id: 'developer',
      name: 'Developer',
      description: 'Can create and manage deployments, view instances',
      permissions: JSON.stringify([
        'templates:read', 'templates:write',
        'deployments:read', 'deployments:write', 'deployments:execute',
        'instances:read', 'instances:start', 'instances:stop',
        'github:read', 'github:write',
        'aws:read'
      ]),
      is_system_role: true
    },
    {
      id: 'viewer',
      name: 'Viewer',
      description: 'Read-only access to templates, deployments, and instances',
      permissions: JSON.stringify([
        'templates:read',
        'deployments:read',
        'instances:read'
      ]),
      is_system_role: true
    }
  ];

  for (const role of defaultRoles) {
    const existing = await db.get('SELECT id FROM roles WHERE id = ?', [role.id]);
    if (!existing) {
      await db.run(
        'INSERT INTO roles (id, name, description, permissions, is_system_role) VALUES (?, ?, ?, ?, ?)',
        [role.id, role.name, role.description, role.permissions, role.is_system_role]
      );
    }
  }

  // Create default admin user if no users exist
  const existingUsers = await db.get('SELECT COUNT(*) as count FROM users');
  if (existingUsers.count === 0) {
    const bcrypt = require('bcrypt');
    const defaultAdminPassword = 'admin123'; // Should be changed on first login
    const hashedPassword = await bcrypt.hash(defaultAdminPassword, 10);

    await db.run(
      `INSERT INTO users (id, username, email, password_hash, role_id, first_name, last_name, is_active, email_verified)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        'admin-user-001',
        'admin',
        'admin@terraform-dashboard.local',
        hashedPassword,
        'admin',
        'System',
        'Administrator',
        true,
        true
      ]
    );

    console.log('🔐 Default admin user created:');
    console.log('   Username: admin');
    console.log('   Password: admin123');
    console.log('   ⚠️  Please change the password after first login!');
  }
}
