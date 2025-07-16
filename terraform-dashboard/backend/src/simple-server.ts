import express from 'express';
import cors from 'cors';
import { initializeDatabase } from './database/database';
import dotenv from 'dotenv';
import instancesRouter from './routes/instances';
import clustersRouter from './routes/clusters';
import templatesRouter from './routes/templates';
import deploymentsRouter from './routes/deployments';
import githubRouter from './routes/github';
import authRouter from './routes/auth';
import ansibleRouter from './routes/ansible';
// import ansibleExecutionRouter from './routes/ansible-execution';
import vpcRouter from './routes/vpc-resources';
import healthRouter, { requestCounter } from './routes/health';
import { performanceMiddleware, getPerformanceMetrics, resetPerformanceMetrics } from './middleware/performance';

// Load environment variables
dotenv.config();

const app = express();
const PORT = process.env.PORT || 5000;

// Basic middleware
app.use(cors({
  origin: true, // Allow all origins for development
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization'],
}));

app.use(express.json());

// Request counter middleware
app.use(requestCounter);

// Performance monitoring middleware
app.use(performanceMiddleware);

// Health check routes (before other routes)
app.use('/api/health', healthRouter);

// Performance metrics routes
app.get('/api/metrics', getPerformanceMetrics);
app.post('/api/metrics/reset', resetPerformanceMetrics);

// Authentication routes (must come before protected routes)
app.use('/api/auth', authRouter);

// API Routes - Use real AWS data
app.use('/api/instances', instancesRouter);
app.use('/api/clusters', clustersRouter);
app.use('/api/templates', templatesRouter);
app.use('/api/deployments', deploymentsRouter);
app.use('/api/github', githubRouter);
app.use('/api/ansible', ansibleRouter);
// app.use('/api/ansible-execution', ansibleExecutionRouter);
app.use('/api/vpc-resources', vpcRouter);

// Health check endpoint
app.get('/health', (req, res) => {
  res.status(200).json({ 
    status: 'OK', 
    timestamp: new Date().toISOString(),
    uptime: process.uptime()
  });
});

// API health check
app.get('/api/health', (req, res) => {
  res.json({ status: 'OK', message: 'Terraform Dashboard API is running' });
});

// Start the server
const startServer = async () => {
  try {
    await initializeDatabase();
    console.log('✅ Database initialized');

    app.listen(PORT, () => {
      console.log(`🚀 Terraform Dashboard Backend running on port ${PORT}`);
      console.log(`🌐 Frontend URL: http://localhost:3000`);
      console.log(`📡 API URL: http://localhost:${PORT}`);
    });
  } catch (error) {
    console.error('❌ Failed to start server:', error);
    process.exit(1);
  }
};

startServer();

// Graceful shutdown
process.on('SIGTERM', () => {
  console.log('SIGTERM received, shutting down gracefully');
  process.exit(0);
});

process.on('SIGINT', () => {
  console.log('SIGINT received, shutting down gracefully');
  process.exit(0);
});
