import express from 'express';
import cors from 'cors';

const app = express();
const PORT = 5001;

// Basic middleware
app.use(cors({
  origin: [
    'http://localhost:3000',
    'http://localhost:3007',
  ],
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization'],
}));

app.use(express.json());

// Health check endpoint
app.get('/api/health', (req, res) => {
  res.json({ status: 'OK', message: 'Terraform Dashboard API is running' });
});

// Mock instances endpoint
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
  ]);
});

// Instance actions
app.post('/api/instances/:instanceId/start', (req, res) => {
  const { instanceId } = req.params;
  console.log(`Mock: Starting instance ${instanceId}`);
  res.json({ message: `Instance ${instanceId} start initiated` });
});

app.post('/api/instances/:instanceId/stop', (req, res) => {
  const { instanceId } = req.params;
  console.log(`Mock: Stopping instance ${instanceId}`);
  res.json({ message: `Instance ${instanceId} stop initiated` });
});

app.post('/api/instances/:instanceId/reboot', (req, res) => {
  const { instanceId } = req.params;
  console.log(`Mock: Rebooting instance ${instanceId}`);
  res.json({ message: `Instance ${instanceId} reboot initiated` });
});

// Mock templates endpoint
app.get('/api/templates', (req, res) => {
  res.json([
    {
      id: 'f478636f-63f4-47e6-a2e6-e647f628efd0',
      name: 'EC2 Instance',
      description: 'Deploy a single EC2 instance',
      category: 'Compute',
      terraformCode: 'resource "aws_instance" "main" {\n  ami = "ami-0c02fb55956c7d316"\n  instance_type = var.instance_type\n  tags = {\n    Name = var.name\n  }\n}',
      variables: [
        { name: 'name', type: 'string', description: 'Instance name', required: true },
        { name: 'instance_type', type: 'string', description: 'Instance type', required: true, default: 't3.micro' }
      ]
    }
  ]);
});

// Mock deployments endpoint
app.get('/api/deployments', (req, res) => {
  res.json([
    {
      id: '1',
      name: 'web-server-prod',
      templateId: 'f478636f-63f4-47e6-a2e6-e647f628efd0',
      status: 'success',
      environment: 'production',
      createdAt: '2024-01-15T10:30:00Z',
      logs: ['Deployment completed successfully']
    }
  ]);
});

// Stats endpoint
app.get('/api/stats', (req, res) => {
  res.json({
    totalInstances: 2,
    runningInstances: 1,
    totalVolumes: 3,
    activeDeployments: 1
  });
});

// Start the server
app.listen(PORT, () => {
  console.log(`🚀 Terraform Dashboard Backend running on port ${PORT}`);
  console.log(`🌐 Frontend URL: http://localhost:3000`);
  console.log(`📡 API URL: http://localhost:${PORT}`);
});

// Graceful shutdown
process.on('SIGTERM', () => {
  console.log('SIGTERM received, shutting down gracefully');
  process.exit(0);
});

process.on('SIGINT', () => {
  console.log('SIGINT received, shutting down gracefully');
  process.exit(0);
});
