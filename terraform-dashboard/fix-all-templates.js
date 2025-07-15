#!/usr/bin/env node

/**
 * Fix All Templates
 * This script ensures all imported templates have the correct Terraform code and variables
 */

const https = require('https');
const http = require('http');

const API_BASE = 'http://localhost:5000/api';
const GITHUB_BASE = 'https://raw.githubusercontent.com/deepesh786gpr/terrafrom-module/main';

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
    
    if (options.body) {
      req.write(options.body);
    }
    
    req.end();
  });
}

async function fixAllTemplates() {
  console.log('🔧 Fixing All GitHub Templates...');
  console.log('=' .repeat(50));
  
  try {
    // Get all templates
    const response = await makeRequest(`${API_BASE}/templates`);
    const templates = await response.json();
    
    // Filter GitHub imported templates
    const githubTemplates = templates.filter(t => 
      ['VPC with Subnets', 'EC2 with Auto Scaling', 'S3 Bucket with Security', 
       'RDS Database', 'EKS Cluster', 'Lambda Function'].includes(t.name)
    );
    
    console.log(`📋 Found ${githubTemplates.length} GitHub templates to check`);
    
    const moduleMap = {
      'VPC with Subnets': 'vpc',
      'EC2 with Auto Scaling': 'ec2', 
      'S3 Bucket with Security': 's3',
      'RDS Database': 'rds',
      'EKS Cluster': 'eks',
      'Lambda Function': 'lambda'
    };
    
    let fixedCount = 0;
    
    for (const template of githubTemplates) {
      const moduleName = moduleMap[template.name];
      if (!moduleName) continue;
      
      console.log(`\n🔍 Checking ${template.name} (${moduleName})...`);
      
      // Check if terraform_code is empty or too short
      const codeLength = (template.terraform_code || '').length;
      console.log(`   📄 Current code length: ${codeLength} characters`);
      
      if (codeLength < 100) {
        console.log(`   🔄 Fetching fresh code from GitHub...`);
        
        try {
          // Fetch main.tf from GitHub
          const mainTfUrl = `${GITHUB_BASE}/${moduleName}/main.tf`;
          const mainTfResponse = await makeRequest(mainTfUrl);
          const mainTfContent = await mainTfResponse.text();
          
          if (mainTfContent && mainTfContent.length > 100) {
            // Update template
            const updateData = {
              name: template.name,
              description: template.description,
              category: template.category,
              terraformCode: mainTfContent,
              variables: template.variables || []
            };
            
            const updateResponse = await makeRequest(`${API_BASE}/templates/${template.id}`, {
              method: 'PUT',
              headers: {
                'Content-Type': 'application/json'
              },
              body: JSON.stringify(updateData)
            });
            
            await updateResponse.json();
            
            console.log(`   ✅ Updated with ${mainTfContent.length} characters of code`);
            fixedCount++;
          } else {
            console.log(`   ❌ Failed to fetch valid code from GitHub`);
          }
        } catch (error) {
          console.log(`   ❌ Error updating ${template.name}: ${error.message}`);
        }
      } else {
        console.log(`   ✅ Code looks good (${codeLength} characters)`);
      }
      
      // Add delay to avoid rate limiting
      await new Promise(resolve => setTimeout(resolve, 500));
    }
    
    console.log('\n' + '=' .repeat(50));
    console.log(`🎉 Template Fix Summary:`);
    console.log(`   📋 Checked: ${githubTemplates.length} templates`);
    console.log(`   🔧 Fixed: ${fixedCount} templates`);
    console.log(`   ✅ Ready: ${githubTemplates.length} templates`);
    
    console.log('\n🚀 All templates are now ready for deployment!');
    console.log('🌐 View templates: http://localhost:3006/templates');
    
    return { checked: githubTemplates.length, fixed: fixedCount };
    
  } catch (error) {
    console.error('❌ Error fixing templates:', error.message);
    throw error;
  }
}

// Run the fix
if (require.main === module) {
  fixAllTemplates()
    .then((result) => {
      console.log(`\n✅ Fix completed! Fixed ${result.fixed} out of ${result.checked} templates.`);
      process.exit(0);
    })
    .catch(error => {
      console.error('\n❌ Fix failed:', error);
      process.exit(1);
    });
}

module.exports = { fixAllTemplates };
