#!/bin/bash

# EKS Clusters Demo Script
echo "🚀 EKS Clusters Management Demo"
echo "==============================="

BASE_URL="http://localhost:5000/api"
FRONTEND_URL="http://localhost:3000"

# Colors
GREEN='\033[0;32m'
BLUE='\033[0;34m'
YELLOW='\033[1;33m'
CYAN='\033[0;36m'
NC='\033[0m'

echo ""
echo -e "${BLUE}🏗️  1. Available EKS Clusters${NC}"
echo "Listing all EKS clusters in your environment:"
curl -s $BASE_URL/clusters | jq -r '.[] | "  🏗️  \(.name) (\(.id)) - \(.status) - v\(.version) - \(.environment)"'

echo ""
echo -e "${BLUE}📊 2. Production Cluster Details${NC}"
echo "Comprehensive details for production-cluster:"

# Get cluster details
CLUSTER_DETAILS=$(curl -s $BASE_URL/clusters/eks-prod-cluster/details)

echo ""
echo -e "${CYAN}Basic Information:${NC}"
echo "$CLUSTER_DETAILS" | jq '{
  name: .name,
  status: .status,
  version: .version,
  platformVersion: .platformVersion,
  endpoint: .endpoint,
  region: .region,
  environment: .environment
}'

echo ""
echo -e "${CYAN}VPC Configuration:${NC}"
echo "$CLUSTER_DETAILS" | jq '{
  vpcId: .vpc.id,
  cidr: .vpc.cidr,
  privateSubnets: [.vpc.subnets.private[].id],
  publicSubnets: [.vpc.subnets.public[].id]
}'

echo ""
echo -e "${CYAN}Security Configuration:${NC}"
echo "$CLUSTER_DETAILS" | jq '{
  clusterSecurityGroup: .security.clusterSecurityGroup,
  nodeSecurityGroup: .security.nodeSecurityGroup,
  endpointAccess: .security.endpointAccess
}'

echo ""
echo -e "${CYAN}IAM Roles:${NC}"
echo "$CLUSTER_DETAILS" | jq '{
  clusterRole: .iam.clusterRole,
  nodeGroupRole: .iam.nodeGroupRole
}'

echo ""
echo -e "${CYAN}Current Metrics:${NC}"
echo "$CLUSTER_DETAILS" | jq '{
  cpuUtilization: (.metrics.cpuUtilization | tostring + "%"),
  memoryUtilization: (.metrics.memoryUtilization | tostring + "%"),
  podCount: .metrics.podCount,
  nodeCount: .metrics.nodeCount,
  networkIn: (.metrics.networkIn | tostring + " MB"),
  networkOut: (.metrics.networkOut | tostring + " MB")
}'

echo ""
echo -e "${BLUE}🖥️  3. Cluster Nodes${NC}"
echo "Worker nodes in production-cluster:"
curl -s $BASE_URL/clusters/eks-prod-cluster/nodes | jq -r '.[] | "  🖥️  \(.name) (\(.instanceType)) - \(.status) - \(.nodeGroup) - \(.availabilityZone)"'

echo ""
echo -e "${CYAN}Node Resource Utilization:${NC}"
curl -s $BASE_URL/clusters/eks-prod-cluster/nodes | jq -r '.[] | "  📊 \(.name): CPU \(.resources.cpu | floor)%, Memory \(.resources.memory | floor)%, Pods \(.resources.pods)"'

echo ""
echo -e "${BLUE}🐳 4. Running Pods${NC}"
echo "Pods running across all namespaces:"

# Get pods and group by namespace
PODS=$(curl -s $BASE_URL/clusters/eks-prod-cluster/pods)

echo ""
echo -e "${CYAN}Pods by Namespace:${NC}"
echo "$PODS" | jq -r 'group_by(.namespace) | .[] | "\(.length) pods in \(.[0].namespace) namespace"' | sort

echo ""
echo -e "${CYAN}Pod Status Summary:${NC}"
echo "$PODS" | jq -r 'group_by(.status) | .[] | "\(.length) pods \(.[0].status)"'

echo ""
echo -e "${CYAN}Sample Running Pods:${NC}"
echo "$PODS" | jq -r '.[:10] | .[] | "  🐳 \(.name) (\(.namespace)) - \(.status) - \(.ready) - \(.node)"'

echo ""
echo -e "${BLUE}🔌 5. Cluster Add-ons${NC}"
echo "Installed EKS add-ons:"
echo "$CLUSTER_DETAILS" | jq -r '.addons[] | "  🔌 \(.name) v\(.version) - \(.status)"'

echo ""
echo -e "${BLUE}📝 6. Logging Configuration${NC}"
echo "CloudWatch logging setup:"
echo "$CLUSTER_DETAILS" | jq '{
  logGroup: .logging.logGroup,
  enabledLogTypes: .logging.enabled
}'

echo ""
echo -e "${BLUE}🏷️  7. Node Groups${NC}"
echo "Node group configurations:"
echo "$CLUSTER_DETAILS" | jq -r '.nodeGroups[] | "  📦 \(.name): \(.desiredSize) nodes (\(.instanceTypes | join(", "))) - \(.capacityType) - \(.status)"'

echo ""
echo -e "${BLUE}🔄 8. Development Cluster Comparison${NC}"
echo "Comparing with development cluster:"

DEV_CLUSTER=$(curl -s $BASE_URL/clusters/eks-dev-cluster/details)

echo ""
echo -e "${CYAN}Environment Comparison:${NC}"
echo "Production Cluster:"
echo "  - Version: $(echo "$CLUSTER_DETAILS" | jq -r '.version')"
echo "  - Nodes: $(echo "$CLUSTER_DETAILS" | jq -r '.metrics.nodeCount')"
echo "  - Pods: $(echo "$CLUSTER_DETAILS" | jq -r '.metrics.podCount')"
echo "  - Node Types: $(echo "$CLUSTER_DETAILS" | jq -r '.nodeGroups[0].instanceTypes | join(", ")')"

echo ""
echo "Development Cluster:"
echo "  - Version: $(echo "$DEV_CLUSTER" | jq -r '.version')"
echo "  - Nodes: $(echo "$DEV_CLUSTER" | jq -r '.metrics.nodeCount')"
echo "  - Pods: $(echo "$DEV_CLUSTER" | jq -r '.metrics.podCount')"
echo "  - Node Types: $(echo "$DEV_CLUSTER" | jq -r '.nodeGroups[0].instanceTypes | join(", ")')"

echo ""
echo -e "${BLUE}🌐 9. Access Information${NC}"
echo "Dashboard Access:"
echo "  🌐 Frontend: $FRONTEND_URL/clusters"
echo "  📡 API Endpoints:"
echo "    - GET $BASE_URL/clusters - List all clusters"
echo "    - GET $BASE_URL/clusters/{id}/details - Cluster details"
echo "    - GET $BASE_URL/clusters/{id}/nodes - Cluster nodes"
echo "    - GET $BASE_URL/clusters/{id}/pods - Cluster pods"
echo "    - PUT $BASE_URL/clusters/{id}/update - Update cluster"

echo ""
echo -e "${GREEN}✨ EKS Cluster Features Available:${NC}"
echo "  ✅ Real-time cluster monitoring and metrics"
echo "  ✅ Comprehensive node and pod management"
echo "  ✅ VPC and networking configuration view"
echo "  ✅ Security groups and IAM roles overview"
echo "  ✅ Add-ons and logging configuration"
echo "  ✅ Multi-environment cluster comparison"
echo "  ✅ Interactive GUI with detailed tabs"

echo ""
echo -e "${YELLOW}🎮 Try it in the GUI:${NC}"
echo "  1. Open $FRONTEND_URL/clusters in your browser"
echo "  2. Click 'View Details' on any cluster"
echo "  3. Explore the Overview, Nodes, Pods, Networking, and Security tabs"
echo "  4. Monitor real-time metrics and resource utilization"
echo "  5. View comprehensive cluster configuration"

echo ""
echo -e "${GREEN}🎉 EKS Clusters demo completed! Your clusters are ready for management.${NC}"
