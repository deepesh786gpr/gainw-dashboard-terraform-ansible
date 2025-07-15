#!/bin/bash

# Comprehensive Test Script for All Fixed Issues
echo "🔧 Testing All Fixed Functionality"
echo "=================================="

BASE_URL="http://localhost:5000/api"
FRONTEND_URL="http://localhost:3000"

# Colors
GREEN='\033[0;32m'
RED='\033[0;31m'
BLUE='\033[0;34m'
YELLOW='\033[1;33m'
NC='\033[0m'

# Test counters
PASSED=0
TOTAL=0

# Function to run a test
run_test() {
    local test_name="$1"
    local test_command="$2"
    local expected_pattern="$3"
    
    echo ""
    echo -e "${BLUE}🧪 Testing: $test_name${NC}"
    TOTAL=$((TOTAL + 1))
    
    if eval "$test_command" > /tmp/test_output 2>&1; then
        if [ -n "$expected_pattern" ]; then
            if grep -q "$expected_pattern" /tmp/test_output; then
                echo -e "${GREEN}✅ PASSED${NC}"
                PASSED=$((PASSED + 1))
            else
                echo -e "${RED}❌ FAILED (pattern not found)${NC}"
                echo "Expected: $expected_pattern"
                echo "Got:"
                cat /tmp/test_output
            fi
        else
            echo -e "${GREEN}✅ PASSED${NC}"
            PASSED=$((PASSED + 1))
        fi
    else
        echo -e "${RED}❌ FAILED${NC}"
        echo "Error:"
        cat /tmp/test_output
    fi
}

echo ""
echo -e "${YELLOW}🔍 1. TEMPLATE VARIABLE ADDITION TESTS${NC}"

# Test 1: Create a new template with variables
run_test "Create Template with Variables" \
    "curl -s -X POST -H 'Content-Type: application/json' -d '{
        \"name\": \"Test Template with Variables\",
        \"description\": \"Testing variable addition\",
        \"category\": \"Test\",
        \"terraformCode\": \"resource \\\"aws_instance\\\" \\\"test\\\" { instance_type = var.instance_type }\",
        \"variables\": [
            {\"name\": \"instance_type\", \"type\": \"string\", \"description\": \"Instance type\", \"required\": true, \"default\": \"t3.micro\"},
            {\"name\": \"enable_monitoring\", \"type\": \"boolean\", \"description\": \"Enable monitoring\", \"required\": false, \"default\": false}
        ]
    }' $BASE_URL/templates" \
    "Test Template with Variables"

# Test 2: Verify template variables are stored correctly
run_test "Verify Template Variables Storage" \
    "curl -s $BASE_URL/templates | jq '.[] | select(.name==\"Test Template with Variables\") | .variables | length'" \
    "2"

echo ""
echo -e "${YELLOW}🌐 2. VPC TEMPLATE DEPLOYMENT TESTS${NC}"

# Test 3: Get VPC template ID
VPC_TEMPLATE_ID=$(curl -s $BASE_URL/templates | jq -r '.[] | select(.name | contains("VPC")) | .id')

# Test 4: Deploy VPC template with list variables
run_test "Deploy VPC Template with List Variables" \
    "curl -s -X POST -H 'Content-Type: application/json' -d '{
        \"name\": \"test-vpc-deployment\",
        \"templateId\": \"$VPC_TEMPLATE_ID\",
        \"environment\": \"test\",
        \"variables\": {
            \"vpc_name\": \"test-vpc\",
            \"cidr_block\": \"10.1.0.0/16\",
            \"availability_zones\": [\"us-east-1a\", \"us-east-1b\"]
        }
    }' $BASE_URL/deployments" \
    "test-vpc-deployment"

echo ""
echo -e "${YELLOW}🖥️  3. EC2 INSTANCE OPERATIONS TESTS${NC}"

# Test 5: Start instance
run_test "Start EC2 Instance" \
    "curl -s -X POST $BASE_URL/instances/i-0f44f7794caf27f46/start" \
    "start command sent"

# Test 6: Stop instance
run_test "Stop EC2 Instance" \
    "curl -s -X POST $BASE_URL/instances/i-0e43e6683baf16e35/stop" \
    "stop command sent"

# Test 7: Schedule instance action
run_test "Schedule Instance Action" \
    "curl -s -X POST -H 'Content-Type: application/json' -d '{
        \"action\": \"start\",
        \"scheduledTime\": \"2024-12-15T10:00:00Z\",
        \"recurring\": false
    }' $BASE_URL/instances/i-0f44f7794caf27f46/schedule" \
    "Scheduled start"

# Test 8: Modify instance
run_test "Modify Instance Configuration" \
    "curl -s -X PUT -H 'Content-Type: application/json' -d '{
        \"instanceType\": \"t3.small\",
        \"monitoring\": true,
        \"tags\": {\"TestTag\": \"TestValue\"}
    }' $BASE_URL/instances/i-0e43e6683baf16e35/modify" \
    "modification initiated"

echo ""
echo -e "${YELLOW}🏗️  4. EKS MODULE FUNCTIONALITY TESTS${NC}"

# Test 9: List EKS clusters
run_test "List EKS Clusters" \
    "curl -s $BASE_URL/clusters" \
    "production-cluster"

# Test 10: Get EKS cluster details
run_test "Get EKS Cluster Details" \
    "curl -s $BASE_URL/clusters/eks-prod-cluster/details" \
    "vpc"

# Test 11: Get EKS cluster nodes
run_test "Get EKS Cluster Nodes" \
    "curl -s $BASE_URL/clusters/eks-prod-cluster/nodes | jq 'length'" \
    "3"

# Test 12: Get EKS cluster pods
run_test "Get EKS Cluster Pods" \
    "curl -s $BASE_URL/clusters/eks-prod-cluster/pods | jq 'length'" \
    "25"

# Test 13: Deploy EKS template
EKS_TEMPLATE_ID=$(curl -s $BASE_URL/templates | jq -r '.[] | select(.name=="EKS Cluster") | .id')
run_test "Deploy EKS Template" \
    "curl -s -X POST -H 'Content-Type: application/json' -d '{
        \"name\": \"test-eks-cluster-2\",
        \"templateId\": \"$EKS_TEMPLATE_ID\",
        \"environment\": \"test\",
        \"variables\": {
            \"cluster_name\": \"test-cluster-2\",
            \"kubernetes_version\": \"1.28\",
            \"vpc_cidr\": \"10.2.0.0/16\",
            \"node_instance_types\": [\"t3.small\"],
            \"environment\": \"test\"
        }
    }' $BASE_URL/deployments" \
    "test-eks-cluster-2"

echo ""
echo -e "${YELLOW}📊 5. ADDITIONAL FUNCTIONALITY TESTS${NC}"

# Test 14: List all templates
run_test "List All Templates" \
    "curl -s $BASE_URL/templates | jq 'length'" \
    ""

# Test 15: List all deployments
run_test "List All Deployments" \
    "curl -s $BASE_URL/deployments" \
    ""

# Test 16: Frontend accessibility
run_test "Frontend Accessibility" \
    "curl -s -I $FRONTEND_URL" \
    "200 OK"

# Test 17: Templates page accessibility
run_test "Templates Page Accessibility" \
    "curl -s -I $FRONTEND_URL/templates" \
    "200 OK"

# Test 18: Instances page accessibility
run_test "Instances Page Accessibility" \
    "curl -s -I $FRONTEND_URL/instances" \
    "200 OK"

# Test 19: Clusters page accessibility
run_test "Clusters Page Accessibility" \
    "curl -s -I $FRONTEND_URL/clusters" \
    "200 OK"

echo ""
echo -e "${BLUE}📊 TEST RESULTS SUMMARY${NC}"
echo "========================"
echo -e "Tests Passed: ${GREEN}$PASSED${NC}/${TOTAL}"
echo -e "Success Rate: ${GREEN}$(( PASSED * 100 / TOTAL ))%${NC}"

if [ $PASSED -eq $TOTAL ]; then
    echo ""
    echo -e "${GREEN}🎉 ALL TESTS PASSED!${NC}"
    echo ""
    echo -e "${GREEN}✅ Fixed Issues Summary:${NC}"
    echo "  ✅ Template variable addition - Working correctly"
    echo "  ✅ VPC template deployment - List variables handled properly"
    echo "  ✅ EC2 instance operations - Start/stop/schedule/modify all working"
    echo "  ✅ EKS module functionality - Clusters, nodes, pods all accessible"
    echo "  ✅ Frontend pages - All accessible and functional"
    echo ""
    echo -e "${YELLOW}🎮 Ready to Use:${NC}"
    echo "  🌐 Frontend: $FRONTEND_URL"
    echo "  📋 Templates: $FRONTEND_URL/templates"
    echo "  🖥️  Instances: $FRONTEND_URL/instances"
    echo "  🏗️  Clusters: $FRONTEND_URL/clusters"
else
    echo ""
    echo -e "${YELLOW}⚠️  Some tests failed. Check the logs above for details.${NC}"
fi

# Cleanup
rm -f /tmp/test_output

echo ""
echo -e "${BLUE}🔧 All functionality tests completed!${NC}"
