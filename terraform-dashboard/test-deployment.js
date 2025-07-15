#!/usr/bin/env node

// Test script to demonstrate real-time deployment functionality
const fetch = require('node-fetch');

async function testDeployment() {
  console.log('🚀 Testing Real-time Deployment Functionality\n');

  try {
    // 1. First, get available templates
    console.log('📋 Fetching available templates...');
    const templatesResponse = await fetch('http://localhost:5000/api/templates');
    const templates = await templatesResponse.json();
    
    if (templates.length === 0) {
      console.log('❌ No templates found. Creating a test template...');
      
      // Create a test template
      const templateData = {
        name: 'Test EC2 Instance',
        description: 'A test EC2 instance template for demo',
        category: 'Compute',
        terraformCode: `resource "aws_instance" "main" {
  ami           = "ami-0c02fb55956c7d316"
  instance_type = var.instance_type
  
  tags = {
    Name = var.name
    Environment = var.environment
  }
}

output "instance_id" {
  value = aws_instance.main.id
}

output "public_ip" {
  value = aws_instance.main.public_ip
}`,
        variables: [
          {
            name: 'name',
            type: 'string',
            description: 'Name for the EC2 instance',
            required: true
          },
          {
            name: 'instance_type',
            type: 'string',
            description: 'EC2 instance type',
            required: true,
            default: 't3.micro'
          },
          {
            name: 'environment',
            type: 'string',
            description: 'Environment (dev, staging, prod)',
            required: true,
            default: 'dev'
          }
        ]
      };

      const createTemplateResponse = await fetch('http://localhost:5000/api/templates', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(templateData)
      });

      const newTemplate = await createTemplateResponse.json();
      console.log(`✅ Created template: ${newTemplate.name} (ID: ${newTemplate.id})\n`);
      templates.push(newTemplate);
    }

    const template = templates[0];
    console.log(`📋 Using template: ${template.name} (ID: ${template.id})\n`);

    // 2. Create a new deployment
    console.log('🚀 Creating new deployment...');
    const deploymentData = {
      name: `test-deployment-${Date.now()}`,
      templateId: template.id,
      environment: 'development',
      variables: {
        name: 'demo-instance',
        instance_type: 't3.micro',
        environment: 'dev'
      }
    };

    const deploymentResponse = await fetch('http://localhost:5000/api/deployments', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(deploymentData)
    });

    const deployment = await deploymentResponse.json();
    console.log(`✅ Created deployment: ${deployment.name} (ID: ${deployment.id})`);
    console.log(`📊 Initial status: ${deployment.status}\n`);

    // 3. Poll for real-time updates
    console.log('⏱️  Monitoring deployment progress (real-time updates)...\n');
    
    let previousStatus = '';
    let previousLogCount = 0;
    let attempts = 0;
    const maxAttempts = 30; // 1 minute max

    while (attempts < maxAttempts) {
      try {
        const statusResponse = await fetch(`http://localhost:5000/api/deployments/${deployment.id}`);
        const currentDeployment = await statusResponse.json();
        
        // Show status changes
        if (currentDeployment.status !== previousStatus) {
          console.log(`📊 Status changed: ${previousStatus || 'none'} → ${currentDeployment.status}`);
          previousStatus = currentDeployment.status;
        }

        // Show new logs
        const logs = JSON.parse(currentDeployment.logs || '[]');
        if (logs.length > previousLogCount) {
          const newLogs = logs.slice(previousLogCount);
          newLogs.forEach(log => {
            console.log(`📝 ${log}`);
          });
          previousLogCount = logs.length;
        }

        // Check if deployment is complete
        if (currentDeployment.status === 'success') {
          console.log('\n🎉 Deployment completed successfully!');
          console.log('✅ Real-time deployment functionality is working correctly!\n');
          
          // Show final deployment details
          console.log('📋 Final Deployment Details:');
          console.log(`   Name: ${currentDeployment.name}`);
          console.log(`   Status: ${currentDeployment.status}`);
          console.log(`   Environment: ${currentDeployment.environment}`);
          console.log(`   Template: ${currentDeployment.template_name}`);
          console.log(`   Variables: ${JSON.stringify(JSON.parse(currentDeployment.variables), null, 2)}`);
          break;
        } else if (currentDeployment.status === 'error') {
          console.log('\n❌ Deployment failed!');
          console.log('📝 Final logs:');
          logs.forEach(log => console.log(`   ${log}`));
          break;
        }

        // Wait 2 seconds before next poll
        await new Promise(resolve => setTimeout(resolve, 2000));
        attempts++;
        
      } catch (error) {
        console.error('❌ Error polling deployment status:', error.message);
        break;
      }
    }

    if (attempts >= maxAttempts) {
      console.log('\n⏰ Polling timeout reached. Deployment may still be in progress.');
    }

    // 4. Show all deployments
    console.log('\n📋 All Deployments:');
    const allDeploymentsResponse = await fetch('http://localhost:5000/api/deployments');
    const allDeployments = await allDeploymentsResponse.json();
    
    allDeployments.forEach((dep, index) => {
      console.log(`   ${index + 1}. ${dep.name} - ${dep.status} (${dep.environment})`);
    });

  } catch (error) {
    console.error('❌ Test failed:', error.message);
  }
}

// Run the test
console.log('🧪 Terraform Dashboard - Real-time Deployment Test\n');
console.log('This test will:');
console.log('1. Create a template (if none exists)');
console.log('2. Create a new deployment');
console.log('3. Monitor real-time progress');
console.log('4. Show final results\n');

testDeployment().catch(console.error);
