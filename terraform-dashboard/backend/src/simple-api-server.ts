import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';

// Load environment variables
dotenv.config();

const app = express();
const PORT = process.env.PORT || 5000;

// Middleware
app.use(cors({
  origin: process.env.FRONTEND_URL || 'http://localhost:3000',
  credentials: true,
}));
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true }));

// Health check endpoint
app.get('/health', (req, res) => {
  res.json({
    status: 'OK',
    timestamp: new Date().toISOString(),
    uptime: process.uptime(),
    environment: process.env.NODE_ENV || 'development',
  });
});

// Simple API routes for demo
app.get('/api/health', (req, res) => {
  res.json({ status: 'OK', message: 'Terraform Dashboard API is running' });
});

app.get('/api/instances', (req, res) => {
  res.json([
    {
      id: 'i-0e43e6683baf16e35',
      name: 'web-server-prod',
      type: 't3.small',
      state: 'running',
      publicIp: '54.123.45.67',
      privateIp: '10.0.1.100',
      availabilityZone: 'us-east-1a',
      environment: 'production'
    },
    {
      id: 'i-0f44f7794caf27f46',
      name: 'database-dev',
      type: 't3.micro',
      state: 'stopped',
      publicIp: '',
      privateIp: '10.0.2.50',
      availabilityZone: 'us-east-1b',
      environment: 'development'
    }
  ]);
});

app.get('/api/templates', (req, res) => {
  res.json([
    {
      id: '1',
      name: 'EC2 Instance',
      description: 'Deploy a single EC2 instance with security group',
      category: 'Compute',
      variables: [
        { name: 'name', type: 'string', description: 'Instance name', required: true },
        { name: 'instance_type', type: 'string', description: 'Instance type', required: true, default: 't3.micro' }
      ]
    }
  ]);
});

app.get('/api/deployments', (req, res) => {
  res.json([
    {
      id: '1',
      name: 'web-server-prod',
      template: 'EC2 Instance',
      status: 'success',
      environment: 'production',
      lastUpdated: '2 hours ago'
    }
  ]);
});

app.get('/api/cost-analysis', (req, res) => {
  res.json({
    resources: [
      {
        id: 'i-0e43e6683baf16e35',
        name: 'web-server-prod',
        type: 't3.small',
        region: 'us-east-1',
        hourlyCost: 0.023,
        monthlyCost: 16.79,
        status: 'running',
      },
      {
        id: 'i-0f44f7794caf27f46',
        name: 'database-dev',
        type: 't3.micro',
        region: 'us-east-1',
        hourlyCost: 0.0104,
        monthlyCost: 7.59,
        status: 'stopped',
      },
      {
        id: 'vol-0633cb13ea3ede5c5',
        name: 'web-server-prod-vol',
        type: 'gp2-100GB',
        region: 'us-east-1',
        hourlyCost: 0.01,
        monthlyCost: 7.30,
        status: 'in-use',
      },
      {
        id: 'vol-0a44f7794caf27f46',
        name: 'database-dev-vol',
        type: 'gp2-50GB',
        region: 'us-east-1',
        hourlyCost: 0.005,
        monthlyCost: 3.65,
        status: 'available',
      },
      {
        id: 'nat-0633cb13ea3ede5c5',
        name: 'prod-nat-gateway',
        type: 'nat-gateway',
        region: 'us-east-1',
        hourlyCost: 0.045,
        monthlyCost: 32.85,
        status: 'available',
      },
    ],
    recommendations: [
      {
        id: 'rec-1',
        resourceId: 'i-0f44f7794caf27f46',
        resourceName: 'database-dev',
        resourceType: 't3.micro',
        recommendation: 'Terminate unused instance that has been stopped for over 30 days',
        potentialSavings: 7.59,
        severity: 'high',
      },
      {
        id: 'rec-2',
        resourceId: 'vol-0a44f7794caf27f46',
        resourceName: 'database-dev-vol',
        resourceType: 'gp2-50GB',
        recommendation: 'Delete unattached EBS volume',
        potentialSavings: 3.65,
        severity: 'medium',
      },
      {
        id: 'rec-3',
        resourceId: 'i-0e43e6683baf16e35',
        resourceName: 'web-server-prod',
        resourceType: 't3.small',
        recommendation: 'Downsize to t3.micro based on usage patterns',
        potentialSavings: 9.20,
        severity: 'low',
      },
    ],
    totalMonthlyCost: 68.18,
    potentialSavings: 20.44,
  });
});

app.get('/api/security-center', (req, res) => {
  const mockIssues = [
    {
      id: 'sec-001',
      resourceId: 'sg-0e43e6683baf16e35',
      resourceName: 'web-server-sg',
      resourceType: 'security-group',
      category: 'network',
      description: 'Security group allows unrestricted access (0.0.0.0/0) to port 22',
      severity: 'critical',
      status: 'open',
      detectedAt: '2023-10-15T14:30:00Z',
      remediation: 'Restrict SSH access to specific IP ranges or use a bastion host',
    },
    {
      id: 'sec-002',
      resourceId: 's3-app-logs',
      resourceName: 'app-logs-bucket',
      resourceType: 's3-bucket',
      category: 'encryption',
      description: 'S3 bucket does not have server-side encryption enabled',
      severity: 'high',
      status: 'in_progress',
      detectedAt: '2023-10-14T09:15:00Z',
      remediation: 'Enable default encryption using AES-256 or AWS KMS',
    },
    {
      id: 'sec-003',
      resourceId: 'i-0f44f7794caf27f46',
      resourceName: 'database-dev',
      resourceType: 'ec2-instance',
      category: 'compliance',
      description: 'Instance is running an outdated AMI with known vulnerabilities',
      severity: 'high',
      status: 'open',
      detectedAt: '2023-10-13T11:45:00Z',
      remediation: 'Update to the latest AMI version and apply security patches',
    },
    {
      id: 'sec-004',
      resourceId: 'iam-admin-policy',
      resourceName: 'admin-policy',
      resourceType: 'iam-policy',
      category: 'access',
      description: 'IAM policy grants excessive permissions to non-admin users',
      severity: 'medium',
      status: 'open',
      detectedAt: '2023-10-12T16:20:00Z',
      remediation: 'Apply least privilege principle and restrict permissions',
    },
    {
      id: 'sec-005',
      resourceId: 'rds-prod-db',
      resourceName: 'production-database',
      resourceType: 'rds-instance',
      category: 'configuration',
      description: 'Database instance does not have automatic backups enabled',
      severity: 'medium',
      status: 'resolved',
      detectedAt: '2023-10-10T08:30:00Z',
      remediation: 'Enable automatic backups with appropriate retention period',
    },
    {
      id: 'sec-006',
      resourceId: 'vpc-flow-logs',
      resourceName: 'main-vpc',
      resourceType: 'vpc',
      category: 'compliance',
      description: 'VPC flow logs are not enabled for network monitoring',
      severity: 'low',
      status: 'open',
      detectedAt: '2023-10-09T13:10:00Z',
      remediation: 'Enable VPC flow logs and send to CloudWatch or S3',
    },
  ];

  const openIssues = mockIssues.filter(issue => issue.status !== 'resolved');
  const criticalCount = openIssues.filter(issue => issue.severity === 'critical').length;
  const highCount = openIssues.filter(issue => issue.severity === 'high').length;
  const mediumCount = openIssues.filter(issue => issue.severity === 'medium').length;
  const lowCount = openIssues.filter(issue => issue.severity === 'low').length;
  
  // Calculate a simple security score (0-100)
  // Higher weight for critical and high issues
  const totalWeight = openIssues.length > 0 ? 
    (criticalCount * 10) + (highCount * 5) + (mediumCount * 2) + lowCount : 0;
  const maxPossibleScore = 100;
  const securityScore = Math.max(0, Math.min(100, Math.round(maxPossibleScore - totalWeight)));

  res.json({
    issues: mockIssues,
    summary: {
      totalIssues: openIssues.length,
      criticalIssues: criticalCount,
      highIssues: highCount,
      mediumIssues: mediumCount,
      lowIssues: lowCount,
      securityScore: securityScore,
      lastScanTime: new Date().toISOString(),
    }
  });
});

// 404 handler
app.use((req, res) => {
  res.status(404).json({
    error: 'Not Found',
    message: `Route ${req.originalUrl} not found`,
  });
});

// Start server
app.listen(PORT, () => {
  console.log(`🚀 Simple API server running on port ${PORT}`);
  console.log(`📊 Dashboard URL: ${process.env.FRONTEND_URL || 'http://localhost:3000'}`);
  console.log(`🔧 Environment: ${process.env.NODE_ENV || 'development'}`);
});