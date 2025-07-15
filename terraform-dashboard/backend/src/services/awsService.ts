import AWS from 'aws-sdk';
import { db } from '../database/database';
import cron from 'node-cron';

export interface EC2Instance {
  id: string;
  name: string;
  type: string;
  state: string;
  publicIp: string;
  privateIp: string;
  availabilityZone: string;
  launchTime: string;
  environment: string;
  volumes: EBSVolume[];
}

export interface EBSVolume {
  id: string;
  size: number;
  type: string;
  encrypted: boolean;
  attachedTo?: string;
}

export interface ScheduledAction {
  id: string;
  instanceId: string;
  action: 'start' | 'stop';
  scheduledTime: Date;
  recurring: boolean;
  enabled: boolean;
}

class AWSService {
  private ec2: AWS.EC2;
  private cloudWatch: AWS.CloudWatch;

  constructor() {
    // Configure AWS SDK
    AWS.config.update({
      region: process.env.AWS_REGION || 'us-east-1',
      accessKeyId: process.env.AWS_ACCESS_KEY_ID,
      secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY,
    });

    this.ec2 = new AWS.EC2();
    this.cloudWatch = new AWS.CloudWatch();

    // Start scheduled actions cron job
    this.startScheduledActionsCron();
  }

  async getInstances(): Promise<EC2Instance[]> {
    try {
      const result = await this.ec2.describeInstances().promise();
      const instances: EC2Instance[] = [];

      for (const reservation of result.Reservations || []) {
        for (const instance of reservation.Instances || []) {
          if (instance.InstanceId) {
            const volumes = await this.getInstanceVolumes(instance.InstanceId);
            
            instances.push({
              id: instance.InstanceId,
              name: this.getInstanceName(instance.Tags),
              type: instance.InstanceType || '',
              state: instance.State?.Name || 'unknown',
              publicIp: instance.PublicIpAddress || '',
              privateIp: instance.PrivateIpAddress || '',
              availabilityZone: instance.Placement?.AvailabilityZone || '',
              launchTime: instance.LaunchTime?.toISOString() || '',
              environment: this.getInstanceEnvironment(instance.Tags),
              volumes,
            });
          }
        }
      }

      // Cache instances in database
      await this.cacheInstances(instances);

      return instances;
    } catch (error) {
      console.error('Error fetching instances:', error);
      throw error;
    }
  }

  async startInstance(instanceId: string): Promise<void> {
    try {
      await this.ec2.startInstances({ InstanceIds: [instanceId] }).promise();
      console.log(`Started instance ${instanceId}`);
    } catch (error) {
      console.error(`Error starting instance ${instanceId}:`, error);
      throw error;
    }
  }

  async stopInstance(instanceId: string): Promise<void> {
    try {
      await this.ec2.stopInstances({ InstanceIds: [instanceId] }).promise();
      console.log(`Stopped instance ${instanceId}`);
    } catch (error) {
      console.error(`Error stopping instance ${instanceId}:`, error);
      throw error;
    }
  }

  async rebootInstance(instanceId: string): Promise<void> {
    try {
      await this.ec2.rebootInstances({ InstanceIds: [instanceId] }).promise();
      console.log(`Rebooted instance ${instanceId}`);
    } catch (error) {
      console.error(`Error rebooting instance ${instanceId}:`, error);
      throw error;
    }
  }

  async getInstanceStatus(instanceId: string): Promise<any> {
    try {
      const result = await this.ec2.describeInstanceStatus({
        InstanceIds: [instanceId],
        IncludeAllInstances: true,
      }).promise();

      return result.InstanceStatuses?.[0] || null;
    } catch (error) {
      console.error(`Error getting instance status ${instanceId}:`, error);
      throw error;
    }
  }

  async scheduleAction(action: Omit<ScheduledAction, 'id'>): Promise<string> {
    try {
      const actionId = `sched-${Date.now()}`;
      
      await db.run(`
        INSERT INTO scheduled_actions (id, instance_id, action, scheduled_time, recurring, enabled)
        VALUES (?, ?, ?, ?, ?, ?)
      `, [
        actionId,
        action.instanceId,
        action.action,
        action.scheduledTime.toISOString(),
        action.recurring,
        action.enabled,
      ]);

      console.log(`Scheduled ${action.action} for instance ${action.instanceId} at ${action.scheduledTime}`);
      return actionId;
    } catch (error) {
      console.error('Error scheduling action:', error);
      throw error;
    }
  }

  async getScheduledActions(instanceId?: string): Promise<ScheduledAction[]> {
    try {
      let query = 'SELECT * FROM scheduled_actions WHERE enabled = 1';
      const params: any[] = [];

      if (instanceId) {
        query += ' AND instance_id = ?';
        params.push(instanceId);
      }

      query += ' ORDER BY scheduled_time ASC';

      const rows = await db.all(query, params);
      
      return rows.map(row => ({
        id: row.id,
        instanceId: row.instance_id,
        action: row.action,
        scheduledTime: new Date(row.scheduled_time),
        recurring: Boolean(row.recurring),
        enabled: Boolean(row.enabled),
      }));
    } catch (error) {
      console.error('Error getting scheduled actions:', error);
      throw error;
    }
  }

  async cancelScheduledAction(actionId: string): Promise<void> {
    try {
      await db.run('UPDATE scheduled_actions SET enabled = 0 WHERE id = ?', [actionId]);
      console.log(`Cancelled scheduled action ${actionId}`);
    } catch (error) {
      console.error('Error cancelling scheduled action:', error);
      throw error;
    }
  }

  async getInstanceMetrics(instanceId: string, metricName: string, startTime: Date, endTime: Date): Promise<any> {
    try {
      const params = {
        Namespace: 'AWS/EC2',
        MetricName: metricName,
        Dimensions: [
          {
            Name: 'InstanceId',
            Value: instanceId,
          },
        ],
        StartTime: startTime,
        EndTime: endTime,
        Period: 300, // 5 minutes
        Statistics: ['Average', 'Maximum'],
      };

      const result = await this.cloudWatch.getMetricStatistics(params).promise();
      return result.Datapoints;
    } catch (error) {
      console.error(`Error getting metrics for instance ${instanceId}:`, error);
      throw error;
    }
  }

  private async getInstanceVolumes(instanceId: string): Promise<EBSVolume[]> {
    try {
      const result = await this.ec2.describeVolumes({
        Filters: [
          {
            Name: 'attachment.instance-id',
            Values: [instanceId],
          },
        ],
      }).promise();

      return (result.Volumes || []).map(volume => ({
        id: volume.VolumeId || '',
        size: volume.Size || 0,
        type: volume.VolumeType || '',
        encrypted: volume.Encrypted || false,
        attachedTo: instanceId,
      }));
    } catch (error) {
      console.error(`Error getting volumes for instance ${instanceId}:`, error);
      return [];
    }
  }

  private getInstanceName(tags?: AWS.EC2.Tag[]): string {
    const nameTag = tags?.find(tag => tag.Key === 'Name');
    return nameTag?.Value || 'Unnamed';
  }

  private getInstanceEnvironment(tags?: AWS.EC2.Tag[]): string {
    const envTag = tags?.find(tag => tag.Key === 'Environment');
    return envTag?.Value || 'unknown';
  }

  private async cacheInstances(instances: EC2Instance[]): Promise<void> {
    try {
      // Clear existing cache
      await db.run('DELETE FROM instances');

      // Insert new instances
      for (const instance of instances) {
        await db.run(`
          INSERT INTO instances (id, name, type, state, public_ip, private_ip, availability_zone, launch_time, environment)
          VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
        `, [
          instance.id,
          instance.name,
          instance.type,
          instance.state,
          instance.publicIp,
          instance.privateIp,
          instance.availabilityZone,
          instance.launchTime,
          instance.environment,
        ]);
      }
    } catch (error) {
      console.error('Error caching instances:', error);
    }
  }

  private startScheduledActionsCron(): void {
    // Run every minute to check for scheduled actions
    cron.schedule('* * * * *', async () => {
      try {
        const now = new Date();
        const actions = await db.all(`
          SELECT * FROM scheduled_actions 
          WHERE enabled = 1 
          AND scheduled_time <= ? 
          AND (last_executed IS NULL OR last_executed < scheduled_time)
        `, [now.toISOString()]);

        for (const action of actions) {
          try {
            console.log(`Executing scheduled action: ${action.action} on ${action.instance_id}`);
            
            if (action.action === 'start') {
              await this.startInstance(action.instance_id);
            } else if (action.action === 'stop') {
              await this.stopInstance(action.instance_id);
            }

            // Update last executed time
            await db.run(`
              UPDATE scheduled_actions 
              SET last_executed = ? 
              WHERE id = ?
            `, [now.toISOString(), action.id]);

            // If not recurring, disable the action
            if (!action.recurring) {
              await db.run(`
                UPDATE scheduled_actions 
                SET enabled = 0 
                WHERE id = ?
              `, [action.id]);
            } else {
              // For recurring actions, schedule next execution (daily)
              const nextExecution = new Date(action.scheduled_time);
              nextExecution.setDate(nextExecution.getDate() + 1);
              
              await db.run(`
                UPDATE scheduled_actions 
                SET scheduled_time = ? 
                WHERE id = ?
              `, [nextExecution.toISOString(), action.id]);
            }
          } catch (error) {
            console.error(`Error executing scheduled action ${action.id}:`, error);
          }
        }
      } catch (error) {
        console.error('Error in scheduled actions cron:', error);
      }
    });

    console.log('Scheduled actions cron job started');
  }
}

export const awsService = new AWSService();
