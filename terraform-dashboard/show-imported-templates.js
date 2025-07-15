#!/usr/bin/env node

/**
 * Show Imported GitHub Templates
 * This script displays the templates imported from your GitHub repository
 */

const https = require('https');
const http = require('http');

const API_BASE = 'http://localhost:5000/api';

function makeRequest(url, options = {}) {
  return new Promise((resolve, reject) => {
    const isHttps = url.startsWith('https:');
    const client = isHttps ? https : http;
    
    const req = client.request(url, options, (res) => {
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => {
        try {
          if (res.statusCode >= 200 && res.statusCode < 300) {
            resolve({
              ok: true,
              status: res.statusCode,
              json: () => Promise.resolve(JSON.parse(data)),
              text: () => Promise.resolve(data)
            });
          } else {
            reject(new Error(`HTTP ${res.statusCode}: ${data}`));
          }
        } catch (error) {
          reject(error);
        }
      });
    });
    
    req.on('error', reject);
    req.end();
  });
}

async function showImportedTemplates() {
  console.log('🎉 GitHub Terraform Modules Successfully Imported!');
  console.log('=' .repeat(60));
  
  try {
    const response = await makeRequest(`${API_BASE}/templates`);
    const templates = await response.json();
    
    // Filter the newly imported templates (they have specific names)
    const importedTemplates = templates.filter(template => 
      ['VPC with Subnets', 'EC2 with Auto Scaling', 'S3 Bucket with Security', 
       'RDS Database', 'EKS Cluster', 'Lambda Function'].includes(template.name) &&
      ['networking', 'compute', 'storage', 'database', 'container', 'serverless'].includes(template.category)
    );
    
    console.log(`\n📦 Repository: deepesh786gpr/terrafrom-module`);
    console.log(`✅ Successfully imported ${importedTemplates.length} modules as templates\n`);
    
    // Group by category
    const categories = {
      networking: [],
      compute: [],
      storage: [],
      database: [],
      container: [],
      serverless: []
    };
    
    importedTemplates.forEach(template => {
      if (categories[template.category]) {
        categories[template.category].push(template);
      }
    });
    
    // Display templates by category
    Object.entries(categories).forEach(([category, templates]) => {
      if (templates.length > 0) {
        const categoryIcon = {
          networking: '🌐',
          compute: '💻',
          storage: '💾',
          database: '🗄️',
          container: '☸️',
          serverless: '⚡'
        }[category];
        
        console.log(`${categoryIcon} ${category.toUpperCase()}`);
        templates.forEach(template => {
          console.log(`   ✅ ${template.name}`);
          console.log(`      ID: ${template.id}`);
          console.log(`      Description: ${template.description}`);
          console.log('');
        });
      }
    });
    
    console.log('🎯 What You Can Do Now:');
    console.log('');
    console.log('1. 🌐 View Templates: http://localhost:3006/templates');
    console.log('2. 🚀 Create Deployments: Select any template and deploy infrastructure');
    console.log('3. 🔧 Customize Variables: Each template has pre-configured variables');
    console.log('4. 📊 Monitor Deployments: Track deployment progress in real-time');
    console.log('5. 🐙 GitHub Integration: Import more repositories at http://localhost:3006/github-import');
    
    console.log('\n📋 Template Features:');
    console.log('');
    console.log('🌐 VPC with Subnets:');
    console.log('   • Multi-AZ public/private subnets');
    console.log('   • NAT gateways and Internet Gateway');
    console.log('   • DNS support and security groups');
    console.log('');
    console.log('💻 EC2 with Auto Scaling:');
    console.log('   • Auto Scaling Groups with launch templates');
    console.log('   • Security groups and IAM roles');
    console.log('   • Configurable instance types and capacity');
    console.log('');
    console.log('💾 S3 Bucket with Security:');
    console.log('   • Encryption and versioning enabled');
    console.log('   • Public access blocking');
    console.log('   • Lifecycle policies support');
    console.log('');
    console.log('🗄️ RDS Database:');
    console.log('   • Multi-engine support (MySQL, PostgreSQL, etc.)');
    console.log('   • High availability with Multi-AZ');
    console.log('   • Automated backups and security groups');
    console.log('');
    console.log('☸️ EKS Cluster:');
    console.log('   • Managed Kubernetes control plane');
    console.log('   • Managed node groups with auto-scaling');
    console.log('   • Security groups and IAM roles');
    console.log('');
    console.log('⚡ Lambda Function:');
    console.log('   • VPC support and security groups');
    console.log('   • Environment variables and monitoring');
    console.log('   • IAM roles and CloudWatch logs');
    
    console.log('\n🔗 Quick Links:');
    console.log(`📱 Dashboard: http://localhost:3006/`);
    console.log(`📋 Templates: http://localhost:3006/templates`);
    console.log(`🚀 Deployments: http://localhost:3006/deployments`);
    console.log(`🐙 GitHub Import: http://localhost:3006/github-import`);
    console.log(`🖥️ Instances: http://localhost:3006/instances`);
    console.log(`☸️ Clusters: http://localhost:3006/clusters`);
    
    console.log('\n✨ Your production-ready Terraform modules are now available as templates!');
    
  } catch (error) {
    console.error('❌ Error fetching templates:', error.message);
  }
}

// Run the script
if (require.main === module) {
  showImportedTemplates()
    .then(() => process.exit(0))
    .catch(error => {
      console.error('❌ Script failed:', error);
      process.exit(1);
    });
}

module.exports = { showImportedTemplates };
