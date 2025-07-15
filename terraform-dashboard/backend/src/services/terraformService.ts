import { spawn, ChildProcess } from 'child_process';
import fs from 'fs/promises';
import path from 'path';
import { v4 as uuidv4 } from 'uuid';
import { db } from '../database/database';

export interface TerraformOperation {
  id: string;
  type: 'plan' | 'apply' | 'destroy';
  status: 'pending' | 'running' | 'success' | 'error';
  deploymentId: string;
  logs: string[];
  startTime: Date;
  endTime?: Date;
  exitCode?: number;
}

export interface DeploymentConfig {
  templateId: string;
  name: string;
  environment: string;
  variables: Record<string, any>;
}

class TerraformService {
  private operations: Map<string, TerraformOperation> = new Map();
  private workingDirectory: string;
  private terraformPath: string;
  private terragruntPath: string;

  constructor() {
    this.workingDirectory = process.env.TERRAFORM_WORKING_DIR || './terraform-workspace';
    this.terraformPath = process.env.TERRAFORM_PATH || 'terraform';
    this.terragruntPath = process.env.TERRAGRUNT_PATH || 'terragrunt';
  }

  async plan(deploymentConfig: DeploymentConfig): Promise<string> {
    const operationId = uuidv4();
    const operation: TerraformOperation = {
      id: operationId,
      type: 'plan',
      status: 'pending',
      deploymentId: deploymentConfig.name,
      logs: [],
      startTime: new Date(),
    };

    this.operations.set(operationId, operation);

    try {
      // Create deployment directory
      const deploymentDir = await this.createDeploymentDirectory(deploymentConfig);
      
      // Generate Terraform files
      await this.generateTerraformFiles(deploymentDir, deploymentConfig);
      
      // Run terraform init
      await this.runTerraformCommand(operation, 'init', [], deploymentDir);
      
      // Run terraform plan
      await this.runTerraformCommand(operation, 'plan', ['-out=tfplan'], deploymentDir);
      
      operation.status = 'success';
      operation.endTime = new Date();
      
      // Save to database
      await this.saveDeployment(deploymentConfig, operation);
      
    } catch (error: any) {
      operation.status = 'error';
      operation.endTime = new Date();
      operation.logs.push(`Error: ${error.message}`);
    }

    return operationId;
  }

  async apply(deploymentConfig: DeploymentConfig): Promise<string> {
    const operationId = uuidv4();
    const operation: TerraformOperation = {
      id: operationId,
      type: 'apply',
      status: 'pending',
      deploymentId: deploymentConfig.name,
      logs: [],
      startTime: new Date(),
    };

    this.operations.set(operationId, operation);

    try {
      const deploymentDir = path.join(this.workingDirectory, deploymentConfig.name);
      
      // Check if plan exists
      const planPath = path.join(deploymentDir, 'tfplan');
      try {
        await fs.access(planPath);
      } catch {
        throw new Error('No plan found. Please run plan first.');
      }
      
      // Run terraform apply
      await this.runTerraformCommand(operation, 'apply', ['tfplan'], deploymentDir);
      
      operation.status = 'success';
      operation.endTime = new Date();
      
      // Update deployment status
      await this.updateDeploymentStatus(deploymentConfig.name, 'success');
      
    } catch (error: any) {
      operation.status = 'error';
      operation.endTime = new Date();
      operation.logs.push(`Error: ${error.message}`);

      await this.updateDeploymentStatus(deploymentConfig.name, 'error');
    }

    return operationId;
  }

  async destroy(deploymentName: string): Promise<string> {
    const operationId = uuidv4();
    const operation: TerraformOperation = {
      id: operationId,
      type: 'destroy',
      status: 'pending',
      deploymentId: deploymentName,
      logs: [],
      startTime: new Date(),
    };

    this.operations.set(operationId, operation);

    try {
      const deploymentDir = path.join(this.workingDirectory, deploymentName);
      
      // Run terraform destroy
      await this.runTerraformCommand(operation, 'destroy', ['-auto-approve'], deploymentDir);
      
      operation.status = 'success';
      operation.endTime = new Date();
      
      // Update deployment status
      await this.updateDeploymentStatus(deploymentName, 'destroyed');
      
    } catch (error: any) {
      operation.status = 'error';
      operation.endTime = new Date();
      operation.logs.push(`Error: ${error.message}`);
    }

    return operationId;
  }

  getOperation(operationId: string): TerraformOperation | undefined {
    return this.operations.get(operationId);
  }

  getAllOperations(): TerraformOperation[] {
    return Array.from(this.operations.values());
  }

  private async createDeploymentDirectory(config: DeploymentConfig): Promise<string> {
    const deploymentDir = path.join(this.workingDirectory, config.name);
    
    try {
      await fs.mkdir(deploymentDir, { recursive: true });
    } catch (error) {
      // Directory might already exist
    }
    
    return deploymentDir;
  }

  private async generateTerraformFiles(deploymentDir: string, config: DeploymentConfig): Promise<void> {
    // Get template from database
    const template = await db.get('SELECT * FROM templates WHERE id = ?', [config.templateId]);
    if (!template) {
      throw new Error(`Template ${config.templateId} not found`);
    }

    // Generate main.tf
    const mainTf = template.terraform_code;
    await fs.writeFile(path.join(deploymentDir, 'main.tf'), mainTf);

    // Generate variables.tf
    const variables = JSON.parse(template.variables || '[]');
    const variablesTf = this.generateVariablesFile(variables);
    await fs.writeFile(path.join(deploymentDir, 'variables.tf'), variablesTf);

    // Generate terraform.tfvars
    const tfvars = this.generateTfvarsFile(config.variables);
    await fs.writeFile(path.join(deploymentDir, 'terraform.tfvars'), tfvars);

    // Generate provider.tf
    const providerTf = `
terraform {
  required_version = ">= 1.0"
  
  required_providers {
    aws = {
      source  = "hashicorp/aws"
      version = ">= 4.0"
    }
  }
}

provider "aws" {
  region = var.aws_region
  
  default_tags {
    tags = {
      Environment = var.environment
      ManagedBy   = "terraform-dashboard"
      Deployment  = "${config.name}"
    }
  }
}
`;
    await fs.writeFile(path.join(deploymentDir, 'provider.tf'), providerTf);
  }

  private generateVariablesFile(variables: any[]): string {
    let content = '# Auto-generated variables file\n\n';
    
    // Add common variables
    content += `variable "aws_region" {
  description = "AWS region"
  type        = string
  default     = "us-east-1"
}

variable "environment" {
  description = "Environment name"
  type        = string
}

`;

    // Add template-specific variables
    for (const variable of variables) {
      content += `variable "${variable.name}" {
  description = "${variable.description}"
  type        = ${variable.type}`;
      
      if (variable.default !== undefined) {
        content += `\n  default     = ${JSON.stringify(variable.default)}`;
      }
      
      content += '\n}\n\n';
    }

    return content;
  }

  private generateTfvarsFile(variables: Record<string, any>): string {
    let content = '# Auto-generated terraform.tfvars file\n\n';
    
    for (const [key, value] of Object.entries(variables)) {
      if (typeof value === 'string') {
        content += `${key} = "${value}"\n`;
      } else {
        content += `${key} = ${JSON.stringify(value)}\n`;
      }
    }

    return content;
  }

  private async runTerraformCommand(
    operation: TerraformOperation,
    command: string,
    args: string[],
    workingDir: string
  ): Promise<void> {
    return new Promise((resolve, reject) => {
      operation.status = 'running';
      operation.logs.push(`Running: terraform ${command} ${args.join(' ')}`);

      const process = spawn(this.terraformPath, [command, ...args], {
        cwd: workingDir,
        stdio: 'pipe',
      });

      let stdout = '';
      let stderr = '';

      process.stdout.on('data', (data) => {
        const output = data.toString();
        stdout += output;
        operation.logs.push(output);
      });

      process.stderr.on('data', (data) => {
        const output = data.toString();
        stderr += output;
        operation.logs.push(`ERROR: ${output}`);
      });

      process.on('close', (code) => {
        operation.exitCode = code || undefined;

        if (code === 0) {
          operation.logs.push(`Command completed successfully`);
          resolve();
        } else {
          operation.logs.push(`Command failed with exit code ${code}`);
          reject(new Error(`Terraform ${command} failed with exit code ${code}`));
        }
      });

      process.on('error', (error) => {
        operation.logs.push(`Process error: ${error.message}`);
        reject(error);
      });
    });
  }

  private async saveDeployment(config: DeploymentConfig, operation: TerraformOperation): Promise<void> {
    const deploymentId = uuidv4();
    
    await db.run(`
      INSERT INTO deployments (id, name, template_id, status, environment, variables, logs, created_at, updated_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, datetime('now'), datetime('now'))
    `, [
      deploymentId,
      config.name,
      config.templateId,
      operation.status,
      config.environment,
      JSON.stringify(config.variables),
      JSON.stringify(operation.logs)
    ]);
  }

  private async updateDeploymentStatus(deploymentName: string, status: string): Promise<void> {
    await db.run(`
      UPDATE deployments 
      SET status = ?, updated_at = datetime('now')
      WHERE name = ?
    `, [status, deploymentName]);
  }
}

export const terraformService = new TerraformService();
