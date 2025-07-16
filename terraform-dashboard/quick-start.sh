#!/bin/bash

# Terraform Dashboard - Quick Start Script
# One-command setup and deployment

set -e

# Colors
GREEN='\033[0;32m'
BLUE='\033[0;34m'
YELLOW='\033[1;33m'
NC='\033[0m'

echo -e "${BLUE}"
echo "🚀 Terraform Dashboard - Quick Start"
echo "===================================="
echo -e "${NC}"

# Check if we're in the right directory
if [ ! -f "deploy.sh" ]; then
    echo -e "${YELLOW}⚠️  Please run this script from the terraform-dashboard directory${NC}"
    exit 1
fi

# Make deploy script executable
chmod +x deploy.sh

echo -e "${GREEN}✅ Starting Terraform Dashboard in development mode...${NC}"
echo ""
echo -e "${BLUE}📋 What this will do:${NC}"
echo "   • Check prerequisites (Node.js, npm)"
echo "   • Install dependencies"
echo "   • Start backend on http://localhost:5000"
echo "   • Start frontend on http://localhost:3000"
echo ""
echo -e "${BLUE}🔐 Default login credentials:${NC}"
echo "   Username: admin"
echo "   Password: admin123"
echo ""
echo -e "${YELLOW}⚠️  Change the password after first login!${NC}"
echo ""

# Ask for confirmation
read -p "Continue? (y/N): " -n 1 -r
echo
if [[ ! $REPLY =~ ^[Yy]$ ]]; then
    echo "Cancelled."
    exit 0
fi

echo ""
echo -e "${GREEN}🚀 Starting deployment...${NC}"

# Run the deployment script in development mode
./deploy.sh dev
