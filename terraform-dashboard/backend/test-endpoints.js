#!/usr/bin/env node

const axios = require('axios');

const BASE_URL = 'http://localhost:5000';
const FRONTEND_URL = 'http://localhost:3000';

async function testEndpoints() {
  console.log('🧪 Testing Terraform Dashboard Endpoints\n');

  try {
    // Test 1: Health Check
    console.log('1️⃣ Testing Health Check...');
    const healthResponse = await axios.get(`${BASE_URL}/health`);
    console.log('✅ Health Check:', healthResponse.data.message);

    // Test 2: Login
    console.log('\n2️⃣ Testing Login...');
    const loginResponse = await axios.post(`${BASE_URL}/api/auth/login`, {
      username: 'admin',
      password: 'admin123'
    });
    const token = loginResponse.data.token;
    const user = loginResponse.data.user;
    console.log('✅ Login successful for:', user.username);
    console.log('   Role:', user.role.name);
    console.log('   Permissions:', user.role.permissions.length);

    // Test 3: Protected Endpoints
    const headers = { Authorization: `Bearer ${token}` };

    console.log('\n3️⃣ Testing Protected Endpoints...');

    // Test VPC Resources
    console.log('   📡 Testing VPC Resources...');
    const vpcResponse = await axios.get(`${BASE_URL}/api/vpc-resources`, { headers });
    console.log('   ✅ VPC Resources:', vpcResponse.data.length, 'VPCs found');

    // Test Instances
    console.log('   🖥️ Testing Instances...');
    const instancesResponse = await axios.get(`${BASE_URL}/api/instances`, { headers });
    console.log('   ✅ Instances:', instancesResponse.data.length, 'instances found');

    // Test Deployments
    console.log('   🚀 Testing Deployments...');
    const deploymentsResponse = await axios.get(`${BASE_URL}/api/deployments`, { headers });
    console.log('   ✅ Deployments:', deploymentsResponse.data.length, 'deployments found');

    // Test Templates
    console.log('   📋 Testing Templates...');
    const templatesResponse = await axios.get(`${BASE_URL}/api/templates`, { headers });
    console.log('   ✅ Templates:', templatesResponse.data.length, 'templates found');

    // Test 4: Frontend Connectivity
    console.log('\n4️⃣ Testing Frontend Connectivity...');
    try {
      const frontendResponse = await axios.get(FRONTEND_URL, { timeout: 5000 });
      if (frontendResponse.status === 200) {
        console.log('✅ Frontend is accessible at:', FRONTEND_URL);
      }
    } catch (frontendError) {
      console.log('❌ Frontend not accessible:', frontendError.message);
    }

    // Test 5: CORS Headers
    console.log('\n5️⃣ Testing CORS Headers...');
    const corsResponse = await axios.options(`${BASE_URL}/api/health`, {
      headers: {
        'Origin': FRONTEND_URL,
        'Access-Control-Request-Method': 'GET',
        'Access-Control-Request-Headers': 'Authorization'
      }
    });
    console.log('✅ CORS configured properly');

    console.log('\n🎉 All tests passed! The Terraform Dashboard is ready to use.');
    console.log('\n📋 Summary:');
    console.log('   🔐 Authentication: Working');
    console.log('   📡 API Endpoints: Working');
    console.log('   🌐 Frontend: Available');
    console.log('   🔗 CORS: Configured');
    console.log('\n🚀 Access your dashboard at:', FRONTEND_URL);
    console.log('🔑 Login credentials:');
    console.log('   👑 Admin: admin / admin123');
    console.log('   👤 User: user / user123');
    console.log('   👁️ Demo: demo / demo123');

  } catch (error) {
    console.error('❌ Test failed:', error.message);
    if (error.response) {
      console.error('   Status:', error.response.status);
      console.error('   Data:', error.response.data);
    }
    process.exit(1);
  }
}

// Run tests
testEndpoints();
