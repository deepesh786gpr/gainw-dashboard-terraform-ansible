const fetch = require('node-fetch');

const templates = [
  {
    name: "S3 Bucket",
    description: "Create an S3 bucket with encryption and versioning",
    category: "Storage",
    terraformCode: `resource "aws_s3_bucket" "main" {
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
}`,
    variables: [
      { name: "bucket_name", type: "string", description: "S3 bucket name (must be globally unique)", required: true },
      { name: "versioning_enabled", type: "boolean", description: "Enable S3 bucket versioning", required: false, default: true },
      { name: "encryption_algorithm", type: "string", description: "Server-side encryption algorithm", required: false, default: "AES256", options: ["AES256", "aws:kms"] },
      { name: "bucket_key_enabled", type: "boolean", description: "Enable S3 bucket key for KMS encryption", required: false, default: true },
      { name: "block_public_access", type: "boolean", description: "Block all public access to the bucket", required: false, default: true }
    ]
  },
  {
    name: "RDS MySQL Database",
    description: "Create an RDS MySQL database instance",
    category: "Database",
    terraformCode: `resource "aws_db_instance" "main" {
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
    variables: [
      { name: "db_identifier", type: "string", description: "Database identifier", required: true },
      { name: "engine_version", type: "string", description: "MySQL engine version", required: false, default: "8.0", options: ["8.0", "5.7"] },
      { name: "instance_class", type: "string", description: "RDS instance class", required: false, default: "db.t3.micro", options: ["db.t3.micro", "db.t3.small", "db.t3.medium", "db.t3.large"] },
      { name: "allocated_storage", type: "number", description: "Initial allocated storage in GB", required: false, default: 20 },
      { name: "max_allocated_storage", type: "number", description: "Maximum allocated storage in GB", required: false, default: 100 },
      { name: "storage_type", type: "string", description: "Storage type", required: false, default: "gp2", options: ["gp2", "gp3", "io1"] },
      { name: "storage_encrypted", type: "boolean", description: "Enable storage encryption", required: false, default: true },
      { name: "database_name", type: "string", description: "Initial database name", required: true },
      { name: "master_username", type: "string", description: "Master username", required: false, default: "admin" },
      { name: "master_password", type: "string", description: "Master password", required: true },
      { name: "backup_retention_period", type: "number", description: "Backup retention period in days", required: false, default: 7 },
      { name: "backup_window", type: "string", description: "Backup window", required: false, default: "03:00-04:00" },
      { name: "maintenance_window", type: "string", description: "Maintenance window", required: false, default: "sun:04:00-sun:05:00" },
      { name: "skip_final_snapshot", type: "boolean", description: "Skip final snapshot when deleting", required: false, default: true },
      { name: "deletion_protection", type: "boolean", description: "Enable deletion protection", required: false, default: false },
      { name: "multi_az", type: "boolean", description: "Enable Multi-AZ deployment", required: false, default: false },
      { name: "publicly_accessible", type: "boolean", description: "Make database publicly accessible", required: false, default: false },
      { name: "auto_minor_version_upgrade", type: "boolean", description: "Enable automatic minor version upgrades", required: false, default: true }
    ]
  }
];

async function addTemplates() {
  for (const template of templates) {
    try {
      const response = await fetch('http://localhost:5000/api/templates', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(template),
      });

      if (response.ok) {
        const result = await response.json();
        console.log(`✅ Added template: ${template.name}`);
      } else {
        const error = await response.text();
        console.error(`❌ Failed to add template ${template.name}:`, error);
      }
    } catch (error) {
      console.error(`❌ Error adding template ${template.name}:`, error.message);
    }
  }
}

addTemplates().then(() => {
  console.log('🎉 Template addition complete!');
}).catch(console.error);
