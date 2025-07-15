const fetch = (...args) => import('node-fetch').then(({default: fetch}) => fetch(...args));

// Test configuration
const BASE_URL = 'http://localhost:5000/api';
const FRONTEND_URL = 'http://localhost:3000';

// Test functions
async function testServerHealth() {
  console.log('\n🔍 Testing server health...');
  try {
    const response = await fetch(`${BASE_URL}/health`);
    if (response.ok) {
      const data = await response.json();
      console.log('✅ Server is healthy:', data.status);
      return true;
    }
  } catch (error) {
    console.error('❌ Server health check failed:', error.message);
    return false;
  }
}

async function testTemplates() {
  console.log('\n📋 Testing templates...');
  try {
    const response = await fetch(`${BASE_URL}/templates`);
    if (response.ok) {
      const templates = await response.json();
      console.log(`✅ Found ${templates.length} templates:`);
      
      const templateNames = templates.map(t => t.name);
      const expectedTemplates = ['EKS Cluster', 'RDS Database', 'Lambda Function'];
      
      for (const expected of expectedTemplates) {
        if (templateNames.includes(expected)) {
          console.log(`  ✅ ${expected} template found`);
        } else {
          console.log(`  ❌ ${expected} template missing`);
        }
      }
      
      return templates;
    }
  } catch (error) {
    console.error('❌ Template test failed:', error.message);
    return [];
  }
}

async function testInstances() {
  console.log('\n🖥️  Testing instances...');
  try {
    const response = await fetch(`${BASE_URL}/instances`);
    if (response.ok) {
      const instances = await response.json();
      console.log(`✅ Found ${instances.length} instances`);
      
      // Test instance details
      if (instances.length > 0) {
        const instanceId = instances[0].id;
        const detailsResponse = await fetch(`${BASE_URL}/instances/${instanceId}/details`);
        if (detailsResponse.ok) {
          const details = await detailsResponse.json();
          console.log(`✅ Instance details retrieved for ${instanceId}`);
          console.log(`  - Name: ${details.name}`);
          console.log(`  - Type: ${details.type}`);
          console.log(`  - State: ${details.state}`);
          console.log(`  - Tags: ${Object.keys(details.tags).length} tags`);
        }
      }
      
      return instances;
    }
  } catch (error) {
    console.error('❌ Instance test failed:', error.message);
    return [];
  }
}

async function testInstanceModification() {
  console.log('\n🔧 Testing instance modification...');
  try {
    const instanceId = 'i-0e43e6683baf16e35';
    
    // Test modification
    const modifications = {
      instanceType: 't3.medium',
      monitoring: true,
      tags: {
        'TestTag': 'TestValue',
        'ModifiedBy': 'AutomatedTest'
      }
    };
    
    const response = await fetch(`${BASE_URL}/instances/${instanceId}/modify`, {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(modifications),
    });
    
    if (response.ok) {
      const result = await response.json();
      console.log('✅ Instance modification successful');
      console.log(`  - Message: ${result.message}`);
      console.log(`  - Modifications: ${result.modifications.length} changes`);
      return true;
    }
  } catch (error) {
    console.error('❌ Instance modification test failed:', error.message);
    return false;
  }
}

async function testDeployment() {
  console.log('\n🚀 Testing deployment functionality...');
  try {
    // Get templates first
    const templatesResponse = await fetch(`${BASE_URL}/templates`);
    const templates = await templatesResponse.json();
    
    if (templates.length === 0) {
      console.log('❌ No templates available for deployment test');
      return false;
    }
    
    // Test with EKS template
    const eksTemplate = templates.find(t => t.name === 'EKS Cluster');
    if (eksTemplate) {
      const deploymentData = {
        templateId: eksTemplate.id,
        name: 'test-eks-cluster',
        environment: 'development',
        variables: {
          cluster_name: 'test-cluster',
          kubernetes_version: '1.28',
          environment: 'dev'
        }
      };
      
      const response = await fetch(`${BASE_URL}/deployments`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(deploymentData),
      });
      
      if (response.ok) {
        const result = await response.json();
        console.log('✅ EKS deployment test successful');
        console.log(`  - Deployment ID: ${result.id}`);
        return true;
      }
    }
    
    console.log('❌ EKS template not found for deployment test');
    return false;
  } catch (error) {
    console.error('❌ Deployment test failed:', error.message);
    return false;
  }
}

async function testFrontendAccess() {
  console.log('\n🌐 Testing frontend access...');
  try {
    const response = await fetch(FRONTEND_URL);
    if (response.ok) {
      console.log('✅ Frontend is accessible');
      return true;
    }
  } catch (error) {
    console.error('❌ Frontend access test failed:', error.message);
    return false;
  }
}

// Main test execution
async function runAllTests() {
  console.log('🧪 Starting comprehensive functionality tests...');
  console.log('=' .repeat(50));
  
  const results = {
    serverHealth: await testServerHealth(),
    templates: await testTemplates(),
    instances: await testInstances(),
    instanceModification: await testInstanceModification(),
    deployment: await testDeployment(),
    frontendAccess: await testFrontendAccess(),
  };
  
  console.log('\n📊 Test Results Summary:');
  console.log('=' .repeat(50));
  
  let passedTests = 0;
  let totalTests = 0;
  
  for (const [testName, result] of Object.entries(results)) {
    totalTests++;
    if (result) {
      passedTests++;
      console.log(`✅ ${testName}: PASSED`);
    } else {
      console.log(`❌ ${testName}: FAILED`);
    }
  }
  
  console.log('\n🎯 Overall Results:');
  console.log(`Tests Passed: ${passedTests}/${totalTests}`);
  console.log(`Success Rate: ${Math.round((passedTests / totalTests) * 100)}%`);
  
  if (passedTests === totalTests) {
    console.log('\n🎉 All tests passed! The Terraform Dashboard is fully functional.');
  } else {
    console.log('\n⚠️  Some tests failed. Please check the logs above.');
  }
}

// Run tests
runAllTests().catch(console.error);
