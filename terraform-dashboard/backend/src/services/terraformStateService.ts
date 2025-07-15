import { spawn, ChildProcess } from 'child_process';
import fs from 'fs/promises';
import path from 'path';
import { v4 as uuidv4 } from 'uuid';
import { logger } from '../utils/logger';
import { websocketService } from './websocketService';

export interface TerraformResource {
  address: string;
  type: string;
  name: string;
  provider: string;
  mode: 'managed' | 'data';
  instances: TerraformResourceInstance[];
  dependencies: string[];
}

export interface TerraformResourceInstance {
  index_key?: string | number;
  attributes: Record<string, any>;
  status: 'tainted' | 'untainted';
  schema_version: number;
  private?: string;
}

export interface TerraformState {
  version: number;
  terraform_version: string;
  serial: number;
  lineage: string;
  outputs: Record<string, TerraformOutput>;
  resources: TerraformResource[];
  check_results?: any;
}

export interface TerraformOutput {
  value: any;
  type: string;
  sensitive: boolean;
}

export interface TerraformPlan {
  format_version: string;
  terraform_version: string;
  planned_values: {
    outputs: Record<string, any>;
    root_module: {
      resources: TerraformResource[];
      child_modules?: any[];
    };
  };
  resource_changes: TerraformResourceChange[];
  output_changes: Record<string, any>;
  prior_state: TerraformState;
  configuration: any;
}

export interface TerraformResourceChange {
  address: string;
  module_address?: string;
  mode: 'managed' | 'data';
  type: string;
  name: string;
  provider_name: string;
  change: {
    actions: ('no-op' | 'create' | 'read' | 'update' | 'delete')[];
    before: any;
    after: any;
    after_unknown: Record<string, boolean>;
    before_sensitive: Record<string, boolean>;
    after_sensitive: Record<string, boolean>;
  };
}

export interface DriftDetectionResult {
  id: string;
  deploymentId: string;
  timestamp: string;
  status: 'in-progress' | 'completed' | 'failed';
  driftedResources: TerraformResourceChange[];
  summary: {
    totalResources: number;
    driftedResources: number;
    addedResources: number;
    modifiedResources: number;
    deletedResources: number;
  };
}

export class TerraformStateService {
  private workingDirectory: string;
  private terraformPath: string;

  constructor() {
    this.workingDirectory = process.env.TERRAFORM_WORKING_DIR || './terraform-workspace';
    this.terraformPath = process.env.TERRAFORM_PATH || 'terraform';
  }

  async getState(deploymentId: string): Promise<TerraformState | null> {
    try {
      const deploymentDir = path.join(this.workingDirectory, deploymentId);
      const stateFile = path.join(deploymentDir, 'terraform.tfstate');

      // Check if state file exists
      try {
        await fs.access(stateFile);
      } catch {
        logger.warn('State file not found', { deploymentId, stateFile });
        return null;
      }

      const stateContent = await fs.readFile(stateFile, 'utf-8');
      const state: TerraformState = JSON.parse(stateContent);

      logger.info('State retrieved successfully', { 
        deploymentId, 
        version: state.version,
        resourceCount: state.resources.length 
      });

      return state;
    } catch (error: any) {
      logger.error('Error retrieving state', { deploymentId, error: error.message });
      throw error;
    }
  }

  async getPlan(deploymentId: string): Promise<TerraformPlan | null> {
    try {
      const deploymentDir = path.join(this.workingDirectory, deploymentId);
      const planFile = path.join(deploymentDir, 'tfplan.json');

      // Generate plan in JSON format
      await this.runTerraformCommand(deploymentDir, 'show', ['-json', 'tfplan'], planFile);

      const planContent = await fs.readFile(planFile, 'utf-8');
      const plan: TerraformPlan = JSON.parse(planContent);

      logger.info('Plan retrieved successfully', { 
        deploymentId,
        resourceChanges: plan.resource_changes.length 
      });

      return plan;
    } catch (error: any) {
      logger.error('Error retrieving plan', { deploymentId, error: error.message });
      throw error;
    }
  }

  async detectDrift(deploymentId: string): Promise<DriftDetectionResult> {
    const driftId = uuidv4();
    const result: DriftDetectionResult = {
      id: driftId,
      deploymentId,
      timestamp: new Date().toISOString(),
      status: 'in-progress',
      driftedResources: [],
      summary: {
        totalResources: 0,
        driftedResources: 0,
        addedResources: 0,
        modifiedResources: 0,
        deletedResources: 0,
      },
    };

    try {
      const deploymentDir = path.join(this.workingDirectory, deploymentId);

      // Run terraform plan to detect drift
      const planOutput = await this.runTerraformCommand(
        deploymentDir, 
        'plan', 
        ['-detailed-exitcode', '-out=drift-plan', '-json']
      );

      // Get plan in JSON format
      const planJsonOutput = await this.runTerraformCommand(
        deploymentDir,
        'show',
        ['-json', 'drift-plan']
      );

      const plan: TerraformPlan = JSON.parse(planJsonOutput);
      
      // Analyze resource changes for drift
      const driftedResources = plan.resource_changes.filter(change => 
        change.change.actions.some(action => action !== 'no-op')
      );

      result.driftedResources = driftedResources;
      result.summary.totalResources = plan.resource_changes.length;
      result.summary.driftedResources = driftedResources.length;
      result.summary.addedResources = driftedResources.filter(r => 
        r.change.actions.includes('create')
      ).length;
      result.summary.modifiedResources = driftedResources.filter(r => 
        r.change.actions.includes('update')
      ).length;
      result.summary.deletedResources = driftedResources.filter(r => 
        r.change.actions.includes('delete')
      ).length;

      result.status = 'completed';

      logger.info('Drift detection completed', {
        deploymentId,
        driftId,
        driftedResources: result.summary.driftedResources,
      });

      // Notify via WebSocket
      if (websocketService) {
        websocketService.sendToRoom(`deployment:${deploymentId}`, {
          type: 'drift_detection_completed',
          payload: result,
          timestamp: new Date().toISOString(),
        });
      }

    } catch (error: any) {
      result.status = 'failed';
      logger.error('Drift detection failed', { deploymentId, driftId, error: error.message });
    }

    return result;
  }

  async getResourceDetails(deploymentId: string, resourceAddress: string): Promise<TerraformResource | null> {
    try {
      const state = await this.getState(deploymentId);
      if (!state) return null;

      const resource = state.resources.find(r => r.address === resourceAddress);
      return resource || null;
    } catch (error: any) {
      logger.error('Error getting resource details', { deploymentId, resourceAddress, error: error.message });
      throw error;
    }
  }

  async getOutputs(deploymentId: string): Promise<Record<string, TerraformOutput>> {
    try {
      const deploymentDir = path.join(this.workingDirectory, deploymentId);
      const outputJson = await this.runTerraformCommand(deploymentDir, 'output', ['-json']);
      
      return JSON.parse(outputJson);
    } catch (error: any) {
      logger.error('Error getting outputs', { deploymentId, error: error.message });
      throw error;
    }
  }

  async refreshState(deploymentId: string): Promise<void> {
    try {
      const deploymentDir = path.join(this.workingDirectory, deploymentId);
      
      await this.runTerraformCommand(deploymentDir, 'refresh', []);
      
      logger.info('State refreshed successfully', { deploymentId });

      // Notify via WebSocket
      if (websocketService) {
        websocketService.sendToRoom(`deployment:${deploymentId}`, {
          type: 'state_refreshed',
          payload: { deploymentId },
          timestamp: new Date().toISOString(),
        });
      }
    } catch (error: any) {
      logger.error('Error refreshing state', { deploymentId, error: error.message });
      throw error;
    }
  }

  async importResource(deploymentId: string, resourceAddress: string, resourceId: string): Promise<void> {
    try {
      const deploymentDir = path.join(this.workingDirectory, deploymentId);
      
      await this.runTerraformCommand(deploymentDir, 'import', [resourceAddress, resourceId]);
      
      logger.info('Resource imported successfully', { deploymentId, resourceAddress, resourceId });
    } catch (error: any) {
      logger.error('Error importing resource', { deploymentId, resourceAddress, resourceId, error: error.message });
      throw error;
    }
  }

  async taintResource(deploymentId: string, resourceAddress: string): Promise<void> {
    try {
      const deploymentDir = path.join(this.workingDirectory, deploymentId);
      
      await this.runTerraformCommand(deploymentDir, 'taint', [resourceAddress]);
      
      logger.info('Resource tainted successfully', { deploymentId, resourceAddress });
    } catch (error: any) {
      logger.error('Error tainting resource', { deploymentId, resourceAddress, error: error.message });
      throw error;
    }
  }

  async untaintResource(deploymentId: string, resourceAddress: string): Promise<void> {
    try {
      const deploymentDir = path.join(this.workingDirectory, deploymentId);
      
      await this.runTerraformCommand(deploymentDir, 'untaint', [resourceAddress]);
      
      logger.info('Resource untainted successfully', { deploymentId, resourceAddress });
    } catch (error: any) {
      logger.error('Error untainting resource', { deploymentId, resourceAddress, error: error.message });
      throw error;
    }
  }

  private async runTerraformCommand(
    workingDir: string,
    command: string,
    args: string[],
    outputFile?: string
  ): Promise<string> {
    return new Promise((resolve, reject) => {
      const process = spawn(this.terraformPath, [command, ...args], {
        cwd: workingDir,
        stdio: ['pipe', 'pipe', 'pipe'],
      });

      let stdout = '';
      let stderr = '';

      process.stdout.on('data', (data) => {
        stdout += data.toString();
      });

      process.stderr.on('data', (data) => {
        stderr += data.toString();
      });

      process.on('close', async (code) => {
        if (code === 0) {
          if (outputFile) {
            try {
              await fs.writeFile(outputFile, stdout);
            } catch (error) {
              reject(error);
              return;
            }
          }
          resolve(stdout);
        } else {
          reject(new Error(`Terraform command failed with code ${code}: ${stderr}`));
        }
      });

      process.on('error', (error) => {
        reject(error);
      });
    });
  }
}

export const terraformStateService = new TerraformStateService();
