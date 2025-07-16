#!/bin/bash

# Quick Status Check Script
# Verifies all components are working

# Colors
GREEN='\033[0;32m'
RED='\033[0;31m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m'

echo -e "${BLUE}🔍 Terraform Dashboard Status Check${NC}"
echo "===================================="
echo ""

# Check if backend is running
echo -e "${BLUE}1. Backend Health Check${NC}"
if curl -s http://localhost:5000/api/health > /dev/null; then
    echo -e "   ✅ Backend is ${GREEN}RUNNING${NC} on http://localhost:5000"
    
    # Get detailed health info
    HEALTH=$(curl -s http://localhost:5000/api/health | jq -r '.status' 2>/dev/null || echo "unknown")
    echo -e "   📊 Status: $HEALTH"
else
    echo -e "   ❌ Backend is ${RED}NOT RUNNING${NC}"
    echo -e "   💡 Start with: ${YELLOW}./start-backend-only.sh${NC}"
fi

echo ""

# Check frontend
echo -e "${BLUE}2. Frontend Check${NC}"
if curl -s http://localhost:3000 > /dev/null; then
    echo -e "   ✅ Frontend is ${GREEN}RUNNING${NC} on http://localhost:3000"
else
    echo -e "   ❌ Frontend is ${RED}NOT RUNNING${NC}"
    echo -e "   💡 Start with: ${YELLOW}./deploy-production.sh${NC}"
fi

echo ""

# Check authentication
echo -e "${BLUE}3. Authentication Test${NC}"
AUTH_RESPONSE=$(curl -s -X POST http://localhost:5000/api/auth/login \
    -H "Content-Type: application/json" \
    -d '{"username": "admin", "password": "admin123"}' 2>/dev/null)

if echo "$AUTH_RESPONSE" | grep -q "success.*true"; then
    echo -e "   ✅ Authentication is ${GREEN}WORKING${NC}"
    echo -e "   🔐 Login: admin / admin123"
else
    echo -e "   ❌ Authentication ${RED}FAILED${NC}"
fi

echo ""

# Check GitHub API status
echo -e "${BLUE}4. GitHub Integration${NC}"
GITHUB_RESPONSE=$(curl -s -X POST http://localhost:5000/api/github/validate-token \
    -H "Content-Type: application/json" \
    -d '{"token": ""}' 2>/dev/null)

if echo "$GITHUB_RESPONSE" | grep -q "rate limit"; then
    echo -e "   ⚠️  GitHub API is ${YELLOW}RATE LIMITED${NC}"
    echo -e "   💡 Use GitHub token for unlimited access"
elif echo "$GITHUB_RESPONSE" | grep -q "valid"; then
    echo -e "   ✅ GitHub API is ${GREEN}WORKING${NC}"
else
    echo -e "   ❌ GitHub API ${RED}ERROR${NC}"
fi

echo ""

# Check database
echo -e "${BLUE}5. Database Status${NC}"
if [ -f "backend/data/terraform-dashboard.db" ]; then
    echo -e "   ✅ Database file ${GREEN}EXISTS${NC}"
    
    # Check if we can query it
    if command -v sqlite3 >/dev/null 2>&1; then
        USER_COUNT=$(sqlite3 backend/data/terraform-dashboard.db "SELECT COUNT(*) FROM users;" 2>/dev/null || echo "0")
        echo -e "   👥 Users in database: $USER_COUNT"
    fi
else
    echo -e "   ❌ Database file ${RED}MISSING${NC}"
fi

echo ""

# Summary
echo -e "${BLUE}📋 Quick Access${NC}"
echo "   • Backend API: http://localhost:5000"
echo "   • Frontend: http://localhost:3000"
echo "   • Health Check: http://localhost:5000/api/health"
echo "   • Test Page: test-github-ansible.html"
echo ""

echo -e "${BLUE}🚀 Available Commands${NC}"
echo "   • ./start-backend-only.sh    # Start backend only"
echo "   • ./deploy-production.sh     # Full production deployment"
echo "   • ./deploy.sh dev            # Development mode (if memory allows)"
echo "   • ./check-status.sh          # This status check"
echo ""

# Check if any processes are running
if command -v pm2 >/dev/null 2>&1; then
    echo -e "${BLUE}🔄 PM2 Processes${NC}"
    pm2 status 2>/dev/null || echo "   No PM2 processes running"
fi
