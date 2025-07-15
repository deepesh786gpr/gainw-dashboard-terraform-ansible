const http = require('http');

// Simple template for testing
const testTemplate = {
  name: "Test EC2 Instance",
  description: "Simple test template to verify API is working",
  category: "Compute",
  terraformCode: `resource "aws_instance" "test" {
  ami           = var.ami_id
  instance_type = var.instance_type
  
  tags = {
    Name = var.name
  }
}`,
  variables: [
    {"name": "name", "type": "string", "description": "Instance name", "required": true},
    {"name": "instance_type", "type": "string", "description": "Instance type", "required": false, "default": "t3.micro"},
    {"name": "ami_id", "type": "string", "description": "AMI ID", "required": false, "default": "ami-0c02fb55956c7d316"}
  ]
};

// Function to make HTTP POST request
function postTemplate(template) {
  return new Promise((resolve, reject) => {
    const data = JSON.stringify(template);
    
    const options = {
      hostname: 'localhost',
      port: 5000,
      path: '/api/templates',
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Content-Length': Buffer.byteLength(data)
      }
    };

    const req = http.request(options, (res) => {
      let responseData = '';
      
      res.on('data', (chunk) => {
        responseData += chunk;
      });
      
      res.on('end', () => {
        if (res.statusCode >= 200 && res.statusCode < 300) {
          console.log('✅ Template added successfully!');
          console.log('Response:', responseData);
          resolve(responseData);
        } else {
          console.error(`❌ Failed to add template. Status: ${res.statusCode}`);
          console.error('Response:', responseData);
          reject(new Error(`HTTP ${res.statusCode}: ${responseData}`));
        }
      });
    });

    req.on('error', (error) => {
      console.error('❌ Request error:', error.message);
      reject(error);
    });

    req.write(data);
    req.end();
  });
}

// Function to test health endpoint
function testHealth() {
  return new Promise((resolve, reject) => {
    const options = {
      hostname: 'localhost',
      port: 5000,
      path: '/api/health',
      method: 'GET'
    };

    const req = http.request(options, (res) => {
      let responseData = '';
      
      res.on('data', (chunk) => {
        responseData += chunk;
      });
      
      res.on('end', () => {
        if (res.statusCode === 200) {
          console.log('✅ Backend health check passed!');
          console.log('Response:', responseData);
          resolve(responseData);
        } else {
          console.error(`❌ Health check failed. Status: ${res.statusCode}`);
          reject(new Error(`HTTP ${res.statusCode}: ${responseData}`));
        }
      });
    });

    req.on('error', (error) => {
      console.error('❌ Health check error:', error.message);
      reject(error);
    });

    req.end();
  });
}

// Main function
async function main() {
  console.log('🔍 Testing Terraform Dashboard API...');
  
  try {
    // Test health first
    await testHealth();
    
    // Add test template
    console.log('📋 Adding test template...');
    await postTemplate(testTemplate);
    
    console.log('🎉 Test completed successfully!');
    console.log('');
    console.log('🌐 You can now:');
    console.log('   1. Open http://localhost:3007 in your browser');
    console.log('   2. Navigate to the Deployments page');
    console.log('   3. Click "New Deployment" to see the test template');
    
  } catch (error) {
    console.error('❌ Test failed:', error.message);
    process.exit(1);
  }
}

main();
