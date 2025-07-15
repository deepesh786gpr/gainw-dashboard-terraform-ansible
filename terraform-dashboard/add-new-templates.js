const fs = require('fs');
const path = require('path');

// Function to add templates to the database
async function addTemplates() {
  const templates = [
    {
      file: 'eks-template.json',
      name: 'EKS Cluster'
    },
    {
      file: 'rds-template.json', 
      name: 'RDS Database'
    },
    {
      file: 'lambda-template.json',
      name: 'Lambda Function'
    }
  ];

  for (const template of templates) {
    try {
      console.log(`\n📦 Adding ${template.name} template...`);
      
      // Read template file
      const templatePath = path.join(__dirname, template.file);
      if (!fs.existsSync(templatePath)) {
        console.error(`❌ Template file not found: ${template.file}`);
        continue;
      }

      const templateData = JSON.parse(fs.readFileSync(templatePath, 'utf8'));
      
      // Add template via API
      const response = await fetch('http://localhost:5000/api/templates', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(templateData),
      });

      if (response.ok) {
        const result = await response.json();
        console.log(`✅ Successfully added ${template.name} template (ID: ${result.id})`);
      } else {
        const error = await response.text();
        console.error(`❌ Failed to add ${template.name} template:`, error);
      }
    } catch (error) {
      console.error(`❌ Error adding ${template.name} template:`, error.message);
    }
  }
}

// Check if server is running
async function checkServer() {
  try {
    const response = await fetch('http://localhost:5000/api/health');
    if (response.ok) {
      console.log('✅ Server is running');
      return true;
    }
  } catch (error) {
    console.error('❌ Server is not running. Please start the server first.');
    console.log('Run: npm run dev');
    return false;
  }
}

// Main execution
async function main() {
  console.log('🚀 Adding new templates to Terraform Dashboard...');
  
  if (await checkServer()) {
    await addTemplates();
    console.log('\n🎉 Template addition process completed!');
  }
}

// Add fetch polyfill for Node.js
if (typeof fetch === 'undefined') {
  global.fetch = require('node-fetch');
}

main().catch(console.error);
