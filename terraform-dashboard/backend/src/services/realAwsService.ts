import { EC2Client, DescribeInstancesCommand, StartInstancesCommand, StopInstancesCommand, RebootInstancesCommand, DescribeInstanceStatusCommand, DescribeVolumesCommand, ModifyInstanceAttributeCommand } from '@aws-sdk/client-ec2';
import { EKSClient, ListClustersCommand, DescribeClusterCommand, ListNodegroupsCommand, DescribeNodegroupCommand } from '@aws-sdk/client-eks';
import { CloudWatchClient, GetMetricStatisticsCommand } from '@aws-sdk/client-cloudwatch';

export class RealAwsService {
  private ec2Client: EC2Client;
  private eksClient: EKSClient;
  private cloudWatchClient: CloudWatchClient;

  constructor() {
    // Initialize AWS clients with default region
    const region = process.env.AWS_REGION || 'us-east-1';
    
    this.ec2Client = new EC2Client({ 
      region,
      // Use default credential chain (environment variables, IAM roles, etc.)
    });
    
    this.eksClient = new EKSClient({ 
      region,
    });
    
    this.cloudWatchClient = new CloudWatchClient({ 
      region,
    });
  }

  // EC2 Instance Methods
  async getInstances() {
    try {
      console.log('Fetching real EC2 instances from AWS...');
      const command = new DescribeInstancesCommand({});
      const result = await this.ec2Client.send(command);
      
      const instances = [];
      
      for (const reservation of result.Reservations || []) {
        for (const instance of reservation.Instances || []) {
          if (instance.InstanceId) {
            // Get volumes for this instance
            const volumes = await this.getInstanceVolumes(instance.InstanceId);
            
            instances.push({
              id: instance.InstanceId,
              name: this.getInstanceName(instance.Tags),
              type: instance.InstanceType || 'unknown',
              state: instance.State?.Name || 'unknown',
              publicIp: instance.PublicIpAddress || '',
              privateIp: instance.PrivateIpAddress || '',
              availabilityZone: instance.Placement?.AvailabilityZone || '',
              environment: this.getInstanceEnvironment(instance.Tags),
              launchTime: instance.LaunchTime?.toISOString() || '',
              volumes,
              tags: this.formatTags(instance.Tags),
              securityGroups: instance.SecurityGroups?.map(sg => ({
                id: sg.GroupId || '',
                name: sg.GroupName || ''
              })) || [],
              keyPair: instance.KeyName || '',
              monitoring: instance.Monitoring?.State === 'enabled',
              vpcId: instance.VpcId || '',
              subnetId: instance.SubnetId || ''
            });
          }
        }
      }
      
      console.log(`Found ${instances.length} real EC2 instances`);
      return instances;
    } catch (error) {
      console.error('Error fetching real EC2 instances:', error);
      // Return empty array if no AWS credentials or access
      return [];
    }
  }

  async startInstance(instanceId: string) {
    try {
      console.log(`Starting real EC2 instance: ${instanceId}`);
      const command = new StartInstancesCommand({
        InstanceIds: [instanceId]
      });
      await this.ec2Client.send(command);
      return { message: `Instance ${instanceId} start command sent successfully` };
    } catch (error) {
      console.error(`Error starting instance ${instanceId}:`, error);
      throw new Error(`Failed to start instance: ${error}`);
    }
  }

  async stopInstance(instanceId: string) {
    try {
      console.log(`Stopping real EC2 instance: ${instanceId}`);
      const command = new StopInstancesCommand({
        InstanceIds: [instanceId]
      });
      await this.ec2Client.send(command);
      return { message: `Instance ${instanceId} stop command sent successfully` };
    } catch (error) {
      console.error(`Error stopping instance ${instanceId}:`, error);
      throw new Error(`Failed to stop instance: ${error}`);
    }
  }

  async rebootInstance(instanceId: string) {
    try {
      console.log(`Rebooting real EC2 instance: ${instanceId}`);
      const command = new RebootInstancesCommand({
        InstanceIds: [instanceId]
      });
      await this.ec2Client.send(command);
      return { message: `Instance ${instanceId} reboot command sent successfully` };
    } catch (error) {
      console.error(`Error rebooting instance ${instanceId}:`, error);
      throw new Error(`Failed to reboot instance: ${error}`);
    }
  }

  async getInstanceStatus(instanceId: string) {
    try {
      const command = new DescribeInstanceStatusCommand({
        InstanceIds: [instanceId],
        IncludeAllInstances: true
      });
      const result = await this.ec2Client.send(command);
      const status = result.InstanceStatuses?.[0];
      
      return {
        status: status?.InstanceState?.Name || 'unknown',
        checks: status?.SystemStatus?.Status || 'unknown'
      };
    } catch (error) {
      console.error(`Error getting instance status ${instanceId}:`, error);
      return { status: 'unknown', checks: 'unknown' };
    }
  }

  async getInstanceMetrics(instanceId: string, metricName: string, startTime: Date, endTime: Date) {
    try {
      const command = new GetMetricStatisticsCommand({
        Namespace: 'AWS/EC2',
        MetricName: metricName,
        Dimensions: [
          {
            Name: 'InstanceId',
            Value: instanceId
          }
        ],
        StartTime: startTime,
        EndTime: endTime,
        Period: 300, // 5 minutes
        Statistics: ['Average', 'Maximum']
      });
      
      const result = await this.cloudWatchClient.send(command);
      return result.Datapoints?.map(point => ({
        timestamp: point.Timestamp,
        value: point.Average || point.Maximum || 0
      })) || [];
    } catch (error) {
      console.error(`Error getting metrics for instance ${instanceId}:`, error);
      return [];
    }
  }

  private async getInstanceVolumes(instanceId: string) {
    try {
      const command = new DescribeVolumesCommand({
        Filters: [
          {
            Name: 'attachment.instance-id',
            Values: [instanceId]
          }
        ]
      });
      
      const result = await this.ec2Client.send(command);
      return result.Volumes?.map(volume => ({
        id: volume.VolumeId || '',
        size: volume.Size || 0,
        type: volume.VolumeType || '',
        encrypted: volume.Encrypted || false,
        device: volume.Attachments?.[0]?.Device || ''
      })) || [];
    } catch (error) {
      console.error(`Error getting volumes for instance ${instanceId}:`, error);
      return [];
    }
  }

  private getInstanceName(tags?: any[]): string {
    const nameTag = tags?.find(tag => tag.Key === 'Name');
    return nameTag?.Value || 'Unnamed Instance';
  }

  private getInstanceEnvironment(tags?: any[]): string {
    const envTag = tags?.find(tag => tag.Key === 'Environment');
    return envTag?.Value || 'unknown';
  }

  private formatTags(tags?: any[]): Record<string, string> {
    const formattedTags: Record<string, string> = {};
    tags?.forEach(tag => {
      if (tag.Key && tag.Value) {
        formattedTags[tag.Key] = tag.Value;
      }
    });
    return formattedTags;
  }

  // EKS Cluster Methods
  async getClusters() {
    try {
      console.log('Fetching real EKS clusters from AWS...');
      const command = new ListClustersCommand({});
      const result = await this.eksClient.send(command);

      const clusters = [];

      for (const clusterName of result.clusters || []) {
        try {
          const clusterDetails = await this.getClusterDetails(clusterName);
          clusters.push(clusterDetails);
        } catch (error) {
          console.error(`Error getting details for cluster ${clusterName}:`, error);
        }
      }

      console.log(`Found ${clusters.length} real EKS clusters`);
      return clusters;
    } catch (error) {
      console.error('Error fetching real EKS clusters:', error);
      return [];
    }
  }

  async getClusterDetails(clusterName: string) {
    try {
      const command = new DescribeClusterCommand({
        name: clusterName
      });
      const result = await this.eksClient.send(command);
      const cluster = result.cluster;

      if (!cluster) {
        throw new Error(`Cluster ${clusterName} not found`);
      }

      // Get node groups
      const nodeGroups = await this.getClusterNodeGroups(clusterName);

      return {
        id: cluster.name || clusterName,
        name: cluster.name || clusterName,
        status: cluster.status || 'UNKNOWN',
        version: cluster.version || 'unknown',
        platformVersion: cluster.platformVersion || 'unknown',
        endpoint: cluster.endpoint || '',
        createdAt: cluster.createdAt?.toISOString() || '',
        region: process.env.AWS_REGION || 'us-east-1',
        environment: this.getClusterEnvironment(cluster.tags),
        nodeGroups,
        tags: cluster.tags || {},
        vpc: {
          id: cluster.resourcesVpcConfig?.vpcId || '',
          cidr: 'unknown', // Would need additional VPC API call
          subnets: {
            private: cluster.resourcesVpcConfig?.subnetIds?.map(id => ({ id, cidr: 'unknown', az: 'unknown' })) || [],
            public: []
          }
        },
        security: {
          clusterSecurityGroup: cluster.resourcesVpcConfig?.clusterSecurityGroupId || '',
          nodeSecurityGroup: 'unknown',
          endpointAccess: {
            private: (cluster.resourcesVpcConfig as any)?.endpointConfigResponse?.privateAccess || false,
            public: (cluster.resourcesVpcConfig as any)?.endpointConfigResponse?.publicAccess || false,
            publicCidrs: (cluster.resourcesVpcConfig as any)?.endpointConfigResponse?.publicAccessCidrs || []
          }
        },
        iam: {
          clusterRole: cluster.roleArn || '',
          nodeGroupRole: 'unknown'
        },
        logging: {
          enabled: cluster.logging?.clusterLogging?.map(log => log.types || []).flat() || [],
          logGroup: `/aws/eks/${clusterName}/cluster`
        },
        addons: [], // Would need additional EKS addons API call
        metrics: {
          cpuUtilization: 0,
          memoryUtilization: 0,
          networkIn: 0,
          networkOut: 0,
          podCount: 0,
          nodeCount: nodeGroups.reduce((sum, ng) => sum + (ng.desiredSize || 0), 0)
        }
      };
    } catch (error) {
      console.error(`Error getting cluster details for ${clusterName}:`, error);
      throw error;
    }
  }

  private async getClusterNodeGroups(clusterName: string) {
    try {
      const listCommand = new ListNodegroupsCommand({
        clusterName
      });
      const listResult = await this.eksClient.send(listCommand);

      const nodeGroups = [];

      for (const nodeGroupName of listResult.nodegroups || []) {
        try {
          const describeCommand = new DescribeNodegroupCommand({
            clusterName,
            nodegroupName: nodeGroupName
          });
          const describeResult = await this.eksClient.send(describeCommand);
          const nodeGroup = describeResult.nodegroup;

          if (nodeGroup) {
            nodeGroups.push({
              name: nodeGroup.nodegroupName || nodeGroupName,
              status: nodeGroup.status || 'UNKNOWN',
              instanceTypes: nodeGroup.instanceTypes || [],
              desiredSize: nodeGroup.scalingConfig?.desiredSize || 0,
              minSize: nodeGroup.scalingConfig?.minSize || 0,
              maxSize: nodeGroup.scalingConfig?.maxSize || 0,
              amiType: nodeGroup.amiType || 'unknown',
              capacityType: nodeGroup.capacityType || 'unknown'
            });
          }
        } catch (error) {
          console.error(`Error getting node group details for ${nodeGroupName}:`, error);
        }
      }

      return nodeGroups;
    } catch (error) {
      console.error(`Error getting node groups for cluster ${clusterName}:`, error);
      return [];
    }
  }

  private getClusterEnvironment(tags?: Record<string, string>): string {
    return tags?.Environment || tags?.environment || 'unknown';
  }

  // Scheduling methods (placeholder - would integrate with AWS Systems Manager or EventBridge)
  async scheduleAction(action: any) {
    console.log(`Scheduling action: ${JSON.stringify(action)}`);
    // In a real implementation, this would use AWS Systems Manager or EventBridge
    return `sched-${Date.now()}`;
  }

  async getScheduledActions(instanceId: string) {
    console.log(`Getting scheduled actions for instance: ${instanceId}`);
    // In a real implementation, this would query AWS Systems Manager or EventBridge
    return [];
  }
}
