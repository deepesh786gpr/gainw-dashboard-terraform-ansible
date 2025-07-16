#!/usr/bin/env node

const axios = require('axios');
const fs = require('fs');
const path = require('path');

const BASE_URL = 'http://localhost:5000';
const FRONTEND_URL = 'http://localhost:3000';
const ANSIBLE_URL = 'http://localhost:5001';

// Test results storage
const testResults = {
  passed: 0,
  failed: 0,
  total: 0,
  details: []
};

// Helper function to log test results
function logTest(name, success, message, data = null) {
  testResults.total++;
  if (success) {
    testResults.passed++;
    console.log(`✅ ${name}: ${message}`);
  } else {
    testResults.failed++;
    console.log(`❌ ${name}: ${message}`);
  }
  
  testResults.details.push({
    name,
    success,
    message,
    data,
    timestamp: new Date().toISOString()
  });
}

// Helper function to make authenticated requests
async function makeAuthenticatedRequest(url, token, method = 'GET', data = null) {
  const config = {
    method,
    url,
    headers: {
      'Authorization': `Bearer ${token}`,
      'Content-Type': 'application/json'
    },
    timeout: 10000
  };
  
  if (data) {
    config.data = data;
  }
  
  return axios(config);
}

async function testAllAPIs() {
  console.log('🚀 COMPREHENSIVE TERRAFORM DASHBOARD API TESTING');
  console.log('=' .repeat(60));
  console.log(`📅 Test Date: ${new Date().toISOString()}`);
  console.log(`🌐 Backend URL: ${BASE_URL}`);
  console.log(`🖥️ Frontend URL: ${FRONTEND_URL}`);
  console.log(`🎭 Ansible URL: ${ANSIBLE_URL}`);
  console.log('=' .repeat(60));

  let adminToken = null;
  let userToken = null;
  let demoToken = null;

  try {
    // ==========================================
    // 1. BASIC CONNECTIVITY TESTS
    // ==========================================
    console.log('\n🔌 1. BASIC CONNECTIVITY TESTS');
    console.log('-' .repeat(40));

    try {
      const healthResponse = await axios.get(`${BASE_URL}/health`, { timeout: 5000 });
      logTest('Backend Health', true, `Server running: ${healthResponse.data.message}`);
    } catch (error) {
      logTest('Backend Health', false, `Server not responding: ${error.message}`);
      return;
    }

    try {
      const frontendResponse = await axios.get(FRONTEND_URL, { timeout: 5000 });
      logTest('Frontend Health', true, 'Frontend accessible');
    } catch (error) {
      logTest('Frontend Health', false, `Frontend not accessible: ${error.message}`);
    }

    try {
      const ansibleResponse = await axios.get(`${ANSIBLE_URL}/health`, { timeout: 5000 });
      logTest('Ansible API Health', true, 'Ansible API accessible');
    } catch (error) {
      logTest('Ansible API Health', false, `Ansible API not accessible: ${error.message}`);
    }

    // ==========================================
    // 2. AUTHENTICATION TESTS
    // ==========================================
    console.log('\n🔐 2. AUTHENTICATION TESTS');
    console.log('-' .repeat(40));

    // Test Admin Login
    try {
      const adminLogin = await axios.post(`${BASE_URL}/api/auth/login`, {
        username: 'admin',
        password: 'admin123'
      });
      adminToken = adminLogin.data.token;
      const adminUser = adminLogin.data.user;
      logTest('Admin Login', true, `Admin authenticated: ${adminUser.role.permissions.length} permissions`);
    } catch (error) {
      logTest('Admin Login', false, `Admin login failed: ${error.message}`);
    }

    // Test User Login
    try {
      const userLogin = await axios.post(`${BASE_URL}/api/auth/login`, {
        username: 'user',
        password: 'user123'
      });
      userToken = userLogin.data.token;
      const user = userLogin.data.user;
      logTest('User Login', true, `User authenticated: ${user.role.permissions.length} permissions`);
    } catch (error) {
      logTest('User Login', false, `User login failed: ${error.message}`);
    }

    // Test Demo Login
    try {
      const demoLogin = await axios.post(`${BASE_URL}/api/auth/login`, {
        username: 'demo',
        password: 'demo123'
      });
      demoToken = demoLogin.data.token;
      const demoUser = demoLogin.data.user;
      logTest('Demo Login', true, `Demo authenticated: ${demoUser.role.permissions.length} permissions`);
    } catch (error) {
      logTest('Demo Login', false, `Demo login failed: ${error.message}`);
    }

    // Test Invalid Login
    try {
      await axios.post(`${BASE_URL}/api/auth/login`, {
        username: 'invalid',
        password: 'invalid'
      });
      logTest('Invalid Login', false, 'Invalid login should have failed');
    } catch (error) {
      logTest('Invalid Login', true, 'Invalid login properly rejected');
    }

    // ==========================================
    // 3. PROTECTED ENDPOINT TESTS
    // ==========================================
    console.log('\n🛡️ 3. PROTECTED ENDPOINT TESTS');
    console.log('-' .repeat(40));

    if (adminToken) {
      // Test VPC Resources
      try {
        const vpcResponse = await makeAuthenticatedRequest(`${BASE_URL}/api/vpc-resources`, adminToken);
        const vpcs = vpcResponse.data;
        logTest('VPC Resources', true, `Retrieved ${vpcs.length} VPCs with detailed resources`);
      } catch (error) {
        logTest('VPC Resources', false, `VPC fetch failed: ${error.message}`);
      }

      // Test Instances
      try {
        const instancesResponse = await makeAuthenticatedRequest(`${BASE_URL}/api/instances`, adminToken);
        const instances = instancesResponse.data;
        logTest('EC2 Instances', true, `Retrieved ${instances.length} instances`);
      } catch (error) {
        logTest('EC2 Instances', false, `Instances fetch failed: ${error.message}`);
      }

      // Test Deployments
      try {
        const deploymentsResponse = await makeAuthenticatedRequest(`${BASE_URL}/api/deployments`, adminToken);
        const deployments = deploymentsResponse.data;
        logTest('Deployments', true, `Retrieved ${deployments.length} deployments`);
      } catch (error) {
        logTest('Deployments', false, `Deployments fetch failed: ${error.message}`);
      }

      // Test Templates
      try {
        const templatesResponse = await makeAuthenticatedRequest(`${BASE_URL}/api/templates`, adminToken);
        const templates = templatesResponse.data;
        logTest('Templates', true, `Retrieved ${templates.length} templates`);
      } catch (error) {
        logTest('Templates', false, `Templates fetch failed: ${error.message}`);
      }

      // Test Current User
      try {
        const meResponse = await makeAuthenticatedRequest(`${BASE_URL}/api/auth/me`, adminToken);
        const currentUser = meResponse.data.user;
        logTest('Current User', true, `Retrieved user info: ${currentUser.username}`);
      } catch (error) {
        logTest('Current User', false, `User info fetch failed: ${error.message}`);
      }
    }

    // ==========================================
    // 4. PERMISSION-BASED ACCESS TESTS
    // ==========================================
    console.log('\n🔑 4. PERMISSION-BASED ACCESS TESTS');
    console.log('-' .repeat(40));

    // Test with different user roles
    const tokens = [
      { name: 'Admin', token: adminToken },
      { name: 'User', token: userToken },
      { name: 'Demo', token: demoToken }
    ];

    for (const { name, token } of tokens) {
      if (token) {
        try {
          const response = await makeAuthenticatedRequest(`${BASE_URL}/api/vpc-resources`, token);
          logTest(`${name} VPC Access`, true, `${name} can access VPC resources`);
        } catch (error) {
          logTest(`${name} VPC Access`, false, `${name} cannot access VPC resources: ${error.response?.status}`);
        }
      }
    }

    // ==========================================
    // 5. ANSIBLE API TESTS
    // ==========================================
    console.log('\n🎭 5. ANSIBLE API TESTS');
    console.log('-' .repeat(40));

    try {
      const playbooksResponse = await axios.get(`${ANSIBLE_URL}/playbooks`, { timeout: 5000 });
      logTest('Ansible Playbooks', true, `Retrieved ${playbooksResponse.data.length || 0} playbooks`);
    } catch (error) {
      logTest('Ansible Playbooks', false, `Playbooks fetch failed: ${error.message}`);
    }

    // ==========================================
    // 6. ERROR HANDLING TESTS
    // ==========================================
    console.log('\n⚠️ 6. ERROR HANDLING TESTS');
    console.log('-' .repeat(40));

    // Test unauthorized access
    try {
      await axios.get(`${BASE_URL}/api/vpc-resources`);
      logTest('Unauthorized Access', false, 'Should require authentication');
    } catch (error) {
      logTest('Unauthorized Access', true, 'Properly requires authentication');
    }

    // Test invalid token
    try {
      await makeAuthenticatedRequest(`${BASE_URL}/api/vpc-resources`, 'invalid-token');
      logTest('Invalid Token', false, 'Should reject invalid token');
    } catch (error) {
      logTest('Invalid Token', true, 'Properly rejects invalid token');
    }

    // Test non-existent endpoint
    try {
      await makeAuthenticatedRequest(`${BASE_URL}/api/non-existent`, adminToken);
      logTest('Non-existent Endpoint', false, 'Should return 404');
    } catch (error) {
      logTest('Non-existent Endpoint', true, `Properly returns 404: ${error.response?.status}`);
    }

  } catch (error) {
    console.error('❌ Critical test failure:', error.message);
  }

  // ==========================================
  // 7. GENERATE TEST REPORT
  // ==========================================
  console.log('\n📊 TEST RESULTS SUMMARY');
  console.log('=' .repeat(60));
  console.log(`✅ Passed: ${testResults.passed}`);
  console.log(`❌ Failed: ${testResults.failed}`);
  console.log(`📊 Total: ${testResults.total}`);
  console.log(`📈 Success Rate: ${((testResults.passed / testResults.total) * 100).toFixed(1)}%`);

  // Save detailed report
  const reportPath = path.join(__dirname, 'test-report.json');
  fs.writeFileSync(reportPath, JSON.stringify(testResults, null, 2));
  console.log(`📄 Detailed report saved: ${reportPath}`);

  if (testResults.failed === 0) {
    console.log('\n🎉 ALL TESTS PASSED! The application is ready for deployment.');
  } else {
    console.log('\n⚠️ Some tests failed. Please review the issues before deployment.');
    process.exit(1);
  }
}

// Run the comprehensive test suite
testAllAPIs().catch(error => {
  console.error('💥 Test suite crashed:', error.message);
  process.exit(1);
});
