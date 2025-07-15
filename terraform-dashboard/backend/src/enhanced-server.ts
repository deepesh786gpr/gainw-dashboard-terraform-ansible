import express from 'express';
import cors from 'cors';
import compression from 'compression';
import { createServer } from 'http';
import { config } from 'dotenv';
import { logger, requestLogger } from './utils/logger';
import { errorHandler, notFoundHandler } from './middleware/errorHandler';
import { securityHeaders, rateLimiters, requestId, sanitizeInput } from './middleware/security';
import { performanceMiddleware, performanceService } from './services/performanceService';
import { cacheService } from './services/cacheService';
import { WebSocketService, websocketService as wsService } from './services/websocketService';
import { initializeDatabase } from './database/database';

// Import routes
import authRoutes from './routes/auth';
import deploymentRoutes from './routes/deployments';
import templateRoutes from './routes/templates';
import instanceRoutes from './routes/instances';
import terraformRoutes from './routes/terraform';
import usersRoutes from './routes/users';
import rolesRoutes from './routes/roles';
import githubTokensRoutes from './routes/github-tokens';
import healthRoutes from './routes/health';
import settingsRoutes from './routes/settings';
import githubRoutes from './routes/github';

// Load environment variables
config();

class EnhancedServer {
  private app: express.Application;
  private server: any;
  private port: number;

  constructor() {
    this.app = express();
    this.port = parseInt(process.env.PORT || '5000');
    
    this.setupMiddleware();
    this.setupRoutes();
    this.setupErrorHandling();
  }

  private setupMiddleware() {
    // Security and performance middleware
    this.app.use(securityHeaders);
    this.app.use(compression());
    this.app.use(requestId);
    this.app.use(requestLogger);
    this.app.use(performanceMiddleware);
    
    // Rate limiting
    this.app.use('/api/auth', rateLimiters.auth);
    this.app.use('/api/terraform', rateLimiters.deployment);
    this.app.use('/api', rateLimiters.general);
    
    // CORS configuration
    this.app.use(cors({
      origin: process.env.FRONTEND_URL || 'http://localhost:3000',
      credentials: true,
      methods: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH', 'OPTIONS'],
      allowedHeaders: ['Content-Type', 'Authorization', 'X-Request-ID'],
    }));
    
    // Body parsing
    this.app.use(express.json({ limit: '10mb' }));
    this.app.use(express.urlencoded({ extended: true, limit: '10mb' }));
    
    // Input sanitization
    this.app.use(sanitizeInput);
  }

  private setupRoutes() {
    // Health check endpoint
    this.app.get('/health', async (req, res) => {
      const healthStatus = performanceService.getHealthStatus();
      const systemMetrics = await performanceService.getSystemMetrics();
      
      res.status(healthStatus.status === 'critical' ? 503 : 200).json({
        status: healthStatus.status,
        timestamp: new Date().toISOString(),
        uptime: process.uptime(),
        version: process.env.npm_package_version || '1.0.0',
        environment: process.env.NODE_ENV || 'development',
        health: healthStatus,
        metrics: systemMetrics,
      });
    });

    // API routes
    this.app.use('/api/auth', authRoutes);
    this.app.use('/api/users', usersRoutes);
    this.app.use('/api/roles', rolesRoutes);
    this.app.use('/api/github-tokens', githubTokensRoutes);
    this.app.use('/api/deployments', deploymentRoutes);
    this.app.use('/api/templates', templateRoutes);
    this.app.use('/api/instances', instanceRoutes);
    this.app.use('/api/terraform', terraformRoutes);
    this.app.use('/api/health', healthRoutes);
    this.app.use('/api/settings', settingsRoutes);
    this.app.use('/api/github', githubRoutes);

    // Performance and monitoring endpoints
    this.app.get('/api/metrics', async (req, res) => {
      const metrics = {
        performance: performanceService.getMetrics(100),
        api: performanceService.getAPIMetrics(100),
        system: await performanceService.getSystemMetrics(),
        cache: await cacheService.getStats(),
      };
      res.json(metrics);
    });

    this.app.get('/api/stats', async (req, res) => {
      const stats = performanceService.getAPIStats();
      res.json(stats);
    });

    // Cache management endpoints (admin only)
    this.app.post('/api/cache/flush', async (req, res) => {
      await cacheService.flush();
      logger.info('Cache flushed via API');
      res.json({ message: 'Cache flushed successfully' });
    });

    this.app.get('/api/cache/stats', async (req, res) => {
      const stats = await cacheService.getStats();
      res.json(stats);
    });

    // WebSocket stats
    this.app.get('/api/websocket/stats', (req, res) => {
      if (wsService) {
        res.json(wsService.getStats());
      } else {
        res.status(503).json({ error: 'WebSocket service not available' });
      }
    });

    // Legacy API endpoints for backward compatibility
    this.app.get('/api/instances', async (req, res) => {
      // Use cache for frequently accessed data
      const cacheKey = 'instances_list';
      const cached = await cacheService.get(cacheKey);
      
      if (cached) {
        return res.json(cached);
      }

      const instances = [
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
      ];

      // Cache for 30 seconds
      await cacheService.set(cacheKey, instances, 30);
      res.json(instances);
    });

    this.app.get('/api/deployments', async (req, res) => {
      const cacheKey = 'deployments_list';
      const cached = await cacheService.get(cacheKey);
      
      if (cached) {
        return res.json(cached);
      }

      const deployments = [
        {
          id: '1',
          name: 'web-server-prod',
          template: 'EC2 Instance',
          status: 'success',
          environment: 'production',
          lastUpdated: '2 hours ago'
        }
      ];

      await cacheService.set(cacheKey, deployments, 60);
      res.json(deployments);
    });

    this.app.get('/api/templates', async (req, res) => {
      const cacheKey = 'templates_list';
      const cached = await cacheService.get(cacheKey);
      
      if (cached) {
        return res.json(cached);
      }

      const templates = [
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
      ];

      await cacheService.set(cacheKey, templates, 300); // 5 minutes
      res.json(templates);
    });
  }

  private setupErrorHandling() {
    // 404 handler
    this.app.use(notFoundHandler);
    
    // Global error handler
    this.app.use(errorHandler);
  }

  public async start(): Promise<void> {
    try {
      // Initialize database
      await initializeDatabase();
      logger.info('Database initialized');

      // Create HTTP server
      this.server = createServer(this.app);

      // Initialize WebSocket service
      const wsService = new WebSocketService(this.server);
      (global as any).websocketService = wsService;

      // Start server
      this.server.listen(this.port, () => {
        logger.info('Enhanced Terraform Dashboard Server started', {
          port: this.port,
          environment: process.env.NODE_ENV || 'development',
          pid: process.pid,
        });

        // Log startup metrics
        this.logStartupInfo();
      });

      // Graceful shutdown handling
      this.setupGracefulShutdown();

    } catch (error) {
      logger.error('Failed to start server', { error });
      process.exit(1);
    }
  }

  private logStartupInfo() {
    logger.info('Server configuration', {
      nodeVersion: process.version,
      platform: process.platform,
      arch: process.arch,
      memory: process.memoryUsage(),
      uptime: process.uptime(),
    });
  }

  private setupGracefulShutdown() {
    const shutdown = async (signal: string) => {
      logger.info(`Received ${signal}, starting graceful shutdown`);

      // Stop accepting new connections
      this.server.close(async () => {
        logger.info('HTTP server closed');

        try {
          // Cleanup services
          if ((global as any).websocketService) {
            (global as any).websocketService.shutdown();
          }
          
          performanceService.shutdown();
          await cacheService.close();

          logger.info('Graceful shutdown completed');
          process.exit(0);
        } catch (error) {
          logger.error('Error during shutdown', { error });
          process.exit(1);
        }
      });

      // Force shutdown after 30 seconds
      setTimeout(() => {
        logger.error('Forced shutdown after timeout');
        process.exit(1);
      }, 30000);
    };

    process.on('SIGTERM', () => shutdown('SIGTERM'));
    process.on('SIGINT', () => shutdown('SIGINT'));
    
    process.on('uncaughtException', (error) => {
      logger.error('Uncaught exception', { error });
      shutdown('uncaughtException');
    });
    
    process.on('unhandledRejection', (reason, promise) => {
      logger.error('Unhandled rejection', { reason, promise });
      shutdown('unhandledRejection');
    });
  }
}

// Start the enhanced server
const server = new EnhancedServer();
server.start().catch((error) => {
  console.error('Failed to start enhanced server:', error);
  process.exit(1);
});

export default server;
