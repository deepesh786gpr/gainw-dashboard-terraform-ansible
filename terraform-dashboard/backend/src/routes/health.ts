import express from 'express';
import { db } from '../database/database';
import { RealAwsService } from '../services/realAwsService';

const router = express.Router();

interface HealthStatus {
  status: 'healthy' | 'degraded' | 'unhealthy';
  timestamp: string;
  uptime: number;
  version: string;
  services: {
    database: ServiceStatus;
    aws: ServiceStatus;
    github: ServiceStatus;
  };
  metrics: {
    memoryUsage: NodeJS.MemoryUsage;
    cpuUsage: number;
    requestCount: number;
  };
}

interface ServiceStatus {
  status: 'healthy' | 'degraded' | 'unhealthy';
  responseTime?: number;
  error?: string;
  lastCheck: string;
}

// Request counter for metrics
let requestCount = 0;

// Middleware to count requests
export const requestCounter = (req: express.Request, res: express.Response, next: express.NextFunction) => {
  requestCount++;
  next();
};

// Check database health
async function checkDatabase(): Promise<ServiceStatus> {
  const start = Date.now();
  try {
    await db.get('SELECT 1');
    return {
      status: 'healthy',
      responseTime: Date.now() - start,
      lastCheck: new Date().toISOString(),
    };
  } catch (error) {
    return {
      status: 'unhealthy',
      responseTime: Date.now() - start,
      error: error instanceof Error ? error.message : 'Unknown error',
      lastCheck: new Date().toISOString(),
    };
  }
}

// Check AWS connectivity
async function checkAWS(): Promise<ServiceStatus> {
  const start = Date.now();
  try {
    const awsService = new RealAwsService();
    // Try to get instances (this will test AWS credentials and connectivity)
    await awsService.getInstances();
    return {
      status: 'healthy',
      responseTime: Date.now() - start,
      lastCheck: new Date().toISOString(),
    };
  } catch (error) {
    // AWS not configured is not necessarily unhealthy, just degraded
    const isCredentialError = error instanceof Error && 
      (error.message.includes('credentials') || error.message.includes('Unable to locate credentials'));
    
    return {
      status: isCredentialError ? 'degraded' : 'unhealthy',
      responseTime: Date.now() - start,
      error: error instanceof Error ? error.message : 'Unknown error',
      lastCheck: new Date().toISOString(),
    };
  }
}

// Check GitHub API connectivity
async function checkGitHub(): Promise<ServiceStatus> {
  const start = Date.now();
  try {
    // Simple check to GitHub API without authentication
    const response = await fetch('https://api.github.com/rate_limit');
    if (response.ok) {
      return {
        status: 'healthy',
        responseTime: Date.now() - start,
        lastCheck: new Date().toISOString(),
      };
    } else {
      return {
        status: 'degraded',
        responseTime: Date.now() - start,
        error: `HTTP ${response.status}`,
        lastCheck: new Date().toISOString(),
      };
    }
  } catch (error) {
    return {
      status: 'unhealthy',
      responseTime: Date.now() - start,
      error: error instanceof Error ? error.message : 'Unknown error',
      lastCheck: new Date().toISOString(),
    };
  }
}

// Get CPU usage (simplified)
function getCpuUsage(): number {
  const usage = process.cpuUsage();
  return Math.round((usage.user + usage.system) / 1000000); // Convert to milliseconds
}

// Main health check endpoint
router.get('/', async (req, res) => {
  try {
    const startTime = Date.now();
    
    // Check all services in parallel
    const [databaseStatus, awsStatus, githubStatus] = await Promise.all([
      checkDatabase(),
      checkAWS(),
      checkGitHub(),
    ]);

    // Determine overall status
    let overallStatus: 'healthy' | 'degraded' | 'unhealthy' = 'healthy';
    
    if (databaseStatus.status === 'unhealthy') {
      overallStatus = 'unhealthy';
    } else if (
      databaseStatus.status === 'degraded' ||
      awsStatus.status === 'degraded' ||
      githubStatus.status === 'degraded'
    ) {
      overallStatus = 'degraded';
    }

    const healthStatus: HealthStatus = {
      status: overallStatus,
      timestamp: new Date().toISOString(),
      uptime: Math.floor(process.uptime()),
      version: process.env.npm_package_version || '1.0.0',
      services: {
        database: databaseStatus,
        aws: awsStatus,
        github: githubStatus,
      },
      metrics: {
        memoryUsage: process.memoryUsage(),
        cpuUsage: getCpuUsage(),
        requestCount,
      },
    };

    // Set appropriate HTTP status code
    const statusCode = overallStatus === 'healthy' ? 200 : 
                      overallStatus === 'degraded' ? 200 : 503;

    res.status(statusCode).json(healthStatus);
  } catch (error) {
    console.error('Health check failed:', error);
    res.status(503).json({
      status: 'unhealthy',
      timestamp: new Date().toISOString(),
      error: error instanceof Error ? error.message : 'Health check failed',
    });
  }
});

// Detailed health check with more information
router.get('/detailed', async (req, res) => {
  try {
    const [databaseStatus, awsStatus, githubStatus] = await Promise.all([
      checkDatabase(),
      checkAWS(),
      checkGitHub(),
    ]);

    // Get additional system information
    const systemInfo = {
      platform: process.platform,
      arch: process.arch,
      nodeVersion: process.version,
      pid: process.pid,
      uptime: process.uptime(),
      memoryUsage: process.memoryUsage(),
      cpuUsage: process.cpuUsage(),
      env: process.env.NODE_ENV || 'development',
    };

    // Get database statistics
    let dbStats = {};
    try {
      const templates = await db.get('SELECT COUNT(*) as count FROM templates');
      const deployments = await db.get('SELECT COUNT(*) as count FROM deployments');
      dbStats = {
        templates: templates.count,
        deployments: deployments.count,
      };
    } catch (error) {
      dbStats = { error: 'Unable to fetch database statistics' };
    }

    res.json({
      status: 'detailed_health_check',
      timestamp: new Date().toISOString(),
      system: systemInfo,
      services: {
        database: { ...databaseStatus, stats: dbStats },
        aws: awsStatus,
        github: githubStatus,
      },
      metrics: {
        requestCount,
        uptime: process.uptime(),
        memoryUsage: process.memoryUsage(),
      },
    });
  } catch (error) {
    console.error('Detailed health check failed:', error);
    res.status(500).json({
      status: 'error',
      timestamp: new Date().toISOString(),
      error: error instanceof Error ? error.message : 'Detailed health check failed',
    });
  }
});

// Simple liveness probe
router.get('/live', (req, res) => {
  res.status(200).json({
    status: 'alive',
    timestamp: new Date().toISOString(),
    uptime: process.uptime(),
  });
});

// Simple readiness probe
router.get('/ready', async (req, res) => {
  try {
    // Check if database is accessible
    await db.get('SELECT 1');
    res.status(200).json({
      status: 'ready',
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    res.status(503).json({
      status: 'not_ready',
      timestamp: new Date().toISOString(),
      error: error instanceof Error ? error.message : 'Database not accessible',
    });
  }
});

export default router;
