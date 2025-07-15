#!/bin/bash

# Terraform Dashboard - New Features Demo Script
echo "🚀 Terraform Dashboard - New Features Demo"
echo "=========================================="

BASE_URL="http://localhost:5000/api"
FRONTEND_URL="http://localhost:3000"

# Colors
GREEN='\033[0;32m'
BLUE='\033[0;34m'
YELLOW='\033[1;33m'
NC='\033[0m'

echo ""
echo -e "${BLUE}📋 1. Available Templates${NC}"
echo "Showing all available infrastructure templates:"
curl -s $BASE_URL/templates | jq -r '.[] | "  ✅ \(.name) (\(.category)) - \(.description)"'

echo ""
echo -e "${BLUE}🖥️  2. Current EC2 Instances${NC}"
echo "Listing all EC2 instances:"
curl -s $BASE_URL/instances | jq -r '.[] | "  🖥️  \(.name) (\(.id)) - \(.state) - \(.type)"'

echo ""
echo -e "${BLUE}🔍 3. Instance Details Example${NC}"
echo "Detailed information for web-server-prod:"
curl -s $BASE_URL/instances/i-0e43e6683baf16e35/details | jq '{
  name: .name,
  type: .type,
  state: .state,
  environment: .environment,
  securityGroups: [.securityGroups[].name],
  tags: .tags,
  monitoring: .monitoring,
  terminationProtection: .terminationProtection
}'

echo ""
echo -e "${BLUE}🔧 4. Instance Modification Demo${NC}"
echo "Demonstrating instance modification capabilities:"

# Show current configuration
echo "Current configuration:"
curl -s $BASE_URL/instances/i-0e43e6683baf16e35/details | jq '{
  instanceType: .type,
  monitoring: .monitoring,
  tags: .tags
}'

echo ""
echo "Applying modifications..."

# Apply modifications
MODIFICATION_RESULT=$(curl -s -X PUT -H "Content-Type: application/json" \
  -d '{
    "instanceType": "t3.medium",
    "monitoring": true,
    "tags": {
      "Name": "web-server-prod",
      "Environment": "production", 
      "Project": "terraform-dashboard",
      "LastModified": "'$(date -u +"%Y-%m-%dT%H:%M:%SZ")'",
      "ModifiedBy": "Demo Script"
    }
  }' \
  $BASE_URL/instances/i-0e43e6683baf16e35/modify)

echo "$MODIFICATION_RESULT" | jq '{
  message: .message,
  modifications: [.modifications[].message]
}'

echo ""
echo -e "${BLUE}🎯 5. Template Deployment Example${NC}"
echo "Example EKS cluster deployment configuration:"

# Get EKS template ID
EKS_TEMPLATE_ID=$(curl -s $BASE_URL/templates | jq -r '.[] | select(.name=="EKS Cluster") | .id')

echo "Template ID: $EKS_TEMPLATE_ID"
echo ""
echo "Sample deployment payload:"
cat << EOF | jq '.'
{
  "templateId": "$EKS_TEMPLATE_ID",
  "name": "production-eks-cluster",
  "environment": "production",
  "variables": {
    "cluster_name": "prod-cluster",
    "kubernetes_version": "1.28",
    "vpc_cidr": "10.0.0.0/16",
    "node_instance_types": ["t3.medium", "t3.large"],
    "desired_capacity": 3,
    "max_capacity": 10,
    "min_capacity": 1,
    "environment": "production"
  }
}
EOF

echo ""
echo -e "${BLUE}📊 6. Dashboard Access Information${NC}"
echo "Access your Terraform Dashboard:"
echo "  🌐 Frontend: $FRONTEND_URL"
echo "  📡 Backend API: $BASE_URL"
echo ""
echo -e "${GREEN}✨ New Features Available:${NC}"
echo "  ✅ EKS Cluster deployment with full VPC setup"
echo "  ✅ RDS Database with multi-engine support"
echo "  ✅ Lambda Functions with API Gateway integration"
echo "  ✅ Real-time EC2 instance modification"
echo "  ✅ Advanced instance scheduling"
echo "  ✅ Comprehensive monitoring integration"
echo ""
echo -e "${YELLOW}🎮 Try it yourself:${NC}"
echo "  1. Open $FRONTEND_URL in your browser"
echo "  2. Go to Templates page to see new EKS, RDS, Lambda templates"
echo "  3. Go to Instances page and click 'Modify' on any instance"
echo "  4. Try deploying a new EKS cluster or RDS database"
echo "  5. Schedule instance start/stop actions"
echo ""
echo -e "${GREEN}🎉 Demo completed! Your Terraform Dashboard is ready for production use.${NC}"
