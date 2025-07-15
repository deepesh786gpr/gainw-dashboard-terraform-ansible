const sqlite3 = require('sqlite3').verbose();
const path = require('path');
const { v4: uuidv4 } = require('uuid');

const dbPath = path.join(__dirname, 'backend', 'data', 'database.sqlite');

// Enhanced templates based on your modules
const enhancedTemplates = [
  {
    id: uuidv4(),
    name: 'Enhanced EC2 Instance',
    description: 'Deploy a comprehensive EC2 instance with security group, EBS volumes, and advanced configurations',
    category: 'Compute',
    terraform_code: `# Data source for latest AMI if not provided
data "aws_ami" "selected" {
  count       = var.ami_id == "" ? 1 : 0
  most_recent = true
  owners      = [var.ami_owner]
  
  filter {
    name   = "name"
    values = [var.ami_name_filter]
  }
  
  filter {
    name   = "virtualization-type"
    values = ["hvm"]
  }
  
  filter {
    name   = "state"
    values = ["available"]
  }
}

# Data source for subnet information
data "aws_subnet" "selected" {
  id = var.subnet_id
}

# Local values for computed configurations
locals {
  ami_id = var.ami_id != "" ? var.ami_id : data.aws_ami.selected[0].id
  security_group_name = var.security_group_name != "" ? var.security_group_name : "\${var.name}-sg"
  all_security_group_ids = var.create_security_group ? concat([aws_security_group.instance[0].id], var.security_group_ids) : var.security_group_ids
  
  common_tags = {
    Name        = var.name
    Environment = var.environment
    Module      = "ec2-instance"
  }
  
  volume_tags = {
    Name        = "\${var.name}-volume"
    Environment = var.environment
    Module      = "ec2-instance"
  }
}

# Security Group for the instance
resource "aws_security_group" "instance" {
  count       = var.create_security_group ? 1 : 0
  name        = local.security_group_name
  description = "Security group for \${var.name} EC2 instance"
  vpc_id      = var.vpc_id
  
  # SSH access
  ingress {
    description = "SSH access"
    from_port   = var.ssh_port
    to_port     = var.ssh_port
    protocol    = "tcp"
    cidr_blocks = var.allowed_cidr_blocks
  }
  
  # Outbound internet access
  egress {
    description = "All outbound traffic"
    from_port   = 0
    to_port     = 0
    protocol    = "-1"
    cidr_blocks = ["0.0.0.0/0"]
  }
  
  tags = merge(
    local.common_tags,
    {
      Name = local.security_group_name
    }
  )
  
  lifecycle {
    create_before_destroy = true
  }
}

# EC2 Instance
resource "aws_instance" "main" {
  ami           = local.ami_id
  instance_type = var.instance_type
  key_name      = var.key_pair_name != "" ? var.key_pair_name : null
  
  subnet_id                   = var.subnet_id
  vpc_security_group_ids      = local.all_security_group_ids
  associate_public_ip_address = var.associate_public_ip
  
  user_data                   = var.user_data != "" && !var.user_data_base64 ? var.user_data : null
  user_data_base64           = var.user_data != "" && var.user_data_base64 ? var.user_data : null
  
  monitoring                 = var.enable_detailed_monitoring
  disable_api_termination    = var.enable_termination_protection
  
  # Root volume configuration
  root_block_device {
    volume_type = var.root_volume_type
    volume_size = var.root_volume_size
    encrypted   = var.root_volume_encrypted
    kms_key_id  = var.root_volume_kms_key_id != "" ? var.root_volume_kms_key_id : null
    
    tags = local.volume_tags
    delete_on_termination = true
  }
  
  tags = local.common_tags
  
  lifecycle {
    ignore_changes = [
      ami,
      user_data,
      user_data_base64
    ]
  }
  
  depends_on = [aws_security_group.instance]
}

# Elastic IP (optional)
resource "aws_eip" "instance" {
  count    = var.associate_public_ip ? 1 : 0
  instance = aws_instance.main.id
  domain   = "vpc"
  
  tags = merge(
    local.common_tags,
    {
      Name = "\${var.name}-eip"
    }
  )
  
  depends_on = [aws_instance.main]
}`,
    variables: JSON.stringify([
      { name: 'name', type: 'string', description: 'Name for the EC2 instance', required: true },
      { name: 'instance_type', type: 'string', description: 'EC2 instance type', required: false, default: 't3.micro', options: ['t3.nano', 't3.micro', 't3.small', 't3.medium', 't3.large', 't3.xlarge', 't3.2xlarge', 't2.nano', 't2.micro', 't2.small', 't2.medium', 't2.large', 't2.xlarge', 't2.2xlarge', 'm5.large', 'm5.xlarge', 'm5.2xlarge', 'm5.4xlarge', 'm5.8xlarge', 'c5.large', 'c5.xlarge', 'c5.2xlarge', 'c5.4xlarge', 'c5.9xlarge', 'r5.large', 'r5.xlarge', 'r5.2xlarge', 'r5.4xlarge', 'r5.8xlarge'] },
      { name: 'ami_id', type: 'string', description: 'AMI ID for the instance (leave empty for latest Amazon Linux 2)', required: false, default: '' },
      { name: 'ami_name_filter', type: 'string', description: 'Name filter for AMI lookup when ami_id is not provided', required: false, default: 'amzn2-ami-hvm-*-x86_64-gp2' },
      { name: 'ami_owner', type: 'string', description: 'Owner of the AMI when using ami_name_filter', required: false, default: 'amazon', options: ['amazon', 'self', 'aws-marketplace'] },
      { name: 'key_pair_name', type: 'string', description: 'Name of the AWS key pair for EC2 access (optional)', required: false, default: '' },
      { name: 'vpc_id', type: 'string', description: 'VPC ID where the instance will be created', required: true },
      { name: 'subnet_id', type: 'string', description: 'Subnet ID where the instance will be placed', required: true },
      { name: 'security_group_ids', type: 'list', description: 'List of additional security group IDs to attach', required: false, default: [] },
      { name: 'create_security_group', type: 'boolean', description: 'Whether to create a default security group', required: false, default: true },
      { name: 'security_group_name', type: 'string', description: 'Name for the security group (if created)', required: false, default: '' },
      { name: 'allowed_cidr_blocks', type: 'list', description: 'List of CIDR blocks allowed to access the instance', required: false, default: ['10.0.0.0/8'] },
      { name: 'ssh_port', type: 'number', description: 'SSH port for instance access', required: false, default: 22 },
      { name: 'user_data', type: 'string', description: 'User data script for instance initialization', required: false, default: '' },
      { name: 'user_data_base64', type: 'boolean', description: 'Whether user_data is base64 encoded', required: false, default: false },
      { name: 'root_volume_size', type: 'number', description: 'Size of the root EBS volume in GB', required: false, default: 20 },
      { name: 'root_volume_type', type: 'string', description: 'Type of the root EBS volume', required: false, default: 'gp3', options: ['gp2', 'gp3', 'io1', 'io2', 'sc1', 'st1'] },
      { name: 'root_volume_encrypted', type: 'boolean', description: 'Whether to encrypt the root EBS volume', required: false, default: true },
      { name: 'root_volume_kms_key_id', type: 'string', description: 'KMS key ID for root volume encryption (optional)', required: false, default: '' },
      { name: 'associate_public_ip', type: 'boolean', description: 'Whether to associate a public IP address', required: false, default: false },
      { name: 'enable_detailed_monitoring', type: 'boolean', description: 'Enable detailed monitoring for the instance', required: false, default: false },
      { name: 'enable_termination_protection', type: 'boolean', description: 'Enable termination protection for the instance', required: false, default: false }
    ])
  }
];

function addTemplates() {
  const db = new sqlite3.Database(dbPath);
  
  console.log('🚀 Adding enhanced templates to database...');
  
  enhancedTemplates.forEach((template, index) => {
    db.run(
      `INSERT OR REPLACE INTO templates (id, name, description, category, terraform_code, variables, created_at, updated_at) 
       VALUES (?, ?, ?, ?, ?, ?, datetime('now'), datetime('now'))`,
      [template.id, template.name, template.description, template.category, template.terraform_code, template.variables],
      function(err) {
        if (err) {
          console.error(`❌ Error adding template ${template.name}:`, err.message);
        } else {
          console.log(`✅ Added template: ${template.name} (ID: ${template.id})`);
        }
        
        if (index === enhancedTemplates.length - 1) {
          db.close((err) => {
            if (err) {
              console.error('❌ Error closing database:', err.message);
            } else {
              console.log('🎉 Database closed successfully');
              console.log('📋 Enhanced templates have been added to the database!');
              console.log('🔄 Please restart the backend to see the new templates');
            }
          });
        }
      }
    );
  });
}

addTemplates();
