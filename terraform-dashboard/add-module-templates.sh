#!/bin/bash

# Script to add enhanced templates from your modules to the Terraform Dashboard

echo "🚀 Adding enhanced templates from your modules to Terraform Dashboard..."

# Function to add a template via API
add_template() {
    local template_file=$1
    local template_name=$(jq -r '.name' "$template_file")
    
    echo "📝 Adding template: $template_name"
    
    response=$(curl -s -X POST http://localhost:5000/api/templates \
        -H "Content-Type: application/json" \
        -d @"$template_file")
    
    if echo "$response" | jq -e '.id' > /dev/null 2>&1; then
        echo "✅ Successfully added: $template_name"
        echo "   Template ID: $(echo "$response" | jq -r '.id')"
    else
        echo "❌ Failed to add: $template_name"
        echo "   Error: $response"
    fi
    echo ""
}

# Check if backend is running
echo "🔍 Checking if backend is running..."
if ! curl -s http://localhost:5000/api/health > /dev/null; then
    echo "❌ Backend is not running. Please start the backend first:"
    echo "   cd backend && AWS_PROFILE=default npm run dev"
    exit 1
fi
echo "✅ Backend is running"
echo ""

# Add Enhanced EC2 Instance template
if [ -f "enhanced-ec2-template.json" ]; then
    add_template "enhanced-ec2-template.json"
else
    echo "❌ enhanced-ec2-template.json not found"
fi

# Add EBS Volume Management template
if [ -f "ebs-volume-template.json" ]; then
    add_template "ebs-volume-template.json"
else
    echo "⚠️  ebs-volume-template.json not found, creating it..."
    # We'll create this template in the next step
fi

# Add EC2 Operations template
if [ -f "ec2-operations-template.json" ]; then
    add_template "ec2-operations-template.json"
else
    echo "⚠️  ec2-operations-template.json not found, creating it..."
    # We'll create this template in the next step
fi

echo "🎉 Template addition process complete!"
echo ""
echo "📋 To view all templates, visit: http://localhost:3007/templates"
echo "🚀 To create a deployment, visit: http://localhost:3007/deployments"
