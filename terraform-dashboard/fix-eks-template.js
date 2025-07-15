#!/usr/bin/env node

/**
 * Fix EKS Template Variables
 * This script updates the EKS template with the correct variables from GitHub
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
    
    if (options.body) {
      req.write(options.body);
    }
    
    req.end();
  });
}

// Correct EKS variables based on the GitHub repository
const EKS_VARIABLES = [
  { name: 'cluster_name', type: 'string', description: 'Name of the EKS cluster', required: true },
  { name: 'cluster_version', type: 'string', description: 'Kubernetes version to use for the EKS cluster', required: false, default: '1.27' },
  { name: 'vpc_id', type: 'string', description: 'ID of the VPC where to create security groups', required: true },
  { name: 'subnet_ids', type: 'list(string)', description: 'A list of subnet IDs where the EKS cluster will be created', required: true },
  { name: 'cluster_endpoint_private_access', type: 'bool', description: 'Whether the Amazon EKS private API server endpoint is enabled', required: false, default: 'false' },
  { name: 'cluster_endpoint_public_access', type: 'bool', description: 'Whether the Amazon EKS public API server endpoint is enabled', required: false, default: 'true' },
  { name: 'cluster_endpoint_public_access_cidrs', type: 'list(string)', description: 'List of CIDR blocks which can access the Amazon EKS public API server endpoint', required: false, default: '["0.0.0.0/0"]' },
  { name: 'create_cluster_security_group', type: 'bool', description: 'Whether to create a security group for the cluster', required: false, default: 'true' },
  { name: 'cluster_security_group_ids', type: 'list(string)', description: 'List of security group IDs for the cross-account elastic network interfaces', required: false, default: '[]' },
  { name: 'cluster_additional_policies', type: 'list(string)', description: 'List of additional IAM policy ARNs to attach to the cluster role', required: false, default: '[]' },
  { name: 'create_kms_key', type: 'bool', description: 'Whether to create a KMS key for cluster encryption', required: false, default: 'false' },
  { name: 'kms_key_deletion_window', type: 'number', description: 'The waiting period, specified in number of days', required: false, default: '7' },
  { name: 'cluster_enabled_log_types', type: 'list(string)', description: 'A list of the desired control plane logging to enable', required: false, default: '["api", "audit"]' },
  { name: 'create_node_groups', type: 'bool', description: 'Whether to create EKS managed node groups', required: false, default: 'true' },
  { name: 'node_group_subnet_ids', type: 'list(string)', description: 'A list of subnet IDs where the nodes/node groups will be provisioned', required: false, default: '[]' },
  { name: 'create_node_group_security_group', type: 'bool', description: 'Whether to create a security group for the node groups', required: false, default: 'true' },
  { name: 'node_group_additional_policies', type: 'list(string)', description: 'List of additional IAM policy ARNs to attach to the node group role', required: false, default: '[]' },
  { name: 'node_groups', type: 'map(object)', description: 'Map of EKS managed node group definitions to create', required: false, default: '{}' },
  { name: 'cluster_addons', type: 'map(object)', description: 'Map of cluster addon configurations to enable for the cluster', required: false, default: '{}' },
  { name: 'tags', type: 'map(string)', description: 'A map of tags to add to all resources', required: false, default: '{"Terraform": "true", "Environment": "dev"}' }
];

async function fixEksTemplate() {
  console.log('🔧 Fixing EKS Template Variables...');

  try {
    // Get EKS main.tf content from GitHub
    console.log('📥 Fetching EKS main.tf from GitHub...');
    const mainTfResponse = await makeRequest('https://raw.githubusercontent.com/deepesh786gpr/terrafrom-module/main/eks/main.tf');
    const mainTfContent = await mainTfResponse.text();

    if (!mainTfContent || mainTfContent.length < 100) {
      throw new Error('Failed to fetch EKS main.tf content');
    }

    console.log(`✅ Fetched ${mainTfContent.length} characters of Terraform code`);

    // Get all templates
    const response = await makeRequest(`${API_BASE}/templates`);
    const templates = await response.json();

    // Find the EKS template
    const eksTemplate = templates.find(t => t.name === 'EKS Cluster' && t.category === 'container');

    if (!eksTemplate) {
      console.log('❌ EKS template not found');
      return;
    }

    console.log(`📋 Found EKS template: ${eksTemplate.id}`);

    // Update the template with correct variables and Terraform code
    const updateData = {
      name: eksTemplate.name,
      description: eksTemplate.description,
      category: eksTemplate.category,
      terraformCode: mainTfContent,
      variables: EKS_VARIABLES
    };

    const updateResponse = await makeRequest(`${API_BASE}/templates/${eksTemplate.id}`, {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(updateData)
    });

    const updatedTemplate = await updateResponse.json();

    console.log('✅ EKS template updated successfully!');
    console.log(`📝 Updated ${EKS_VARIABLES.length} variables`);
    console.log(`💻 Updated Terraform code (${mainTfContent.length} characters)`);
    console.log('\n🎯 Fixed Variables:');

    EKS_VARIABLES.forEach(variable => {
      const status = variable.required ? '🔴 Required' : '🟢 Optional';
      console.log(`   ${status} ${variable.name} (${variable.type})`);
    });

    console.log('\n✅ EKS template is now ready for deployment!');
    console.log('🚀 You can now deploy EKS clusters without variable errors');

    return updatedTemplate;

  } catch (error) {
    console.error('❌ Error fixing EKS template:', error.message);
    throw error;
  }
}

// Run the fix
if (require.main === module) {
  fixEksTemplate()
    .then(() => {
      console.log('\n🎉 EKS template fix completed successfully!');
      process.exit(0);
    })
    .catch(error => {
      console.error('\n❌ Fix failed:', error);
      process.exit(1);
    });
}

module.exports = { fixEksTemplate };
