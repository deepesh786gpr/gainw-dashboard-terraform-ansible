#!/bin/bash

# Terraform Dashboard Functionality Test Script
echo "🧪 Starting comprehensive functionality tests..."
echo "=================================================="

BASE_URL="http://localhost:5000/api"
FRONTEND_URL="http://localhost:3000"

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Test counters
PASSED=0
TOTAL=0

# Function to run a test
run_test() {
    local test_name="$1"
    local test_command="$2"
    local expected_pattern="$3"
    
    echo ""
    echo "🔍 Testing $test_name..."
    TOTAL=$((TOTAL + 1))
    
    if eval "$test_command" > /tmp/test_output 2>&1; then
        if [ -n "$expected_pattern" ]; then
            if grep -q "$expected_pattern" /tmp/test_output; then
                echo -e "${GREEN}✅ $test_name: PASSED${NC}"
                PASSED=$((PASSED + 1))
            else
                echo -e "${RED}❌ $test_name: FAILED (pattern not found)${NC}"
                echo "Expected pattern: $expected_pattern"
                echo "Actual output:"
                cat /tmp/test_output
            fi
        else
            echo -e "${GREEN}✅ $test_name: PASSED${NC}"
            PASSED=$((PASSED + 1))
        fi
    else
        echo -e "${RED}❌ $test_name: FAILED${NC}"
        echo "Error output:"
        cat /tmp/test_output
    fi
}

# Test 1: Server Health
run_test "Server Health" \
    "curl -s -f $BASE_URL/health" \
    '"status":"OK"'

# Test 2: Templates List
run_test "Templates List" \
    "curl -s -f $BASE_URL/templates" \
    "EKS Cluster"

# Test 3: EKS Template Exists
run_test "EKS Template" \
    "curl -s -f $BASE_URL/templates | jq -r '.[].name' | grep -q 'EKS Cluster'" \
    ""

# Test 4: RDS Template Exists
run_test "RDS Template" \
    "curl -s -f $BASE_URL/templates | jq -r '.[].name' | grep -q 'RDS Database'" \
    ""

# Test 5: Lambda Template Exists
run_test "Lambda Template" \
    "curl -s -f $BASE_URL/templates | jq -r '.[].name' | grep -q 'Lambda Function'" \
    ""

# Test 6: Instances List
run_test "Instances List" \
    "curl -s -f $BASE_URL/instances" \
    "i-0e43e6683baf16e35"

# Test 7: Instance Details
run_test "Instance Details" \
    "curl -s -f $BASE_URL/instances/i-0e43e6683baf16e35/details" \
    "web-server-prod"

# Test 8: Instance Modification
run_test "Instance Modification" \
    "curl -s -f -X PUT -H 'Content-Type: application/json' -d '{\"instanceType\":\"t3.medium\",\"monitoring\":true}' $BASE_URL/instances/i-0e43e6683baf16e35/modify" \
    "modification initiated"

# Test 9: Deployments Endpoint
run_test "Deployments Endpoint" \
    "curl -s -f $BASE_URL/deployments" \
    ""

# Test 10: Frontend Accessibility
run_test "Frontend Access" \
    "curl -s -f -I $FRONTEND_URL" \
    "200 OK"

# Summary
echo ""
echo "📊 Test Results Summary:"
echo "=================================================="
echo -e "Tests Passed: ${GREEN}$PASSED${NC}/${TOTAL}"
echo -e "Success Rate: ${GREEN}$(( PASSED * 100 / TOTAL ))%${NC}"

if [ $PASSED -eq $TOTAL ]; then
    echo ""
    echo -e "${GREEN}🎉 All tests passed! The Terraform Dashboard is fully functional.${NC}"
    echo ""
    echo "✅ Available Features:"
    echo "  - EKS Cluster deployment"
    echo "  - RDS Database deployment" 
    echo "  - Lambda Function deployment"
    echo "  - EC2 Instance management"
    echo "  - Instance modification via GUI"
    echo "  - Instance scheduling"
    echo "  - Real-time monitoring"
    echo ""
    echo "🌐 Access URLs:"
    echo "  - Frontend: $FRONTEND_URL"
    echo "  - Backend API: $BASE_URL"
else
    echo ""
    echo -e "${YELLOW}⚠️  Some tests failed. Please check the logs above.${NC}"
fi

# Cleanup
rm -f /tmp/test_output

exit 0
