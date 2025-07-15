#!/bin/bash

echo "🚀 Deploying Terraform Dashboard with All Fixes..."

# Clean up previous data
echo "🧹 Cleaning up previous data..."
rm -rf backend/data/database.sqlite backend/terraform-workspace/* backend/logs/* 2>/dev/null || true

# Create necessary directories
echo "📁 Creating directories..."
mkdir -p backend/data backend/terraform-workspace backend/logs

# Start the backend
echo "🔧 Starting backend with AWS credentials..."
cd backend
AWS_PROFILE=default npm run dev &
BACKEND_PID=$!

# Wait for backend to start
echo "⏳ Waiting for backend to initialize..."
sleep 10

# Check if backend is running
if curl -s http://localhost:5000/api/health > /dev/null; then
    echo "✅ Backend is running"
else
    echo "❌ Backend failed to start"
    exit 1
fi

# Add enhanced templates
echo "📋 Adding enhanced templates..."
cd ..

# Create Enhanced EC2 Instance template
curl -X POST http://localhost:5000/api/templates \
  -H "Content-Type: application/json" \
  -d '{
    "name": "Enhanced EC2 Instance",
    "description": "Deploy a comprehensive EC2 instance with security group, EBS volumes, and advanced configurations",
    "category": "Compute",
    "terraformCode": "# Enhanced EC2 Instance with Security Group\ndata \"aws_ami\" \"selected\" {\n  count       = var.ami_id == \"\" ? 1 : 0\n  most_recent = true\n  owners      = [var.ami_owner]\n  \n  filter {\n    name   = \"name\"\n    values = [var.ami_name_filter]\n  }\n  \n  filter {\n    name   = \"virtualization-type\"\n    values = [\"hvm\"]\n  }\n}\n\nlocals {\n  ami_id = var.ami_id != \"\" ? var.ami_id : data.aws_ami.selected[0].id\n  security_group_name = var.security_group_name != \"\" ? var.security_group_name : \"${var.name}-sg\"\n}\n\n# Security Group\nresource \"aws_security_group\" \"instance\" {\n  count       = var.create_security_group ? 1 : 0\n  name        = local.security_group_name\n  description = \"Security group for ${var.name} EC2 instance\"\n  vpc_id      = var.vpc_id\n  \n  ingress {\n    description = \"SSH access\"\n    from_port   = var.ssh_port\n    to_port     = var.ssh_port\n    protocol    = \"tcp\"\n    cidr_blocks = var.allowed_cidr_blocks\n  }\n  \n  egress {\n    description = \"All outbound traffic\"\n    from_port   = 0\n    to_port     = 0\n    protocol    = \"-1\"\n    cidr_blocks = [\"0.0.0.0/0\"]\n  }\n  \n  tags = {\n    Name        = local.security_group_name\n    Environment = var.environment\n  }\n}\n\n# EC2 Instance\nresource \"aws_instance\" \"main\" {\n  ami           = local.ami_id\n  instance_type = var.instance_type\n  key_name      = var.key_pair_name != \"\" ? var.key_pair_name : null\n  \n  vpc_security_group_ids      = var.create_security_group ? [aws_security_group.instance[0].id] : var.security_group_ids\n  associate_public_ip_address = var.associate_public_ip\n  \n  user_data                   = var.user_data != \"\" ? var.user_data : null\n  monitoring                 = var.enable_detailed_monitoring\n  disable_api_termination    = var.enable_termination_protection\n  \n  root_block_device {\n    volume_type = var.root_volume_type\n    volume_size = var.root_volume_size\n    encrypted   = var.root_volume_encrypted\n    \n    tags = {\n      Name        = \"${var.name}-root-volume\"\n      Environment = var.environment\n    }\n  }\n  \n  tags = {\n    Name        = var.name\n    Environment = var.environment\n    Module      = \"enhanced-ec2-instance\"\n  }\n  \n  depends_on = [aws_security_group.instance]\n}",
    "variables": [
      {"name": "name", "type": "string", "description": "Name for the EC2 instance", "required": true},
      {"name": "instance_type", "type": "string", "description": "EC2 instance type", "required": false, "default": "t3.micro", "options": ["t3.nano", "t3.micro", "t3.small", "t3.medium", "t3.large", "t2.micro", "t2.small", "t2.medium", "m5.large", "c5.large", "r5.large"]},
      {"name": "ami_id", "type": "string", "description": "AMI ID for the instance (leave empty for latest Amazon Linux 2)", "required": false, "default": ""},
      {"name": "ami_name_filter", "type": "string", "description": "Name filter for AMI lookup", "required": false, "default": "amzn2-ami-hvm-*-x86_64-gp2"},
      {"name": "ami_owner", "type": "string", "description": "Owner of the AMI", "required": false, "default": "amazon", "options": ["amazon", "self", "aws-marketplace"]},
      {"name": "key_pair_name", "type": "string", "description": "AWS key pair name for EC2 access", "required": false, "default": ""},
      {"name": "vpc_id", "type": "string", "description": "VPC ID where the instance will be created", "required": false, "default": ""},
      {"name": "security_group_ids", "type": "list", "description": "List of security group IDs to attach", "required": false, "default": []},
      {"name": "create_security_group", "type": "boolean", "description": "Whether to create a default security group", "required": false, "default": false},
      {"name": "security_group_name", "type": "string", "description": "Name for the security group", "required": false, "default": ""},
      {"name": "allowed_cidr_blocks", "type": "list", "description": "CIDR blocks allowed to access the instance", "required": false, "default": ["0.0.0.0/0"]},
      {"name": "ssh_port", "type": "number", "description": "SSH port for instance access", "required": false, "default": 22},
      {"name": "user_data", "type": "string", "description": "User data script for instance initialization", "required": false, "default": ""},
      {"name": "root_volume_size", "type": "number", "description": "Size of the root EBS volume in GB", "required": false, "default": 20},
      {"name": "root_volume_type", "type": "string", "description": "Type of the root EBS volume", "required": false, "default": "gp3", "options": ["gp2", "gp3", "io1", "io2"]},
      {"name": "root_volume_encrypted", "type": "boolean", "description": "Whether to encrypt the root EBS volume", "required": false, "default": true},
      {"name": "associate_public_ip", "type": "boolean", "description": "Whether to associate a public IP address", "required": false, "default": true},
      {"name": "enable_detailed_monitoring", "type": "boolean", "description": "Enable detailed monitoring", "required": false, "default": false},
      {"name": "enable_termination_protection", "type": "boolean", "description": "Enable termination protection", "required": false, "default": false}
    ]
  }' > /dev/null

if [ $? -eq 0 ]; then
    echo "✅ Added Enhanced EC2 Instance template"
else
    echo "❌ Failed to add Enhanced EC2 Instance template"
fi

# Start the frontend
echo "🎨 Starting frontend..."
cd frontend
npm start &
FRONTEND_PID=$!

# Wait for frontend to start
echo "⏳ Waiting for frontend to start..."
sleep 15

# Check if frontend is running
if curl -s -I http://localhost:3000 > /dev/null; then
    echo "✅ Frontend is running on http://localhost:3000"
elif curl -s -I http://localhost:3007 > /dev/null; then
    echo "✅ Frontend is running on http://localhost:3007"
else
    echo "❌ Frontend failed to start"
fi

echo ""
echo "🎉 Terraform Dashboard Deployment Complete!"
echo ""
echo "📋 Access URLs:"
echo "   🎨 Frontend: http://localhost:3000 or http://localhost:3007"
echo "   🔧 Backend API: http://localhost:5000"
echo "   📊 Health Check: http://localhost:5000/api/health"
echo ""
echo "🔧 Features Available:"
echo "   ✅ Real EC2 instance discovery and management"
echo "   ✅ Instance restart/start/stop functionality"
echo "   ✅ Enhanced EC2 Instance template with advanced configurations"
echo "   ✅ Full Terraform lifecycle management (init/plan/apply/destroy)"
echo "   ✅ Real-time deployment logs and status updates"
echo "   ✅ AWS credentials integration"
echo ""
echo "🎯 Next Steps:"
echo "   1. Open http://localhost:3007 in your browser"
echo "   2. Go to Instances page to see your real AWS EC2 instances"
echo "   3. Go to Deployments page to create new infrastructure"
echo "   4. Try the Enhanced EC2 Instance template for advanced deployments"
echo ""
echo "Press Ctrl+C to stop all services"

# Keep the script running
wait
