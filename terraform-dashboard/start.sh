#!/bin/bash

# Terraform Dashboard Startup Script

echo "🚀 Starting Terraform Dashboard..."

# Check if Node.js is installed
if ! command -v node &> /dev/null; then
    echo "❌ Node.js is not installed. Please install Node.js 18+ and try again."
    exit 1
fi

# Check Node.js version
NODE_VERSION=$(node -v | cut -d'v' -f2 | cut -d'.' -f1)
if [ "$NODE_VERSION" -lt 18 ]; then
    echo "❌ Node.js version 18+ is required. Current version: $(node -v)"
    exit 1
fi

# Check if npm is installed
if ! command -v npm &> /dev/null; then
    echo "❌ npm is not installed. Please install npm and try again."
    exit 1
fi

# Create necessary directories
echo "📁 Creating necessary directories..."
mkdir -p backend/data
mkdir -p backend/terraform-workspace
mkdir -p backend/logs

# Copy environment file if it doesn't exist
if [ ! -f backend/.env ]; then
    echo "📝 Creating environment configuration..."
    cp backend/.env.example backend/.env
    echo "⚠️  Please edit backend/.env with your AWS credentials and configuration"
fi

# Install dependencies if node_modules don't exist
if [ ! -d "node_modules" ]; then
    echo "📦 Installing root dependencies..."
    npm install
fi

if [ ! -d "backend/node_modules" ]; then
    echo "📦 Installing backend dependencies..."
    cd backend && npm install && cd ..
fi

if [ ! -d "frontend/node_modules" ]; then
    echo "📦 Installing frontend dependencies..."
    cd frontend && npm install && cd ..
fi

# Build backend
echo "🔨 Building backend..."
cd backend && npm run build && cd ..

# Check if Terraform is installed
if command -v terraform &> /dev/null; then
    echo "✅ Terraform found: $(terraform version | head -n1)"
else
    echo "⚠️  Terraform not found. Please install Terraform for full functionality."
fi

# Check if Terragrunt is installed
if command -v terragrunt &> /dev/null; then
    echo "✅ Terragrunt found: $(terragrunt --version | head -n1)"
else
    echo "⚠️  Terragrunt not found. Please install Terragrunt for enhanced functionality."
fi

# Start the application
echo "🎯 Starting Terraform Dashboard..."
echo ""
echo "Frontend will be available at: http://localhost:3000"
echo "Backend API will be available at: http://localhost:5000"
echo ""
echo "Press Ctrl+C to stop the application"
echo ""

npm run dev
