const sqlite3 = require('sqlite3').verbose();

// Open database
const db = new sqlite3.Database('./database.sqlite');

// Additional template data
const additionalTemplates = [
  {
    id: 'rds-database',
    name: 'RDS Database',
    description: 'Deploy a comprehensive Amazon RDS database instance with security groups, parameter groups, and backup configurations',
    category: 'Database',
    terraform_code: `# Data sources for availability zones
data "aws_availability_zones" "available" {
  state = "available"
}

# Security Group for RDS
resource "aws_security_group" "rds" {
  name        = "\${var.identifier}-rds-sg"
  description = "Security group for \${var.identifier} RDS instance"
  
  ingress {
    description = "Database access"
    from_port   = 3306
    to_port     = 3306
    protocol    = "tcp"
    cidr_blocks = ["10.0.0.0/16"]
  }
  
  egress {
    description = "All outbound traffic"
    from_port   = 0
    to_port     = 0
    protocol    = "-1"
    cidr_blocks = ["0.0.0.0/0"]
  }
  
  tags = {
    Name        = "\${var.identifier}-rds-sg"
    Environment = var.environment
  }
}

# DB Subnet Group
resource "aws_db_subnet_group" "main" {
  name       = "\${var.identifier}-subnet-group"
  subnet_ids = var.subnet_ids
  
  tags = {
    Name        = "\${var.identifier}-subnet-group"
    Environment = var.environment
  }
}

# RDS Instance
resource "aws_db_instance" "main" {
  identifier     = var.identifier
  engine         = var.engine
  engine_version = var.engine_version
  instance_class = var.instance_class
  
  allocated_storage     = var.allocated_storage
  max_allocated_storage = var.max_allocated_storage
  storage_type          = var.storage_type
  storage_encrypted     = var.storage_encrypted
  
  db_name  = var.db_name
  username = var.username
  manage_master_user_password = var.manage_master_user_password
  
  vpc_security_group_ids = [aws_security_group.rds.id]
  db_subnet_group_name   = aws_db_subnet_group.main.name
  
  backup_retention_period = var.backup_retention_period
  backup_window          = var.backup_window
  maintenance_window     = var.maintenance_window
  
  skip_final_snapshot = var.skip_final_snapshot
  deletion_protection = var.deletion_protection
  
  tags = {
    Name        = var.identifier
    Environment = var.environment
  }
}`,
    variables: JSON.stringify([
      { name: 'identifier', type: 'string', description: 'The name of the RDS instance', required: true },
      { name: 'engine', type: 'string', description: 'The database engine', required: false, default: 'mysql', options: ['mysql', 'postgres', 'mariadb', 'oracle-ee', 'oracle-se2', 'sqlserver-ex', 'sqlserver-web', 'sqlserver-se', 'sqlserver-ee'] },
      { name: 'engine_version', type: 'string', description: 'The engine version to use', required: false, default: '8.0' },
      { name: 'instance_class', type: 'string', description: 'The instance type of the RDS instance', required: false, default: 'db.t3.micro', options: ['db.t3.micro', 'db.t3.small', 'db.t3.medium', 'db.t3.large', 'db.m5.large', 'db.m5.xlarge', 'db.m5.2xlarge', 'db.r5.large', 'db.r5.xlarge'] },
      { name: 'allocated_storage', type: 'number', description: 'The allocated storage in gigabytes', required: false, default: 20 },
      { name: 'max_allocated_storage', type: 'number', description: 'The upper limit to which Amazon RDS can automatically scale the storage', required: false, default: 100 },
      { name: 'storage_type', type: 'string', description: 'One of standard (magnetic), gp2 (general purpose SSD), or io1 (provisioned IOPS SSD)', required: false, default: 'gp2', options: ['standard', 'gp2', 'gp3', 'io1', 'io2'] },
      { name: 'storage_encrypted', type: 'boolean', description: 'Specifies whether the DB instance is encrypted', required: false, default: true },
      { name: 'db_name', type: 'string', description: 'The name of the database to create when the DB instance is created', required: false, default: '' },
      { name: 'username', type: 'string', description: 'Username for the master DB user', required: true },
      { name: 'manage_master_user_password', type: 'boolean', description: 'Set to true to allow RDS to manage the master user password in Secrets Manager', required: false, default: true },
      { name: 'subnet_ids', type: 'list', description: 'List of subnet IDs for the DB subnet group', required: true },
      { name: 'backup_retention_period', type: 'number', description: 'The days to retain backups for', required: false, default: 7 },
      { name: 'backup_window', type: 'string', description: 'The daily time range during which automated backups are created', required: false, default: '03:00-04:00' },
      { name: 'maintenance_window', type: 'string', description: 'The window to perform maintenance in', required: false, default: 'sun:04:00-sun:05:00' },
      { name: 'skip_final_snapshot', type: 'boolean', description: 'Determines whether a final DB snapshot is created before the DB instance is deleted', required: false, default: true },
      { name: 'deletion_protection', type: 'boolean', description: 'If the DB instance should have deletion protection enabled', required: false, default: false },
      { name: 'environment', type: 'string', description: 'Environment name', required: false, default: 'dev', options: ['dev', 'staging', 'prod'] }
    ])
  },
  {
    id: 's3-bucket',
    name: 'S3 Bucket',
    description: 'Create an S3 bucket with encryption, versioning, and access controls',
    category: 'Storage',
    terraform_code: `# S3 Bucket
resource "aws_s3_bucket" "main" {
  bucket = var.bucket_name

  tags = {
    Name        = var.bucket_name
    Environment = var.environment
  }
}

# S3 Bucket Versioning
resource "aws_s3_bucket_versioning" "main" {
  bucket = aws_s3_bucket.main.id
  versioning_configuration {
    status = var.versioning_enabled ? "Enabled" : "Disabled"
  }
}

# S3 Bucket Server Side Encryption
resource "aws_s3_bucket_server_side_encryption_configuration" "main" {
  bucket = aws_s3_bucket.main.id

  rule {
    apply_server_side_encryption_by_default {
      sse_algorithm = var.encryption_algorithm
    }
    bucket_key_enabled = var.bucket_key_enabled
  }
}

# S3 Bucket Public Access Block
resource "aws_s3_bucket_public_access_block" "main" {
  bucket = aws_s3_bucket.main.id

  block_public_acls       = var.block_public_access
  block_public_policy     = var.block_public_access
  ignore_public_acls      = var.block_public_access
  restrict_public_buckets = var.block_public_access
}

# S3 Bucket Lifecycle Configuration
resource "aws_s3_bucket_lifecycle_configuration" "main" {
  count  = var.lifecycle_enabled ? 1 : 0
  bucket = aws_s3_bucket.main.id

  rule {
    id     = "lifecycle_rule"
    status = "Enabled"

    transition {
      days          = 30
      storage_class = "STANDARD_IA"
    }

    transition {
      days          = 90
      storage_class = "GLACIER"
    }

    expiration {
      days = 365
    }
  }
}`,
    variables: JSON.stringify([
      { name: 'bucket_name', type: 'string', description: 'S3 bucket name (must be globally unique)', required: true },
      { name: 'versioning_enabled', type: 'boolean', description: 'Enable S3 bucket versioning', required: false, default: true },
      { name: 'encryption_algorithm', type: 'string', description: 'Server-side encryption algorithm', required: false, default: 'AES256', options: ['AES256', 'aws:kms'] },
      { name: 'bucket_key_enabled', type: 'boolean', description: 'Whether to use S3 Bucket Keys for SSE-KMS', required: false, default: true },
      { name: 'block_public_access', type: 'boolean', description: 'Block all public access to the bucket', required: false, default: true },
      { name: 'lifecycle_enabled', type: 'boolean', description: 'Enable lifecycle management', required: false, default: false },
      { name: 'environment', type: 'string', description: 'Environment name', required: false, default: 'dev', options: ['dev', 'staging', 'prod'] }
    ])
  },
  {
    id: 'vpc-network',
    name: 'VPC Network',
    description: 'Create a VPC with public and private subnets, internet gateway, and NAT gateway',
    category: 'Network',
    terraform_code: `# Data source for availability zones
data "aws_availability_zones" "available" {
  state = "available"
}

# VPC
resource "aws_vpc" "main" {
  cidr_block           = var.vpc_cidr
  enable_dns_hostnames = true
  enable_dns_support   = true

  tags = {
    Name        = var.vpc_name
    Environment = var.environment
  }
}

# Internet Gateway
resource "aws_internet_gateway" "main" {
  vpc_id = aws_vpc.main.id

  tags = {
    Name        = "\${var.vpc_name}-igw"
    Environment = var.environment
  }
}

# Public Subnets
resource "aws_subnet" "public" {
  count = length(var.public_subnet_cidrs)

  vpc_id                  = aws_vpc.main.id
  cidr_block              = var.public_subnet_cidrs[count.index]
  availability_zone       = var.availability_zones[count.index]
  map_public_ip_on_launch = true

  tags = {
    Name        = "\${var.vpc_name}-public-\${var.availability_zones[count.index]}"
    Environment = var.environment
    Type        = "Public"
  }
}

# Private Subnets
resource "aws_subnet" "private" {
  count = length(var.private_subnet_cidrs)

  vpc_id            = aws_vpc.main.id
  cidr_block        = var.private_subnet_cidrs[count.index]
  availability_zone = var.availability_zones[count.index]

  tags = {
    Name        = "\${var.vpc_name}-private-\${var.availability_zones[count.index]}"
    Environment = var.environment
    Type        = "Private"
  }
}

# Elastic IPs for NAT Gateways
resource "aws_eip" "nat" {
  count = var.enable_nat_gateway ? length(var.public_subnet_cidrs) : 0

  domain = "vpc"
  depends_on = [aws_internet_gateway.main]

  tags = {
    Name        = "\${var.vpc_name}-eip-\${var.availability_zones[count.index]}"
    Environment = var.environment
  }
}

# NAT Gateways
resource "aws_nat_gateway" "main" {
  count = var.enable_nat_gateway ? length(var.public_subnet_cidrs) : 0

  allocation_id = aws_eip.nat[count.index].id
  subnet_id     = aws_subnet.public[count.index].id

  tags = {
    Name        = "\${var.vpc_name}-nat-\${var.availability_zones[count.index]}"
    Environment = var.environment
  }

  depends_on = [aws_internet_gateway.main]
}

# Route Table for Public Subnets
resource "aws_route_table" "public" {
  vpc_id = aws_vpc.main.id

  route {
    cidr_block = "0.0.0.0/0"
    gateway_id = aws_internet_gateway.main.id
  }

  tags = {
    Name        = "\${var.vpc_name}-public-rt"
    Environment = var.environment
  }
}

# Route Table Associations for Public Subnets
resource "aws_route_table_association" "public" {
  count = length(var.public_subnet_cidrs)

  subnet_id      = aws_subnet.public[count.index].id
  route_table_id = aws_route_table.public.id
}

# Route Tables for Private Subnets
resource "aws_route_table" "private" {
  count = var.enable_nat_gateway ? length(var.private_subnet_cidrs) : 1

  vpc_id = aws_vpc.main.id

  dynamic "route" {
    for_each = var.enable_nat_gateway ? [1] : []
    content {
      cidr_block     = "0.0.0.0/0"
      nat_gateway_id = aws_nat_gateway.main[count.index].id
    }
  }

  tags = {
    Name        = "\${var.vpc_name}-private-rt-\${count.index + 1}"
    Environment = var.environment
  }
}

# Route Table Associations for Private Subnets
resource "aws_route_table_association" "private" {
  count = length(var.private_subnet_cidrs)

  subnet_id      = aws_subnet.private[count.index].id
  route_table_id = var.enable_nat_gateway ? aws_route_table.private[count.index].id : aws_route_table.private[0].id
}`,
    variables: JSON.stringify([
      { name: 'vpc_name', type: 'string', description: 'Name of the VPC', required: true },
      { name: 'vpc_cidr', type: 'string', description: 'CIDR block for VPC', required: false, default: '10.0.0.0/16' },
      { name: 'availability_zones', type: 'list', description: 'List of availability zones', required: false, default: ['us-east-1a', 'us-east-1b'] },
      { name: 'public_subnet_cidrs', type: 'list', description: 'CIDR blocks for public subnets', required: false, default: ['10.0.1.0/24', '10.0.2.0/24'] },
      { name: 'private_subnet_cidrs', type: 'list', description: 'CIDR blocks for private subnets', required: false, default: ['10.0.10.0/24', '10.0.20.0/24'] },
      { name: 'enable_nat_gateway', type: 'boolean', description: 'Enable NAT Gateway for private subnets', required: false, default: true },
      { name: 'enable_vpn_gateway', type: 'boolean', description: 'Enable VPN Gateway', required: false, default: false },
      { name: 'environment', type: 'string', description: 'Environment name', required: false, default: 'dev', options: ['dev', 'staging', 'prod'] }
    ])
  }
];

// Function to add additional templates to database
function addAdditionalTemplates() {
  console.log('🚀 Adding additional templates to database...');
  
  const stmt = db.prepare(`
    INSERT INTO templates (id, name, description, category, terraform_code, variables)
    VALUES (?, ?, ?, ?, ?, ?)
  `);
  
  additionalTemplates.forEach((template, index) => {
    stmt.run([
      template.id,
      template.name,
      template.description,
      template.category,
      template.terraform_code,
      template.variables
    ], (err) => {
      if (err) {
        console.error(`Error adding template ${template.name}:`, err);
      } else {
        console.log(`✅ Added template: ${template.name}`);
      }
      
      if (index === additionalTemplates.length - 1) {
        stmt.finalize();
        console.log('🎉 All additional templates added successfully!');
        console.log(`📊 Added ${additionalTemplates.length} new templates`);
        
        // List all templates
        db.all('SELECT id, name, category FROM templates ORDER BY category, name', (err, rows) => {
          if (err) {
            console.error('Error listing templates:', err);
          } else {
            console.log('\n📋 All Available Templates:');
            rows.forEach(row => {
              console.log(`   ${row.category}: ${row.name} (${row.id})`);
            });
          }
          db.close();
        });
      }
    });
  });
}

// Run the script
addAdditionalTemplates();
