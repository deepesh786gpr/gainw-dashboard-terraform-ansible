const sqlite3 = require('sqlite3').verbose();
const fs = require('fs');
const path = require('path');

// Open database
const db = new sqlite3.Database('./database.sqlite');

// Template data
const templates = [
  {
    id: 'ec2-instance',
    name: 'EC2 Instance',
    description: 'Deploy a single EC2 instance with security group',
    category: 'Compute',
    terraform_code: `# Data source for latest Amazon Linux 2 AMI
data "aws_ami" "amazon_linux" {
  most_recent = true
  owners      = ["amazon"]
  
  filter {
    name   = "name"
    values = ["amzn2-ami-hvm-*-x86_64-gp2"]
  }
}

# Security Group for EC2 instance
resource "aws_security_group" "ec2_sg" {
  name        = "\${var.name}-sg"
  description = "Security group for \${var.name} EC2 instance"
  
  ingress {
    description = "SSH"
    from_port   = 22
    to_port     = 22
    protocol    = "tcp"
    cidr_blocks = ["0.0.0.0/0"]
  }
  
  ingress {
    description = "HTTP"
    from_port   = 80
    to_port     = 80
    protocol    = "tcp"
    cidr_blocks = ["0.0.0.0/0"]
  }
  
  egress {
    from_port   = 0
    to_port     = 0
    protocol    = "-1"
    cidr_blocks = ["0.0.0.0/0"]
  }
  
  tags = {
    Name        = "\${var.name}-sg"
    Environment = var.environment
  }
}

# EC2 Instance
resource "aws_instance" "main" {
  ami                    = var.ami_id != "" ? var.ami_id : data.aws_ami.amazon_linux.id
  instance_type          = var.instance_type
  key_name              = var.key_name != "" ? var.key_name : null
  vpc_security_group_ids = length(var.vpc_security_group_ids) > 0 ? var.vpc_security_group_ids : [aws_security_group.ec2_sg.id]
  subnet_id             = var.subnet_id != "" ? var.subnet_id : null
  associate_public_ip_address = var.associate_public_ip_address
  
  tags = {
    Name        = var.name
    Environment = var.environment
  }
}`,
    variables: JSON.stringify([
      { name: 'name', type: 'string', description: 'Instance name', required: true },
      { name: 'instance_type', type: 'string', description: 'Instance type', required: true, default: 't3.micro', options: ['t3.micro', 't3.small', 't3.medium', 't3.large', 't3.xlarge', 'm5.large', 'm5.xlarge', 'c5.large', 'c5.xlarge'] },
      { name: 'ami_id', type: 'string', description: 'AMI ID (leave empty for latest Amazon Linux 2)', required: false, default: '' },
      { name: 'key_name', type: 'string', description: 'EC2 Key Pair name', required: false, default: '' },
      { name: 'vpc_security_group_ids', type: 'list', description: 'List of security group IDs', required: false, default: [] },
      { name: 'subnet_id', type: 'string', description: 'Subnet ID', required: false, default: '' },
      { name: 'associate_public_ip_address', type: 'boolean', description: 'Associate a public IP address', required: false, default: true },
      { name: 'environment', type: 'string', description: 'Environment tag', required: false, default: 'dev', options: ['dev', 'staging', 'prod'] }
    ])
  },
  {
    id: 'eks-cluster',
    name: 'EKS Cluster',
    description: 'Deploy a comprehensive Amazon EKS cluster with VPC, node groups, and security configurations',
    category: 'Container',
    terraform_code: fs.readFileSync(path.join(__dirname, '../eks-template.json'), 'utf8').match(/"terraformCode":\s*"([^"]+)"/)[1].replace(/\\n/g, '\n').replace(/\\"/g, '"'),
    variables: JSON.stringify([
      { name: 'cluster_name', type: 'string', description: 'Name of the EKS cluster', required: true },
      { name: 'kubernetes_version', type: 'string', description: 'Kubernetes version', required: false, default: '1.28', options: ['1.24', '1.25', '1.26', '1.27', '1.28', '1.29'] },
      { name: 'vpc_cidr', type: 'string', description: 'CIDR block for VPC', required: false, default: '10.0.0.0/16' },
      { name: 'node_instance_types', type: 'list', description: 'Instance types for EKS node group', required: false, default: ['t3.medium'], options: ['t3.small', 't3.medium', 't3.large', 't3.xlarge', 'm5.large', 'm5.xlarge', 'm5.2xlarge', 'c5.large', 'c5.xlarge', 'c5.2xlarge'] },
      { name: 'desired_capacity', type: 'number', description: 'Desired number of worker nodes', required: false, default: 2 },
      { name: 'max_capacity', type: 'number', description: 'Maximum number of worker nodes', required: false, default: 4 },
      { name: 'min_capacity', type: 'number', description: 'Minimum number of worker nodes', required: false, default: 1 },
      { name: 'environment', type: 'string', description: 'Environment name', required: false, default: 'dev', options: ['dev', 'staging', 'prod'] }
    ])
  },
  {
    id: 'lambda-function',
    name: 'Lambda Function',
    description: 'Deploy a comprehensive AWS Lambda function with IAM roles, environment variables, and optional API Gateway integration',
    category: 'Serverless',
    terraform_code: `# IAM role for Lambda function
resource "aws_iam_role" "lambda_role" {
  name = "\${var.function_name}-lambda-role"
  
  assume_role_policy = jsonencode({
    Version = "2012-10-17"
    Statement = [
      {
        Action = "sts:AssumeRole"
        Effect = "Allow"
        Principal = {
          Service = "lambda.amazonaws.com"
        }
      }
    ]
  })
  
  tags = {
    Name        = "\${var.function_name}-lambda-role"
    Environment = var.environment
  }
}

# Basic Lambda execution policy
resource "aws_iam_role_policy_attachment" "lambda_basic" {
  policy_arn = "arn:aws:iam::aws:policy/service-role/AWSLambdaBasicExecutionRole"
  role       = aws_iam_role.lambda_role.name
}

# Create a simple Python function
data "archive_file" "lambda_zip" {
  type        = "zip"
  output_path = "/tmp/\${var.function_name}.zip"
  
  source {
    content = <<EOF
import json

def handler(event, context):
    return {
        'statusCode': 200,
        'body': json.dumps({
            'message': 'Hello from Lambda!',
            'function_name': '\${var.function_name}',
            'event': event
        })
    }
EOF
    filename = "index.py"
  }
}

# Lambda function
resource "aws_lambda_function" "main" {
  function_name = var.function_name
  role          = aws_iam_role.lambda_role.arn
  handler       = var.handler
  runtime       = var.runtime
  timeout       = var.timeout
  memory_size   = var.memory_size
  
  filename = data.archive_file.lambda_zip.output_path
  
  dynamic "environment" {
    for_each = length(var.environment_variables) > 0 ? [1] : []
    content {
      variables = var.environment_variables
    }
  }
  
  tags = {
    Name        = var.function_name
    Environment = var.environment
  }
  
  depends_on = [
    aws_iam_role_policy_attachment.lambda_basic
  ]
}`,
    variables: JSON.stringify([
      { name: 'function_name', type: 'string', description: 'A unique name for your Lambda Function', required: true },
      { name: 'handler', type: 'string', description: 'The function entrypoint in your code', required: false, default: 'index.handler' },
      { name: 'runtime', type: 'string', description: 'The runtime environment for the Lambda function', required: false, default: 'python3.9', options: ['python3.8', 'python3.9', 'python3.10', 'python3.11', 'nodejs16.x', 'nodejs18.x', 'nodejs20.x', 'java8', 'java11', 'java17', 'java21', 'dotnet6', 'dotnet8', 'go1.x', 'ruby3.2'] },
      { name: 'timeout', type: 'number', description: 'The amount of time your Lambda Function has to run in seconds', required: false, default: 3 },
      { name: 'memory_size', type: 'number', description: 'Amount of memory in MB your Lambda Function can use at runtime', required: false, default: 128 },
      { name: 'environment_variables', type: 'object', description: 'Environment variables for the Lambda function', required: false, default: {} },
      { name: 'environment', type: 'string', description: 'Environment name', required: false, default: 'dev', options: ['dev', 'staging', 'prod'] }
    ])
  }
];

// Function to add templates to database
function addTemplates() {
  console.log('🚀 Adding comprehensive templates to database...');
  
  // First, clear existing templates
  db.run('DELETE FROM templates', (err) => {
    if (err) {
      console.error('Error clearing templates:', err);
      return;
    }
    
    console.log('✅ Cleared existing templates');
    
    // Add new templates
    const stmt = db.prepare(`
      INSERT INTO templates (id, name, description, category, terraform_code, variables)
      VALUES (?, ?, ?, ?, ?, ?)
    `);
    
    templates.forEach((template, index) => {
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
        
        if (index === templates.length - 1) {
          stmt.finalize();
          console.log('🎉 All templates added successfully!');
          console.log(`📊 Total templates: ${templates.length}`);
          
          // List all templates
          db.all('SELECT id, name, category FROM templates ORDER BY category, name', (err, rows) => {
            if (err) {
              console.error('Error listing templates:', err);
            } else {
              console.log('\n📋 Available Templates:');
              rows.forEach(row => {
                console.log(`   ${row.category}: ${row.name} (${row.id})`);
              });
            }
            db.close();
          });
        }
      });
    });
  });
}

// Run the script
addTemplates();
