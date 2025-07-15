#!/bin/bash

# Comprehensive API Health Check
echo "🔍 Comprehensive API Health Check"
echo "================================="

BASE_URL="http://localhost:5000/api"
FRONTEND_URL="http://localhost:3000"

# Colors
GREEN='\033[0;32m'
RED='\033[0;31m'
BLUE='\033[0;34m'
YELLOW='\033[1;33m'
CYAN='\033[0;36m'
NC='\033[0m'

# Test counters
TOTAL_TESTS=0
PASSED_TESTS=0
FAILED_TESTS=0

# Function to test API endpoint
test_api() {
    local method="$1"
    local endpoint="$2"
    local data="$3"
    local expected_status="$4"
    local description="$5"
    
    TOTAL_TESTS=$((TOTAL_TESTS + 1))
    
    echo -n "  Testing $description... "
    
    if [ "$method" = "GET" ]; then
        response=$(curl -s -w "%{http_code}" -o /tmp/api_response "$BASE_URL$endpoint")
    else
        response=$(curl -s -w "%{http_code}" -o /tmp/api_response -X "$method" -H "Content-Type: application/json" -d "$data" "$BASE_URL$endpoint")
    fi
    
    status_code="${response: -3}"
    
    if [ "$status_code" = "$expected_status" ]; then
        echo -e "${GREEN}✅ PASS${NC} ($status_code)"
        PASSED_TESTS=$((PASSED_TESTS + 1))
    else
        echo -e "${RED}❌ FAIL${NC} ($status_code, expected $expected_status)"
        FAILED_TESTS=$((FAILED_TESTS + 1))
        echo "    Response: $(cat /tmp/api_response | head -c 200)"
    fi
}

echo ""
echo -e "${BLUE}🏥 Health Check Endpoints${NC}"
test_api "GET" "/health" "" "200" "Health check"

echo ""
echo -e "${BLUE}📋 Templates API${NC}"
test_api "GET" "/templates" "" "200" "Get all templates"
test_api "POST" "/templates" '{"name":"test-template","description":"Test","category":"Test","terraformCode":"resource \"aws_instance\" \"test\" {}","variables":[]}' "201" "Create template"

echo ""
echo -e "${BLUE}🖥️  Instances API${NC}"
test_api "GET" "/instances" "" "200" "Get all instances"

# Only test instance operations if instances exist
INSTANCES_COUNT=$(curl -s "$BASE_URL/instances" | jq 'length' 2>/dev/null || echo "0")
if [ "$INSTANCES_COUNT" -gt 0 ]; then
    FIRST_INSTANCE=$(curl -s "$BASE_URL/instances" | jq -r '.[0].id' 2>/dev/null)
    if [ "$FIRST_INSTANCE" != "null" ] && [ "$FIRST_INSTANCE" != "" ]; then
        test_api "POST" "/instances/$FIRST_INSTANCE/start" "" "200" "Start instance"
        test_api "POST" "/instances/$FIRST_INSTANCE/stop" "" "200" "Stop instance"
    fi
fi

echo ""
echo -e "${BLUE}🏗️  Clusters API${NC}"
test_api "GET" "/clusters" "" "200" "Get all clusters"

echo ""
echo -e "${BLUE}🚀 Deployments API${NC}"
test_api "GET" "/deployments" "" "200" "Get all deployments"

# Test deployment creation with a valid template
TEMPLATE_ID=$(curl -s "$BASE_URL/templates" | jq -r '.[0].id' 2>/dev/null)
if [ "$TEMPLATE_ID" != "null" ] && [ "$TEMPLATE_ID" != "" ]; then
    test_api "POST" "/deployments" "{\"name\":\"api-test-$(date +%s)\",\"templateId\":\"$TEMPLATE_ID\",\"environment\":\"test\",\"variables\":{}}" "201" "Create deployment"
fi

echo ""
echo -e "${BLUE}🐙 GitHub API${NC}"
test_api "GET" "/github/search?q=terraform&limit=5" "" "200" "GitHub search"
test_api "POST" "/github/validate-token" '{"token":"invalid"}' "200" "GitHub token validation"

echo ""
echo -e "${BLUE}🌐 Frontend Pages${NC}"

# Test frontend pages
PAGES=(
    "/"
    "/templates"
    "/github-import"
    "/instances"
    "/deployments"
    "/clusters"
    "/cost-analysis"
    "/security-center"
    "/settings"
)

for page in "${PAGES[@]}"; do
    TOTAL_TESTS=$((TOTAL_TESTS + 1))
    echo -n "  Testing $page... "
    
    status=$(curl -s -o /dev/null -w "%{http_code}" "$FRONTEND_URL$page")
    
    if [ "$status" = "200" ]; then
        echo -e "${GREEN}✅ PASS${NC} ($status)"
        PASSED_TESTS=$((PASSED_TESTS + 1))
    else
        echo -e "${RED}❌ FAIL${NC} ($status)"
        FAILED_TESTS=$((FAILED_TESTS + 1))
    fi
done

echo ""
echo -e "${BLUE}📊 Performance Tests${NC}"

# Test API response times
echo -n "  Testing API response times... "
START_TIME=$(date +%s%N)
curl -s "$BASE_URL/instances" > /dev/null
END_TIME=$(date +%s%N)
RESPONSE_TIME=$(( (END_TIME - START_TIME) / 1000000 ))

if [ "$RESPONSE_TIME" -lt 5000 ]; then
    echo -e "${GREEN}✅ PASS${NC} (${RESPONSE_TIME}ms)"
    PASSED_TESTS=$((PASSED_TESTS + 1))
else
    echo -e "${YELLOW}⚠️  SLOW${NC} (${RESPONSE_TIME}ms)"
    FAILED_TESTS=$((FAILED_TESTS + 1))
fi
TOTAL_TESTS=$((TOTAL_TESTS + 1))

echo ""
echo -e "${BLUE}🔍 Data Integrity Tests${NC}"

# Test data consistency
echo -n "  Testing data consistency... "
TEMPLATES_COUNT=$(curl -s "$BASE_URL/templates" | jq 'length' 2>/dev/null || echo "0")
DEPLOYMENTS_COUNT=$(curl -s "$BASE_URL/deployments" | jq 'length' 2>/dev/null || echo "0")

if [ "$TEMPLATES_COUNT" -ge 0 ] && [ "$DEPLOYMENTS_COUNT" -ge 0 ]; then
    echo -e "${GREEN}✅ PASS${NC} (Templates: $TEMPLATES_COUNT, Deployments: $DEPLOYMENTS_COUNT)"
    PASSED_TESTS=$((PASSED_TESTS + 1))
else
    echo -e "${RED}❌ FAIL${NC} (Invalid data counts)"
    FAILED_TESTS=$((FAILED_TESTS + 1))
fi
TOTAL_TESTS=$((TOTAL_TESTS + 1))

echo ""
echo -e "${BLUE}📋 Test Summary${NC}"
echo "==============="
echo "Total Tests: $TOTAL_TESTS"
echo -e "Passed: ${GREEN}$PASSED_TESTS${NC}"
echo -e "Failed: ${RED}$FAILED_TESTS${NC}"

SUCCESS_RATE=$(( PASSED_TESTS * 100 / TOTAL_TESTS ))
echo -e "Success Rate: ${GREEN}$SUCCESS_RATE%${NC}"

if [ "$SUCCESS_RATE" -ge 90 ]; then
    echo -e "\n${GREEN}🎉 Excellent! API health is very good.${NC}"
elif [ "$SUCCESS_RATE" -ge 75 ]; then
    echo -e "\n${YELLOW}⚠️  Good, but some issues need attention.${NC}"
else
    echo -e "\n${RED}❌ Poor API health. Immediate attention required.${NC}"
fi

echo ""
echo -e "${CYAN}🔧 Recommendations:${NC}"

if [ "$FAILED_TESTS" -gt 0 ]; then
    echo "  1. Review failed endpoints and fix issues"
    echo "  2. Add better error handling and validation"
    echo "  3. Implement retry mechanisms for failed requests"
fi

if [ "$RESPONSE_TIME" -gt 3000 ]; then
    echo "  4. Optimize slow API responses"
    echo "  5. Add caching for frequently accessed data"
fi

echo "  6. Add comprehensive logging and monitoring"
echo "  7. Implement health check dashboard"
echo "  8. Add automated testing pipeline"

# Cleanup
rm -f /tmp/api_response

echo ""
echo -e "${GREEN}🔍 API health check completed!${NC}"
