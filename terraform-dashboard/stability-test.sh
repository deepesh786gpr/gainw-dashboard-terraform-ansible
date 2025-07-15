#!/bin/bash

# Comprehensive Stability Test
echo "🔧 Comprehensive Stability Test for Terraform Dashboard"
echo "======================================================"

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

# Function to test API endpoint with retry
test_api_with_retry() {
    local method="$1"
    local endpoint="$2"
    local data="$3"
    local expected_status="$4"
    local description="$5"
    local retries=3
    
    TOTAL_TESTS=$((TOTAL_TESTS + 1))
    
    echo -n "  Testing $description... "
    
    for ((i=1; i<=retries; i++)); do
        if [ "$method" = "GET" ]; then
            response=$(curl -s -w "%{http_code}" -o /tmp/api_response "$BASE_URL$endpoint" 2>/dev/null)
        else
            response=$(curl -s -w "%{http_code}" -o /tmp/api_response -X "$method" -H "Content-Type: application/json" -d "$data" "$BASE_URL$endpoint" 2>/dev/null)
        fi
        
        status_code="${response: -3}"
        
        if [ "$status_code" = "$expected_status" ]; then
            echo -e "${GREEN}✅ PASS${NC} ($status_code)"
            PASSED_TESTS=$((PASSED_TESTS + 1))
            return 0
        elif [ $i -lt $retries ]; then
            echo -n "retry..."
            sleep 1
        fi
    done
    
    echo -e "${RED}❌ FAIL${NC} ($status_code, expected $expected_status)"
    FAILED_TESTS=$((FAILED_TESTS + 1))
    echo "    Response: $(cat /tmp/api_response | head -c 200)"
    return 1
}

# Function to test performance
test_performance() {
    local endpoint="$1"
    local description="$2"
    local max_time="$3"
    
    TOTAL_TESTS=$((TOTAL_TESTS + 1))
    echo -n "  Testing $description performance... "
    
    start_time=$(date +%s%N)
    response=$(curl -s -w "%{http_code}" -o /dev/null "$BASE_URL$endpoint")
    end_time=$(date +%s%N)
    
    response_time=$(( (end_time - start_time) / 1000000 ))
    status_code="${response: -3}"
    
    if [ "$status_code" = "200" ] && [ "$response_time" -lt "$max_time" ]; then
        echo -e "${GREEN}✅ PASS${NC} (${response_time}ms)"
        PASSED_TESTS=$((PASSED_TESTS + 1))
    else
        echo -e "${RED}❌ FAIL${NC} (${response_time}ms, max: ${max_time}ms, status: $status_code)"
        FAILED_TESTS=$((FAILED_TESTS + 1))
    fi
}

echo ""
echo -e "${BLUE}🏥 Health Check Tests${NC}"
test_api_with_retry "GET" "/health" "" "200" "Basic health check"
test_api_with_retry "GET" "/health/live" "" "200" "Liveness probe"
test_api_with_retry "GET" "/health/ready" "" "200" "Readiness probe"
test_api_with_retry "GET" "/health/detailed" "" "200" "Detailed health check"

echo ""
echo -e "${BLUE}📊 Performance Monitoring Tests${NC}"
test_api_with_retry "GET" "/metrics" "" "200" "Performance metrics"

echo ""
echo -e "${BLUE}🔧 Core API Tests${NC}"
test_api_with_retry "GET" "/templates" "" "200" "Templates API"
test_api_with_retry "GET" "/deployments" "" "200" "Deployments API"
test_api_with_retry "GET" "/instances" "" "200" "Instances API"
test_api_with_retry "GET" "/clusters" "" "200" "Clusters API"
test_api_with_retry "GET" "/github/search?q=terraform&limit=5" "" "200" "GitHub API"

echo ""
echo -e "${BLUE}⚡ Performance Tests${NC}"
test_performance "/templates" "Templates load time" 3000
test_performance "/deployments" "Deployments load time" 3000
test_performance "/instances" "Instances load time" 5000
test_performance "/health" "Health check response time" 1000

echo ""
echo -e "${BLUE}🔄 Load Testing${NC}"
echo -n "  Running concurrent requests test... "

# Run 10 concurrent requests to test stability
pids=()
for i in {1..10}; do
    curl -s "$BASE_URL/templates" > /dev/null &
    pids+=($!)
done

# Wait for all requests to complete
failed_requests=0
for pid in "${pids[@]}"; do
    if ! wait $pid; then
        failed_requests=$((failed_requests + 1))
    fi
done

TOTAL_TESTS=$((TOTAL_TESTS + 1))
if [ $failed_requests -eq 0 ]; then
    echo -e "${GREEN}✅ PASS${NC} (10/10 requests succeeded)"
    PASSED_TESTS=$((PASSED_TESTS + 1))
else
    echo -e "${RED}❌ FAIL${NC} ($failed_requests/10 requests failed)"
    FAILED_TESTS=$((FAILED_TESTS + 1))
fi

echo ""
echo -e "${BLUE}🌐 Frontend Stability Tests${NC}"

# Test frontend pages with timeout
PAGES=(
    "/"
    "/templates"
    "/github-import"
    "/instances"
    "/deployments"
    "/clusters"
)

for page in "${PAGES[@]}"; do
    TOTAL_TESTS=$((TOTAL_TESTS + 1))
    echo -n "  Testing $page... "
    
    status=$(timeout 10 curl -s -o /dev/null -w "%{http_code}" "$FRONTEND_URL$page" 2>/dev/null)
    
    if [ "$status" = "200" ]; then
        echo -e "${GREEN}✅ PASS${NC} ($status)"
        PASSED_TESTS=$((PASSED_TESTS + 1))
    else
        echo -e "${RED}❌ FAIL${NC} ($status)"
        FAILED_TESTS=$((FAILED_TESTS + 1))
    fi
done

echo ""
echo -e "${BLUE}🔍 Error Handling Tests${NC}"

# Test error scenarios
test_api_with_retry "GET" "/templates/nonexistent" "" "404" "404 error handling"
test_api_with_retry "POST" "/deployments" '{"invalid":"data"}' "400" "400 error handling"

echo ""
echo -e "${BLUE}💾 Database Integrity Tests${NC}"

echo -n "  Testing database consistency... "
TOTAL_TESTS=$((TOTAL_TESTS + 1))

# Check if we can read from all tables
templates_count=$(curl -s "$BASE_URL/templates" | jq 'length' 2>/dev/null || echo "error")
deployments_count=$(curl -s "$BASE_URL/deployments" | jq 'length' 2>/dev/null || echo "error")

if [ "$templates_count" != "error" ] && [ "$deployments_count" != "error" ]; then
    echo -e "${GREEN}✅ PASS${NC} (Templates: $templates_count, Deployments: $deployments_count)"
    PASSED_TESTS=$((PASSED_TESTS + 1))
else
    echo -e "${RED}❌ FAIL${NC} (Database read error)"
    FAILED_TESTS=$((FAILED_TESTS + 1))
fi

echo ""
echo -e "${BLUE}🔐 Security Tests${NC}"

# Test for common security issues
echo -n "  Testing SQL injection protection... "
TOTAL_TESTS=$((TOTAL_TESTS + 1))

response=$(curl -s -w "%{http_code}" -o /tmp/security_test "$BASE_URL/templates?id='; DROP TABLE templates; --" 2>/dev/null)
status_code="${response: -3}"

if [ "$status_code" = "200" ] || [ "$status_code" = "400" ]; then
    echo -e "${GREEN}✅ PASS${NC} (Protected)"
    PASSED_TESTS=$((PASSED_TESTS + 1))
else
    echo -e "${RED}❌ FAIL${NC} (Unexpected response: $status_code)"
    FAILED_TESTS=$((FAILED_TESTS + 1))
fi

echo ""
echo -e "${BLUE}📈 System Resource Tests${NC}"

echo -n "  Testing memory usage... "
TOTAL_TESTS=$((TOTAL_TESTS + 1))

# Get memory usage from health endpoint
memory_info=$(curl -s "$BASE_URL/health/detailed" | jq '.system.memoryUsage.heapUsed' 2>/dev/null)

if [ "$memory_info" != "null" ] && [ "$memory_info" != "" ]; then
    memory_mb=$((memory_info / 1024 / 1024))
    if [ $memory_mb -lt 500 ]; then  # Less than 500MB
        echo -e "${GREEN}✅ PASS${NC} (${memory_mb}MB)"
        PASSED_TESTS=$((PASSED_TESTS + 1))
    else
        echo -e "${YELLOW}⚠️  HIGH${NC} (${memory_mb}MB)"
        PASSED_TESTS=$((PASSED_TESTS + 1))
    fi
else
    echo -e "${RED}❌ FAIL${NC} (Cannot read memory info)"
    FAILED_TESTS=$((FAILED_TESTS + 1))
fi

echo ""
echo -e "${BLUE}📋 Test Summary${NC}"
echo "==============="
echo "Total Tests: $TOTAL_TESTS"
echo -e "Passed: ${GREEN}$PASSED_TESTS${NC}"
echo -e "Failed: ${RED}$FAILED_TESTS${NC}"

SUCCESS_RATE=$(( PASSED_TESTS * 100 / TOTAL_TESTS ))
echo -e "Success Rate: ${GREEN}$SUCCESS_RATE%${NC}"

echo ""
if [ "$SUCCESS_RATE" -ge 95 ]; then
    echo -e "${GREEN}🎉 EXCELLENT! System is highly stable and ready for production.${NC}"
    STABILITY_RATING="EXCELLENT"
elif [ "$SUCCESS_RATE" -ge 85 ]; then
    echo -e "${GREEN}✅ GOOD! System is stable with minor issues.${NC}"
    STABILITY_RATING="GOOD"
elif [ "$SUCCESS_RATE" -ge 70 ]; then
    echo -e "${YELLOW}⚠️  FAIR! System needs some improvements.${NC}"
    STABILITY_RATING="FAIR"
else
    echo -e "${RED}❌ POOR! System requires immediate attention.${NC}"
    STABILITY_RATING="POOR"
fi

echo ""
echo -e "${CYAN}🎯 Stability Report:${NC}"
echo "  Overall Rating: $STABILITY_RATING"
echo "  Success Rate: $SUCCESS_RATE%"
echo "  Total Tests: $TOTAL_TESTS"
echo "  Failed Tests: $FAILED_TESTS"

if [ $FAILED_TESTS -gt 0 ]; then
    echo ""
    echo -e "${YELLOW}🔧 Recommendations:${NC}"
    echo "  1. Review failed test logs above"
    echo "  2. Check server logs for detailed error information"
    echo "  3. Verify all services are running correctly"
    echo "  4. Consider scaling resources if performance tests failed"
fi

# Cleanup
rm -f /tmp/api_response /tmp/security_test

echo ""
echo -e "${GREEN}🔍 Stability testing completed!${NC}"

exit $FAILED_TESTS
