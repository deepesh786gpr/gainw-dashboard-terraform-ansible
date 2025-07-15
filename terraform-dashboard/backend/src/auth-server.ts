import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import { initializeDatabase } from './database/database';
import { errorHandler } from './middleware/errorHandler';

// Import routes
import authRoutes from './routes/simple-auth';

// Load environment variables
dotenv.config();

const app = express();
const PORT = process.env.PORT || 5000;

// Middleware
app.use(cors({
  origin: process.env.FRONTEND_URL || 'http://localhost:3006',
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

// API routes
app.use('/api/auth', authRoutes);

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

// Error handling middleware
app.use(errorHandler);

// 404 handler
app.use('*', (req, res) => {
  res.status(404).json({
    error: 'Not Found',
    message: `Route ${req.originalUrl} not found`,
  });
});

// Initialize database and start server
async function startServer() {
  try {
    await initializeDatabase();
    console.log('✅ Database initialized successfully');

    app.listen(PORT, () => {
      console.log(`🚀 Terraform Dashboard API server running on port ${PORT}`);
      console.log(`📊 Dashboard URL: ${process.env.FRONTEND_URL || 'http://localhost:3006'}`);
      console.log(`🔧 Environment: ${process.env.NODE_ENV || 'development'}`);
      console.log(`🔐 Default admin credentials: admin / admin123`);
    });
  } catch (error) {
    console.error('❌ Failed to start server:', error);
    process.exit(1);
  }
}

// Graceful shutdown
process.on('SIGTERM', () => {
  console.log('SIGTERM received, shutting down gracefully');
  process.exit(0);
});

process.on('SIGINT', () => {
  console.log('SIGINT received, shutting down gracefully');
  process.exit(0);
});

startServer();
