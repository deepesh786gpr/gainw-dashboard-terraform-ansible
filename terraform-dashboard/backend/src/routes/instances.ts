import express from 'express';
import { createError } from '../middleware/errorHandler';
import { spawn } from 'child_process';
import { RealAwsService } from '../services/realAwsService';

// Initialize real AWS service
const realAwsService = new RealAwsService();

// Fallback mock AWS service for demo purposes (when AWS credentials are not available)
const mockAwsService = {
  async getInstances() {
    return [
      {
        id: 'i-0e43e6683baf16e35',
        name: 'web-server-prod',
        type: 't3.small',
        state: 'running',
        publicIp: '54.123.45.67',
        privateIp: '10.0.1.100',
        availabilityZone: 'us-east-1a',
        environment: 'production',
        launchTime: '2024-01-15T10:30:00Z',
        volumes: [
          { id: 'vol-123', size: 20, type: 'gp3', encrypted: true },
          { id: 'vol-456', size: 100, type: 'gp3', encrypted: true },
        ],
      },
      {
        id: 'i-0f44f7794caf27f46',
        name: 'database-dev',
        type: 't3.micro',
        state: 'stopped',
        publicIp: '',
        privateIp: '10.0.2.50',
        availabilityZone: 'us-east-1b',
        environment: 'development',
        launchTime: '2024-01-14T15:20:00Z',
        volumes: [
          { id: 'vol-789', size: 50, type: 'gp3', encrypted: true },
        ],
      },
    ];
  },

  async startInstance(instanceId: string) {
    console.log(`Mock: Starting instance ${instanceId}`);
    return { message: `Instance ${instanceId} start initiated` };
  },

  async stopInstance(instanceId: string) {
    console.log(`Mock: Stopping instance ${instanceId}`);
    return { message: `Instance ${instanceId} stop initiated` };
  },

  async rebootInstance(instanceId: string) {
    console.log(`Mock: Rebooting instance ${instanceId}`);
    return { message: `Instance ${instanceId} reboot initiated` };
  },

  async getInstanceStatus(instanceId: string) {
    return { status: 'running', checks: 'passed' };
  },

  async scheduleAction(action: any) {
    // For now, return a mock scheduled action ID
    // In a real implementation, this would integrate with AWS Systems Manager or EventBridge
    const actionId = `sched-${Date.now()}`;
    console.log(`Scheduled ${action.action} for instance ${action.instanceId} at ${action.scheduledTime}`);
    return actionId;
  },

  async getScheduledActions(instanceId?: string) {
    // For now, return empty array
    // In a real implementation, this would query AWS Systems Manager or EventBridge
    return [];
  },

  async cancelScheduledAction(actionId: string) {
    // For now, just log the cancellation
    // In a real implementation, this would cancel the scheduled action in AWS
    console.log(`Cancelled scheduled action ${actionId}`);
  },

  async getInstanceMetrics(instanceId: string, metricName: string, startTime: Date, endTime: Date) {
    return new Promise((resolve, reject) => {
      const awsProcess = spawn('aws', [
        'cloudwatch', 'get-metric-statistics',
        '--namespace', 'AWS/EC2',
        '--metric-name', metricName,
        '--dimensions', `Name=InstanceId,Value=${instanceId}`,
        '--start-time', startTime.toISOString(),
        '--end-time', endTime.toISOString(),
        '--period', '3600',
        '--statistics', 'Average',
        '--output', 'json'
      ], {
        env: {
          ...process.env,
          AWS_PROFILE: process.env.AWS_PROFILE || 'default',
          AWS_REGION: process.env.AWS_REGION || process.env.AWS_DEFAULT_REGION || 'us-east-1',
        }
      });

      let stdout = '';
      let stderr = '';

      awsProcess.stdout.on('data', (data) => {
        stdout += data.toString();
      });

      awsProcess.stderr.on('data', (data) => {
        stderr += data.toString();
      });

      awsProcess.on('close', (code) => {
        if (code === 0) {
          try {
            const data = JSON.parse(stdout);
            const metrics = data.Datapoints?.map((point: any) => ({
              timestamp: new Date(point.Timestamp),
              value: point.Average
            })) || [];
            resolve(metrics);
          } catch (error) {
            resolve([]);
          }
        } else {
          console.error(`CloudWatch metrics error: ${stderr}`);
          resolve([]);
        }
      });
    });
  },
};

// Function to get the appropriate AWS service (real or mock)
async function getAwsService() {
  // Try to use real AWS service first
  try {
    const instances = await realAwsService.getInstances();
    console.log('✅ Using real AWS service - AWS credentials available');
    return realAwsService;
  } catch (error) {
    console.log('⚠️  AWS credentials not available, falling back to mock service');
    console.log('To use real AWS data, configure AWS credentials via:');
    console.log('  - AWS_ACCESS_KEY_ID and AWS_SECRET_ACCESS_KEY environment variables');
    console.log('  - AWS IAM role (if running on EC2)');
    console.log('  - AWS CLI credentials (~/.aws/credentials)');
    return mockAwsService;
  }
}

const router = express.Router();

// Get all instances
router.get('/', async (req, res, next) => {
  try {
    const awsService = await getAwsService();
    const instances = await awsService.getInstances();
    res.json(instances);
  } catch (error) {
    next(error);
  }
});

// Start instance
router.post('/:instanceId/start', async (req, res, next) => {
  try {
    const { instanceId } = req.params;
    const awsService = await getAwsService();
    const result = await awsService.startInstance(instanceId);

    res.json({
      message: result.message || `Instance ${instanceId} start command sent`,
      instanceId,
    });
  } catch (error) {
    next(error);
  }
});

// Stop instance
router.post('/:instanceId/stop', async (req, res, next) => {
  try {
    const { instanceId } = req.params;
    const awsService = await getAwsService();
    const result = await awsService.stopInstance(instanceId);

    res.json({
      message: result.message || `Instance ${instanceId} stop command sent`,
      instanceId,
    });
  } catch (error) {
    next(error);
  }
});

// Reboot instance
router.post('/:instanceId/reboot', async (req, res, next) => {
  try {
    const { instanceId } = req.params;
    await mockAwsService.rebootInstance(instanceId);

    res.json({
      message: `Instance ${instanceId} reboot command sent`,
      instanceId,
    });
  } catch (error) {
    next(error);
  }
});

// Get instance status
router.get('/:instanceId/status', async (req, res, next) => {
  try {
    const { instanceId } = req.params;
    const status = await mockAwsService.getInstanceStatus(instanceId);

    res.json({
      instanceId,
      status,
    });
  } catch (error) {
    next(error);
  }
});

// Schedule instance action
router.post('/:instanceId/schedule', async (req, res, next) => {
  try {
    const { instanceId } = req.params;
    const { action, scheduledTime, recurring } = req.body;

    if (!action || !scheduledTime) {
      throw createError('Missing required fields: action, scheduledTime', 400);
    }

    if (!['start', 'stop'].includes(action)) {
      throw createError('Invalid action. Must be "start" or "stop"', 400);
    }

    const actionId = await mockAwsService.scheduleAction({
      instanceId,
      action,
      scheduledTime: new Date(scheduledTime),
      recurring: Boolean(recurring),
      enabled: true,
    });

    res.json({
      actionId,
      message: `Scheduled ${action} for instance ${instanceId}`,
    });
  } catch (error) {
    next(error);
  }
});

// Get scheduled actions for instance
router.get('/:instanceId/schedule', async (req, res, next) => {
  try {
    const { instanceId } = req.params;
    const actions = await mockAwsService.getScheduledActions(instanceId);

    res.json(actions);
  } catch (error) {
    next(error);
  }
});

// Cancel scheduled action
router.delete('/schedule/:actionId', async (req, res, next) => {
  try {
    const { actionId } = req.params;
    await mockAwsService.cancelScheduledAction(actionId);

    res.json({
      message: `Scheduled action ${actionId} cancelled`,
    });
  } catch (error) {
    next(error);
  }
});

// Get instance metrics
router.get('/:instanceId/metrics', async (req, res, next) => {
  try {
    const { instanceId } = req.params;
    const { metricName = 'CPUUtilization', hours = 24 } = req.query;

    const endTime = new Date();
    const startTime = new Date(endTime.getTime() - (Number(hours) * 60 * 60 * 1000));

    const metrics = await mockAwsService.getInstanceMetrics(
      instanceId,
      metricName as string,
      startTime,
      endTime
    );

    res.json({
      instanceId,
      metricName,
      startTime,
      endTime,
      datapoints: metrics,
    });
  } catch (error) {
    next(error);
  }
});

// Get instance details for modification
router.get('/:instanceId/details', async (req, res, next) => {
  try {
    const { instanceId } = req.params;

    // Mock detailed instance information
    const instanceDetails = {
      id: instanceId,
      name: instanceId === 'i-0e43e6683baf16e35' ? 'web-server-prod' : 'database-dev',
      type: instanceId === 'i-0e43e6683baf16e35' ? 't3.small' : 't3.micro',
      state: instanceId === 'i-0e43e6683baf16e35' ? 'running' : 'stopped',
      publicIp: instanceId === 'i-0e43e6683baf16e35' ? '54.123.45.67' : '',
      privateIp: instanceId === 'i-0e43e6683baf16e35' ? '10.0.1.100' : '10.0.2.50',
      availabilityZone: instanceId === 'i-0e43e6683baf16e35' ? 'us-east-1a' : 'us-east-1b',
      environment: instanceId === 'i-0e43e6683baf16e35' ? 'production' : 'development',
      launchTime: instanceId === 'i-0e43e6683baf16e35' ? '2024-01-15T10:30:00Z' : '2024-01-14T15:20:00Z',
      securityGroups: [
        { id: 'sg-12345', name: 'web-server-sg' },
        { id: 'sg-67890', name: 'default' }
      ],
      keyPair: 'my-key-pair',
      userData: '',
      iamRole: instanceId === 'i-0e43e6683baf16e35' ? 'web-server-role' : '',
      monitoring: false,
      terminationProtection: false,
      tags: {
        Name: instanceId === 'i-0e43e6683baf16e35' ? 'web-server-prod' : 'database-dev',
        Environment: instanceId === 'i-0e43e6683baf16e35' ? 'production' : 'development',
        Project: 'terraform-dashboard'
      },
      volumes: instanceId === 'i-0e43e6683baf16e35' ? [
        { id: 'vol-123', size: 20, type: 'gp3', encrypted: true, device: '/dev/sda1' },
        { id: 'vol-456', size: 100, type: 'gp3', encrypted: true, device: '/dev/sdf' }
      ] : [
        { id: 'vol-789', size: 50, type: 'gp3', encrypted: true, device: '/dev/sda1' }
      ]
    };

    res.json(instanceDetails);
  } catch (error) {
    next(error);
  }
});

// Modify instance configuration
router.put('/:instanceId/modify', async (req, res, next) => {
  try {
    const { instanceId } = req.params;
    const modifications = req.body;

    // Validate modifications
    const allowedModifications = [
      'instanceType', 'securityGroups', 'userData', 'iamRole',
      'monitoring', 'terminationProtection', 'tags'
    ];

    const invalidFields = Object.keys(modifications).filter(
      field => !allowedModifications.includes(field)
    );

    if (invalidFields.length > 0) {
      throw createError(`Invalid modification fields: ${invalidFields.join(', ')}`, 400);
    }

    // Mock modification process
    console.log(`Mock: Modifying instance ${instanceId} with:`, modifications);

    // Simulate different modification types
    const modificationResults = [];

    if (modifications.instanceType) {
      modificationResults.push({
        type: 'instance_type',
        status: 'pending',
        message: `Instance type change to ${modifications.instanceType} initiated`
      });
    }

    if (modifications.securityGroups) {
      modificationResults.push({
        type: 'security_groups',
        status: 'completed',
        message: 'Security groups updated successfully'
      });
    }

    if (modifications.userData) {
      modificationResults.push({
        type: 'user_data',
        status: 'pending',
        message: 'User data will be applied on next restart'
      });
    }

    if (modifications.iamRole) {
      modificationResults.push({
        type: 'iam_role',
        status: 'completed',
        message: `IAM role updated to ${modifications.iamRole}`
      });
    }

    if (modifications.monitoring !== undefined) {
      modificationResults.push({
        type: 'monitoring',
        status: 'completed',
        message: `Detailed monitoring ${modifications.monitoring ? 'enabled' : 'disabled'}`
      });
    }

    if (modifications.terminationProtection !== undefined) {
      modificationResults.push({
        type: 'termination_protection',
        status: 'completed',
        message: `Termination protection ${modifications.terminationProtection ? 'enabled' : 'disabled'}`
      });
    }

    if (modifications.tags) {
      modificationResults.push({
        type: 'tags',
        status: 'completed',
        message: 'Tags updated successfully'
      });
    }

    res.json({
      instanceId,
      message: 'Instance modification initiated',
      modifications: modificationResults,
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    next(error);
  }
});

export default router;
