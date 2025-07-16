import express from 'express';
import AWS from 'aws-sdk';
import { authenticateToken } from '../middleware/auth';

const router = express.Router();

// Apply authentication middleware to all routes
router.use(authenticateToken);

// Configure AWS SDK
AWS.config.update({
  region: process.env.AWS_REGION || 'us-east-1',
  accessKeyId: process.env.AWS_ACCESS_KEY_ID,
  secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY,
});

const ec2 = new AWS.EC2();

interface VPCResource {
  id: string;
  name: string;
  cidrBlock: string;
  state: string;
  isDefault: boolean;
  resources: {
    subnets: any[];
    routeTables: any[];
    internetGateways: any[];
    natGateways: any[];
    securityGroups: any[];
    networkAcls: any[];
    vpcEndpoints: any[];
  };
  tags: any[];
}

// Get all VPC resources
router.get('/', async (req, res, next) => {
  try {
    console.log('🔍 Fetching VPC resources...');

    // Try to fetch real AWS data first
    try {
      const realVPCData = await fetchRealVPCData();
      console.log('✅ Returning real VPC data');
      res.json(realVPCData);
    } catch (awsError) {
      console.warn('⚠️ AWS credentials not configured or error fetching real data:', awsError);
      console.log('✅ Falling back to mock VPC data');
      res.json(getMockVPCData());
    }

  } catch (error) {
    console.error('❌ Error fetching VPC resources:', error);
    next(error);
  }
});

// Get details for a specific VPC
router.get('/:vpcId', async (req, res, next) => {
  try {
    const { vpcId } = req.params;
    console.log(`🔍 Fetching details for VPC: ${vpcId}`);

    // Try to fetch real AWS data first
    try {
      const realVPCData = await fetchRealVPCData();
      const vpc = realVPCData.find(v => v.id === vpcId);

      if (vpc) {
        console.log('✅ Returning real VPC details');
        res.json(vpc);
      } else {
        res.status(404).json({ error: 'VPC not found' });
      }
    } catch (awsError) {
      console.warn('⚠️ AWS credentials not configured, falling back to mock data');
      const mockData = getMockVPCData();
      const vpc = mockData.find(v => v.id === vpcId);

      if (vpc) {
        res.json(vpc);
      } else {
        res.status(404).json({ error: 'VPC not found' });
      }
    }

  } catch (error) {
    console.error('❌ Error fetching VPC details:', error);
    next(error);
  }
});

// Fetch real VPC data from AWS
async function fetchRealVPCData(): Promise<VPCResource[]> {
  console.log('🔍 Fetching real VPC data from AWS...');

  // Get all VPCs
  const vpcsResult = await ec2.describeVpcs().promise();
  const vpcs: VPCResource[] = [];

  for (const vpc of vpcsResult.Vpcs || []) {
    if (!vpc.VpcId) continue;

    console.log(`📋 Processing VPC: ${vpc.VpcId}`);

    // Get VPC name from tags
    const vpcName = vpc.Tags?.find(tag => tag.Key === 'Name')?.Value || vpc.VpcId;

    // Fetch all resources for this VPC
    const [subnets, routeTables, internetGateways, natGateways, securityGroups, networkAcls, vpcEndpoints] = await Promise.all([
      fetchSubnets(vpc.VpcId),
      fetchRouteTables(vpc.VpcId),
      fetchInternetGateways(vpc.VpcId),
      fetchNatGateways(vpc.VpcId),
      fetchSecurityGroups(vpc.VpcId),
      fetchNetworkAcls(vpc.VpcId),
      fetchVpcEndpoints(vpc.VpcId)
    ]);

    vpcs.push({
      id: vpc.VpcId,
      name: vpcName,
      cidrBlock: vpc.CidrBlock || '',
      state: vpc.State || 'unknown',
      isDefault: vpc.IsDefault || false,
      resources: {
        subnets,
        routeTables,
        internetGateways,
        natGateways,
        securityGroups,
        networkAcls,
        vpcEndpoints
      },
      tags: vpc.Tags || []
    });
  }

  console.log(`✅ Fetched ${vpcs.length} VPCs from AWS`);
  return vpcs;
}

// Helper functions to fetch VPC resources
async function fetchSubnets(vpcId: string) {
  const result = await ec2.describeSubnets({
    Filters: [{ Name: 'vpc-id', Values: [vpcId] }]
  }).promise();

  return (result.Subnets || []).map(subnet => ({
    id: subnet.SubnetId || '',
    name: subnet.Tags?.find(tag => tag.Key === 'Name')?.Value || subnet.SubnetId || '',
    cidrBlock: subnet.CidrBlock || '',
    availabilityZone: subnet.AvailabilityZone || '',
    availableIpAddressCount: subnet.AvailableIpAddressCount || 0,
    state: subnet.State || 'unknown',
    isPublic: subnet.MapPublicIpOnLaunch || false,
    tags: subnet.Tags || []
  }));
}

async function fetchRouteTables(vpcId: string) {
  const result = await ec2.describeRouteTables({
    Filters: [{ Name: 'vpc-id', Values: [vpcId] }]
  }).promise();

  return (result.RouteTables || []).map(rt => ({
    id: rt.RouteTableId || '',
    name: rt.Tags?.find(tag => tag.Key === 'Name')?.Value || rt.RouteTableId || '',
    routes: (rt.Routes || []).map(route => ({
      destinationCidrBlock: route.DestinationCidrBlock || '',
      gatewayId: route.GatewayId || '',
      natGatewayId: route.NatGatewayId || '',
      state: route.State || 'unknown'
    })),
    associations: (rt.Associations || []).map(assoc => ({
      subnetId: assoc.SubnetId || '',
      main: assoc.Main || false
    })),
    tags: rt.Tags || []
  }));
}

async function fetchInternetGateways(vpcId: string) {
  const result = await ec2.describeInternetGateways({
    Filters: [{ Name: 'attachment.vpc-id', Values: [vpcId] }]
  }).promise();

  return (result.InternetGateways || []).map(igw => ({
    id: igw.InternetGatewayId || '',
    name: igw.Tags?.find(tag => tag.Key === 'Name')?.Value || igw.InternetGatewayId || '',
    state: igw.Attachments?.[0]?.State || 'unknown',
    attachments: igw.Attachments || [],
    tags: igw.Tags || []
  }));
}

async function fetchNatGateways(vpcId: string) {
  const result = await ec2.describeNatGateways({
    Filter: [{ Name: 'vpc-id', Values: [vpcId] }]
  }).promise();

  return (result.NatGateways || []).map(nat => ({
    id: nat.NatGatewayId || '',
    name: nat.Tags?.find(tag => tag.Key === 'Name')?.Value || nat.NatGatewayId || '',
    state: nat.State || 'unknown',
    subnetId: nat.SubnetId || '',
    publicIp: nat.NatGatewayAddresses?.[0]?.PublicIp || '',
    privateIp: nat.NatGatewayAddresses?.[0]?.PrivateIp || '',
    tags: nat.Tags || []
  }));
}

async function fetchSecurityGroups(vpcId: string) {
  const result = await ec2.describeSecurityGroups({
    Filters: [{ Name: 'vpc-id', Values: [vpcId] }]
  }).promise();

  return (result.SecurityGroups || []).map(sg => ({
    id: sg.GroupId || '',
    name: sg.GroupName || '',
    description: sg.Description || '',
    inboundRules: sg.IpPermissions?.length || 0,
    outboundRules: sg.IpPermissionsEgress?.length || 0,
    tags: sg.Tags || []
  }));
}

async function fetchNetworkAcls(vpcId: string) {
  const result = await ec2.describeNetworkAcls({
    Filters: [{ Name: 'vpc-id', Values: [vpcId] }]
  }).promise();

  return (result.NetworkAcls || []).map(acl => ({
    id: acl.NetworkAclId || '',
    name: acl.Tags?.find(tag => tag.Key === 'Name')?.Value || acl.NetworkAclId || '',
    isDefault: acl.IsDefault || false,
    entries: acl.Entries?.length || 0,
    associations: acl.Associations?.length || 0,
    tags: acl.Tags || []
  }));
}

async function fetchVpcEndpoints(vpcId: string) {
  const result = await ec2.describeVpcEndpoints({
    Filters: [{ Name: 'vpc-id', Values: [vpcId] }]
  }).promise();

  return (result.VpcEndpoints || []).map(endpoint => ({
    id: endpoint.VpcEndpointId || '',
    name: endpoint.Tags?.find(tag => tag.Key === 'Name')?.Value || endpoint.VpcEndpointId || '',
    type: endpoint.VpcEndpointType || 'unknown',
    state: endpoint.State || 'unknown',
    serviceName: endpoint.ServiceName || '',
    tags: endpoint.Tags || []
  }));
}

// Mock data for VPC resources
function getMockVPCData(): VPCResource[] {
  return [
    {
      id: 'vpc-12345678',
      name: 'Production VPC',
      cidrBlock: '10.0.0.0/16',
      state: 'available',
      isDefault: false,
      resources: {
        subnets: [
          {
            id: 'subnet-12345678',
            name: 'Public Subnet 1',
            cidrBlock: '10.0.1.0/24',
            availabilityZone: 'us-east-1a',
            availableIpAddressCount: 251,
            state: 'available',
            isPublic: true,
            tags: [{ Key: 'Name', Value: 'Public Subnet 1' }]
          },
          {
            id: 'subnet-87654321',
            name: 'Private Subnet 1',
            cidrBlock: '10.0.2.0/24',
            availabilityZone: 'us-east-1b',
            availableIpAddressCount: 251,
            state: 'available',
            isPublic: false,
            tags: [{ Key: 'Name', Value: 'Private Subnet 1' }]
          },
          {
            id: 'subnet-11223344',
            name: 'Database Subnet 1',
            cidrBlock: '10.0.3.0/24',
            availabilityZone: 'us-east-1c',
            availableIpAddressCount: 251,
            state: 'available',
            isPublic: false,
            tags: [{ Key: 'Name', Value: 'Database Subnet 1' }, { Key: 'Tier', Value: 'Database' }]
          }
        ],
        routeTables: [
          {
            id: 'rtb-12345678',
            name: 'Public Route Table',
            routes: [
              {
                destinationCidrBlock: '10.0.0.0/16',
                gatewayId: 'local',
                state: 'active'
              },
              {
                destinationCidrBlock: '0.0.0.0/0',
                gatewayId: 'igw-12345678',
                state: 'active'
              }
            ],
            associations: [
              { subnetId: 'subnet-12345678', main: false }
            ],
            tags: [{ Key: 'Name', Value: 'Public Route Table' }]
          },
          {
            id: 'rtb-87654321',
            name: 'Private Route Table',
            routes: [
              {
                destinationCidrBlock: '10.0.0.0/16',
                gatewayId: 'local',
                state: 'active'
              },
              {
                destinationCidrBlock: '0.0.0.0/0',
                natGatewayId: 'nat-12345678',
                state: 'active'
              }
            ],
            associations: [
              { subnetId: 'subnet-87654321', main: false },
              { subnetId: 'subnet-11223344', main: false }
            ],
            tags: [{ Key: 'Name', Value: 'Private Route Table' }]
          }
        ],
        internetGateways: [
          {
            id: 'igw-12345678',
            name: 'Production Internet Gateway',
            state: 'attached',
            tags: [{ Key: 'Name', Value: 'Production Internet Gateway' }]
          }
        ],
        natGateways: [
          {
            id: 'nat-12345678',
            name: 'Production NAT Gateway',
            state: 'available',
            subnetId: 'subnet-12345678',
            publicIp: '54.123.45.67',
            privateIp: '10.0.1.100',
            tags: [{ Key: 'Name', Value: 'Production NAT Gateway' }]
          }
        ],
        securityGroups: [
          {
            id: 'sg-12345678',
            name: 'web-servers',
            description: 'Security group for web servers',
            inboundRules: 3,
            outboundRules: 1,
            tags: [{ Key: 'Name', Value: 'web-servers' }]
          },
          {
            id: 'sg-87654321',
            name: 'database-servers',
            description: 'Security group for database servers',
            inboundRules: 2,
            outboundRules: 1,
            tags: [{ Key: 'Name', Value: 'database-servers' }]
          },
          {
            id: 'sg-11223344',
            name: 'application-servers',
            description: 'Security group for application servers',
            inboundRules: 4,
            outboundRules: 1,
            tags: [{ Key: 'Name', Value: 'application-servers' }]
          }
        ],
        networkAcls: [
          {
            id: 'acl-12345678',
            name: 'Production Network ACL',
            isDefault: false,
            entries: 6,
            associations: 3,
            tags: [{ Key: 'Name', Value: 'Production Network ACL' }]
          }
        ],
        vpcEndpoints: [
          {
            id: 'vpce-12345678',
            name: 'S3 VPC Endpoint',
            type: 'Gateway',
            state: 'available',
            serviceName: 'com.amazonaws.us-east-1.s3',
            tags: [{ Key: 'Name', Value: 'S3 VPC Endpoint' }]
          },
          {
            id: 'vpce-87654321',
            name: 'EC2 VPC Endpoint',
            type: 'Interface',
            state: 'available',
            serviceName: 'com.amazonaws.us-east-1.ec2',
            tags: [{ Key: 'Name', Value: 'EC2 VPC Endpoint' }]
          }
        ]
      },
      tags: [
        { Key: 'Name', Value: 'Production VPC' },
        { Key: 'Environment', Value: 'Production' },
        { Key: 'ManagedBy', Value: 'terraform-dashboard' }
      ]
    },
    {
      id: 'vpc-87654321',
      name: 'Development VPC',
      cidrBlock: '172.31.0.0/16',
      state: 'available',
      isDefault: true,
      resources: {
        subnets: [
          {
            id: 'subnet-dev-001',
            name: 'Default Subnet 1',
            cidrBlock: '172.31.0.0/20',
            availabilityZone: 'us-east-1a',
            availableIpAddressCount: 4091,
            state: 'available',
            isPublic: true,
            tags: []
          },
          {
            id: 'subnet-dev-002',
            name: 'Default Subnet 2',
            cidrBlock: '172.31.16.0/20',
            availabilityZone: 'us-east-1b',
            availableIpAddressCount: 4091,
            state: 'available',
            isPublic: true,
            tags: []
          }
        ],
        routeTables: [
          {
            id: 'rtb-default',
            name: 'Default Route Table',
            routes: [
              {
                destinationCidrBlock: '172.31.0.0/16',
                gatewayId: 'local',
                state: 'active'
              },
              {
                destinationCidrBlock: '0.0.0.0/0',
                gatewayId: 'igw-default',
                state: 'active'
              }
            ],
            associations: [
              { subnetId: 'subnet-dev-001', main: false },
              { subnetId: 'subnet-dev-002', main: false }
            ],
            tags: []
          }
        ],
        internetGateways: [
          {
            id: 'igw-default',
            name: 'Default Internet Gateway',
            state: 'attached',
            tags: []
          }
        ],
        natGateways: [],
        securityGroups: [
          {
            id: 'sg-default',
            name: 'default',
            description: 'Default security group',
            inboundRules: 1,
            outboundRules: 1,
            tags: []
          }
        ],
        networkAcls: [
          {
            id: 'acl-default',
            name: 'Default Network ACL',
            isDefault: true,
            entries: 4,
            associations: 2,
            tags: []
          }
        ],
        vpcEndpoints: []
      },
      tags: [
        { Key: 'Name', Value: 'Development VPC' },
        { Key: 'Environment', Value: 'Development' }
      ]
    }
  ];
}

export default router;
