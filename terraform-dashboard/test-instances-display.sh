#!/bin/bash

# Test EC2 Instances Display and Refresh Functionality
echo "🔍 Testing EC2 Instances Display and Refresh"
echo "============================================="

BASE_URL="http://localhost:5000/api"
FRONTEND_URL="http://localhost:3000"

# Colors
GREEN='\033[0;32m'
RED='\033[0;31m'
BLUE='\033[0;34m'
YELLOW='\033[1;33m'
CYAN='\033[0;36m'
NC='\033[0m'

echo ""
echo -e "${BLUE}🔧 Testing Backend Instance API${NC}"

# Test instances endpoint
echo ""
echo -e "${CYAN}1. Fetching instances from API${NC}"
INSTANCES_RESPONSE=$(curl -s $BASE_URL/instances)
echo "Raw API Response:"
echo "$INSTANCES_RESPONSE" | jq '.'

echo ""
echo -e "${CYAN}2. Analyzing instance states${NC}"
TOTAL_INSTANCES=$(echo "$INSTANCES_RESPONSE" | jq 'length')
RUNNING_INSTANCES=$(echo "$INSTANCES_RESPONSE" | jq '[.[] | select(.state == "running")] | length')
STOPPED_INSTANCES=$(echo "$INSTANCES_RESPONSE" | jq '[.[] | select(.state == "stopped")] | length')
TERMINATED_INSTANCES=$(echo "$INSTANCES_RESPONSE" | jq '[.[] | select(.state == "terminated")] | length')

echo "📊 Instance Statistics:"
echo "  Total Instances: $TOTAL_INSTANCES"
echo "  Running: $RUNNING_INSTANCES"
echo "  Stopped: $STOPPED_INSTANCES"
echo "  Terminated: $TERMINATED_INSTANCES"

echo ""
echo -e "${CYAN}3. Running instances details${NC}"
if [ "$RUNNING_INSTANCES" -gt 0 ]; then
    echo -e "${GREEN}✅ Found $RUNNING_INSTANCES running instance(s):${NC}"
    echo "$INSTANCES_RESPONSE" | jq -r '.[] | select(.state == "running") | "  🖥️  \(.id) (\(.name)) - \(.type) - \(.state) - \(.publicIp)"'
else
    echo -e "${YELLOW}⚠️  No running instances found${NC}"
fi

echo ""
echo -e "${CYAN}4. All instances summary${NC}"
echo "$INSTANCES_RESPONSE" | jq -r '.[] | "  \(.state | if . == "running" then "🟢" elif . == "stopped" then "🟡" else "🔴" end) \(.id) (\(.name)) - \(.type) - \(.state)"'

echo ""
echo -e "${BLUE}🌐 Testing Frontend Instance Page${NC}"

# Test frontend accessibility
echo ""
echo -e "${CYAN}5. Frontend page accessibility${NC}"
FRONTEND_STATUS=$(curl -s -o /dev/null -w "%{http_code}" $FRONTEND_URL/instances)
if [ "$FRONTEND_STATUS" = "200" ]; then
    echo -e "  ✅ Instances page: ${GREEN}Accessible${NC} ($FRONTEND_URL/instances)"
else
    echo -e "  ❌ Instances page: ${RED}Not accessible${NC} ($FRONTEND_STATUS)"
fi

echo ""
echo -e "${CYAN}6. Testing API endpoint response time${NC}"
START_TIME=$(date +%s%N)
curl -s $BASE_URL/instances > /dev/null
END_TIME=$(date +%s%N)
RESPONSE_TIME=$(( (END_TIME - START_TIME) / 1000000 ))
echo "  ⏱️  API Response Time: ${RESPONSE_TIME}ms"

if [ "$RESPONSE_TIME" -lt 1000 ]; then
    echo -e "  ✅ ${GREEN}Fast response${NC}"
elif [ "$RESPONSE_TIME" -lt 3000 ]; then
    echo -e "  ⚠️  ${YELLOW}Moderate response${NC}"
else
    echo -e "  ❌ ${RED}Slow response${NC}"
fi

echo ""
echo -e "${BLUE}🔄 Testing Refresh Functionality${NC}"

echo ""
echo -e "${CYAN}7. Multiple API calls (simulating refresh)${NC}"
for i in {1..3}; do
    echo "  Refresh attempt $i:"
    START_TIME=$(date +%s%N)
    RESPONSE=$(curl -s $BASE_URL/instances)
    END_TIME=$(date +%s%N)
    RESPONSE_TIME=$(( (END_TIME - START_TIME) / 1000000 ))
    INSTANCE_COUNT=$(echo "$RESPONSE" | jq 'length')
    echo "    ✅ Got $INSTANCE_COUNT instances in ${RESPONSE_TIME}ms"
    sleep 1
done

echo ""
echo -e "${BLUE}🐛 Debugging Information${NC}"

echo ""
echo -e "${CYAN}8. Instance data structure validation${NC}"
echo "Checking if instances have required fields:"

# Check required fields
INSTANCES_WITH_ID=$(echo "$INSTANCES_RESPONSE" | jq '[.[] | select(.id != null and .id != "")] | length')
INSTANCES_WITH_NAME=$(echo "$INSTANCES_RESPONSE" | jq '[.[] | select(.name != null and .name != "")] | length')
INSTANCES_WITH_STATE=$(echo "$INSTANCES_RESPONSE" | jq '[.[] | select(.state != null and .state != "")] | length')

echo "  ✅ Instances with ID: $INSTANCES_WITH_ID/$TOTAL_INSTANCES"
echo "  ✅ Instances with Name: $INSTANCES_WITH_NAME/$TOTAL_INSTANCES"
echo "  ✅ Instances with State: $INSTANCES_WITH_STATE/$TOTAL_INSTANCES"

echo ""
echo -e "${CYAN}9. Sample instance data structure${NC}"
echo "First instance structure:"
echo "$INSTANCES_RESPONSE" | jq '.[0]' 2>/dev/null || echo "No instances found"

echo ""
echo -e "${BLUE}📋 Troubleshooting Guide${NC}"

if [ "$RUNNING_INSTANCES" -eq 0 ]; then
    echo ""
    echo -e "${YELLOW}⚠️  No running instances detected${NC}"
    echo "Possible reasons:"
    echo "  1. All instances are stopped or terminated"
    echo "  2. Instances are in a different AWS region"
    echo "  3. AWS credentials don't have access to running instances"
    echo ""
    echo "To see running instances:"
    echo "  1. Start an existing stopped instance"
    echo "  2. Launch a new EC2 instance"
    echo "  3. Check the correct AWS region is configured"
else
    echo ""
    echo -e "${GREEN}✅ Running instances detected${NC}"
    echo "If instances are not showing in the frontend:"
    echo "  1. Check browser console for JavaScript errors"
    echo "  2. Verify the refresh button is working"
    echo "  3. Clear browser cache and reload"
    echo "  4. Check network tab for failed API calls"
fi

echo ""
echo -e "${CYAN}🎮 Manual Testing Steps${NC}"
echo "To test the refresh functionality manually:"
echo "  1. Open: $FRONTEND_URL/instances"
echo "  2. Open browser developer tools (F12)"
echo "  3. Go to Console tab"
echo "  4. Click the refresh button (🔄)"
echo "  5. Look for console logs showing:"
echo "     - 'Refresh button clicked'"
echo "     - 'Loaded X real EC2 instances'"
echo "     - 'Running instances: X'"

echo ""
echo -e "${GREEN}🔧 Instance display test completed!${NC}"

if [ "$RUNNING_INSTANCES" -gt 0 ]; then
    echo -e "${GREEN}✅ You have $RUNNING_INSTANCES running instance(s) that should be visible${NC}"
else
    echo -e "${YELLOW}⚠️  No running instances to display (this is normal if all instances are stopped)${NC}"
fi
