import { Request, Response, NextFunction } from 'express';

interface PerformanceMetrics {
  totalRequests: number;
  averageResponseTime: number;
  slowRequests: number;
  errorRate: number;
  requestsByEndpoint: Map<string, EndpointMetrics>;
  requestsByMethod: Map<string, number>;
  recentRequests: RequestLog[];
}

interface EndpointMetrics {
  count: number;
  totalTime: number;
  averageTime: number;
  minTime: number;
  maxTime: number;
  errors: number;
  lastAccessed: Date;
}

interface RequestLog {
  method: string;
  url: string;
  statusCode: number;
  responseTime: number;
  timestamp: Date;
  userAgent?: string;
  ip?: string;
}

class PerformanceMonitor {
  private metrics: PerformanceMetrics;
  private readonly maxRecentRequests = 1000;
  private readonly slowRequestThreshold = 5000; // 5 seconds

  constructor() {
    this.metrics = {
      totalRequests: 0,
      averageResponseTime: 0,
      slowRequests: 0,
      errorRate: 0,
      requestsByEndpoint: new Map(),
      requestsByMethod: new Map(),
      recentRequests: [],
    };
  }

  recordRequest(req: Request, res: Response, responseTime: number) {
    const endpoint = this.normalizeEndpoint(req.route?.path || req.path);
    const method = req.method;
    const statusCode = res.statusCode;
    const isError = statusCode >= 400;
    const isSlow = responseTime > this.slowRequestThreshold;

    // Update total metrics
    this.metrics.totalRequests++;
    
    // Update average response time
    const totalTime = this.metrics.averageResponseTime * (this.metrics.totalRequests - 1) + responseTime;
    this.metrics.averageResponseTime = totalTime / this.metrics.totalRequests;

    // Update slow requests count
    if (isSlow) {
      this.metrics.slowRequests++;
    }

    // Update error rate
    const totalErrors = this.metrics.recentRequests.filter(r => r.statusCode >= 400).length + (isError ? 1 : 0);
    this.metrics.errorRate = (totalErrors / this.metrics.totalRequests) * 100;

    // Update endpoint metrics
    if (!this.metrics.requestsByEndpoint.has(endpoint)) {
      this.metrics.requestsByEndpoint.set(endpoint, {
        count: 0,
        totalTime: 0,
        averageTime: 0,
        minTime: Infinity,
        maxTime: 0,
        errors: 0,
        lastAccessed: new Date(),
      });
    }

    const endpointMetrics = this.metrics.requestsByEndpoint.get(endpoint)!;
    endpointMetrics.count++;
    endpointMetrics.totalTime += responseTime;
    endpointMetrics.averageTime = endpointMetrics.totalTime / endpointMetrics.count;
    endpointMetrics.minTime = Math.min(endpointMetrics.minTime, responseTime);
    endpointMetrics.maxTime = Math.max(endpointMetrics.maxTime, responseTime);
    endpointMetrics.lastAccessed = new Date();
    
    if (isError) {
      endpointMetrics.errors++;
    }

    // Update method metrics
    const methodCount = this.metrics.requestsByMethod.get(method) || 0;
    this.metrics.requestsByMethod.set(method, methodCount + 1);

    // Add to recent requests log
    const requestLog: RequestLog = {
      method,
      url: req.originalUrl,
      statusCode,
      responseTime,
      timestamp: new Date(),
      userAgent: req.get('User-Agent'),
      ip: req.ip,
    };

    this.metrics.recentRequests.push(requestLog);

    // Keep only recent requests
    if (this.metrics.recentRequests.length > this.maxRecentRequests) {
      this.metrics.recentRequests = this.metrics.recentRequests.slice(-this.maxRecentRequests);
    }
  }

  private normalizeEndpoint(path: string): string {
    // Normalize dynamic routes (replace IDs with placeholders)
    return path
      .replace(/\/[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/gi, '/:id')
      .replace(/\/\d+/g, '/:id')
      .replace(/\/[a-zA-Z0-9-_]+\/[a-zA-Z0-9-_]+$/g, '/:param/:param');
  }

  getMetrics(): PerformanceMetrics {
    return {
      ...this.metrics,
      requestsByEndpoint: new Map(this.metrics.requestsByEndpoint),
      requestsByMethod: new Map(this.metrics.requestsByMethod),
      recentRequests: [...this.metrics.recentRequests],
    };
  }

  getTopEndpoints(limit: number = 10) {
    return Array.from(this.metrics.requestsByEndpoint.entries())
      .sort(([, a], [, b]) => b.count - a.count)
      .slice(0, limit)
      .map(([endpoint, metrics]) => ({ endpoint, ...metrics }));
  }

  getSlowestEndpoints(limit: number = 10) {
    return Array.from(this.metrics.requestsByEndpoint.entries())
      .sort(([, a], [, b]) => b.averageTime - a.averageTime)
      .slice(0, limit)
      .map(([endpoint, metrics]) => ({ endpoint, ...metrics }));
  }

  getRecentErrors(limit: number = 50) {
    return this.metrics.recentRequests
      .filter(req => req.statusCode >= 400)
      .slice(-limit)
      .reverse();
  }

  reset() {
    this.metrics = {
      totalRequests: 0,
      averageResponseTime: 0,
      slowRequests: 0,
      errorRate: 0,
      requestsByEndpoint: new Map(),
      requestsByMethod: new Map(),
      recentRequests: [],
    };
  }
}

// Global performance monitor instance
export const performanceMonitor = new PerformanceMonitor();

// Performance monitoring middleware
export const performanceMiddleware = (req: Request, res: Response, next: NextFunction) => {
  const startTime = Date.now();

  // Override res.end to capture response time
  const originalEnd = res.end.bind(res);
  res.end = function(chunk?: any, encoding?: any, cb?: any) {
    const responseTime = Date.now() - startTime;
    performanceMonitor.recordRequest(req, res, responseTime);

    // Call original end method
    return originalEnd(chunk, encoding, cb);
  };

  next();
};

// Performance metrics endpoint
export const getPerformanceMetrics = (req: Request, res: Response) => {
  const metrics = performanceMonitor.getMetrics();
  
  // Convert Maps to objects for JSON serialization
  const serializedMetrics = {
    ...metrics,
    requestsByEndpoint: Object.fromEntries(metrics.requestsByEndpoint),
    requestsByMethod: Object.fromEntries(metrics.requestsByMethod),
    topEndpoints: performanceMonitor.getTopEndpoints(),
    slowestEndpoints: performanceMonitor.getSlowestEndpoints(),
    recentErrors: performanceMonitor.getRecentErrors(),
    systemInfo: {
      uptime: process.uptime(),
      memoryUsage: process.memoryUsage(),
      cpuUsage: process.cpuUsage(),
      platform: process.platform,
      nodeVersion: process.version,
    },
  };

  res.json(serializedMetrics);
};

// Reset metrics endpoint (for testing/debugging)
export const resetPerformanceMetrics = (req: Request, res: Response) => {
  performanceMonitor.reset();
  res.json({ message: 'Performance metrics reset successfully' });
};
