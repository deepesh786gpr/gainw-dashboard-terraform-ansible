import { performance, PerformanceObserver } from 'perf_hooks';
import { logger } from '../utils/logger';
import { cacheService } from './cacheService';

export interface PerformanceMetric {
  name: string;
  duration: number;
  timestamp: string;
  metadata?: Record<string, any>;
}

export interface SystemMetrics {
  cpu: {
    usage: number;
    loadAverage: number[];
  };
  memory: {
    used: number;
    free: number;
    total: number;
    percentage: number;
  };
  process: {
    pid: number;
    uptime: number;
    memoryUsage: NodeJS.MemoryUsage;
    cpuUsage: NodeJS.CpuUsage;
  };
  cache: {
    hitRate: number;
    stats: any;
  };
}

export interface APIMetrics {
  endpoint: string;
  method: string;
  statusCode: number;
  duration: number;
  timestamp: string;
  userAgent?: string;
  ip?: string;
}

export class PerformanceService {
  private metrics: PerformanceMetric[] = [];
  private apiMetrics: APIMetrics[] = [];
  private maxMetrics = 1000;
  private observer!: PerformanceObserver;
  private systemMetricsInterval!: NodeJS.Timeout;

  constructor() {
    this.setupPerformanceObserver();
    this.startSystemMetricsCollection();
    
    logger.info('Performance service initialized');
  }

  private setupPerformanceObserver() {
    this.observer = new PerformanceObserver((list) => {
      const entries = list.getEntries();
      
      entries.forEach((entry) => {
        this.addMetric({
          name: entry.name,
          duration: entry.duration,
          timestamp: new Date().toISOString(),
          metadata: {
            entryType: entry.entryType,
            startTime: entry.startTime,
          },
        });
      });
    });

    this.observer.observe({ entryTypes: ['measure', 'resource'] });
  }

  private startSystemMetricsCollection() {
    this.systemMetricsInterval = setInterval(() => {
      this.collectSystemMetrics();
    }, 30000); // Collect every 30 seconds
  }

  private async collectSystemMetrics() {
    try {
      const metrics = await this.getSystemMetrics();
      
      // Store in cache for quick access
      await cacheService.set('system_metrics', metrics, 60); // 1 minute TTL
      
      // Log if any thresholds are exceeded
      if (metrics.memory.percentage > 80) {
        logger.warn('High memory usage detected', { usage: metrics.memory.percentage });
      }
      
      if (metrics.cpu.usage > 80) {
        logger.warn('High CPU usage detected', { usage: metrics.cpu.usage });
      }
    } catch (error) {
      logger.error('Error collecting system metrics', { error });
    }
  }

  public addMetric(metric: PerformanceMetric) {
    this.metrics.push(metric);
    
    // Keep only the latest metrics
    if (this.metrics.length > this.maxMetrics) {
      this.metrics = this.metrics.slice(-this.maxMetrics);
    }
    
    // Log slow operations
    if (metric.duration > 1000) { // > 1 second
      logger.warn('Slow operation detected', metric);
    }
  }

  public addAPIMetric(metric: APIMetrics) {
    this.apiMetrics.push(metric);
    
    // Keep only the latest API metrics
    if (this.apiMetrics.length > this.maxMetrics) {
      this.apiMetrics = this.apiMetrics.slice(-this.maxMetrics);
    }
    
    // Log slow API calls
    if (metric.duration > 5000) { // > 5 seconds
      logger.warn('Slow API call detected', metric);
    }
    
    // Log error responses
    if (metric.statusCode >= 400) {
      logger.warn('API error response', metric);
    }
  }

  public startTimer(name: string): () => number {
    const startTime = performance.now();
    
    return () => {
      const duration = performance.now() - startTime;
      this.addMetric({
        name,
        duration,
        timestamp: new Date().toISOString(),
      });
      return duration;
    };
  }

  public async measureAsync<T>(name: string, fn: () => Promise<T>): Promise<T> {
    const endTimer = this.startTimer(name);
    try {
      const result = await fn();
      endTimer();
      return result;
    } catch (error) {
      const duration = endTimer();
      logger.error('Async operation failed', { name, duration, error });
      throw error;
    }
  }

  public measure<T>(name: string, fn: () => T): T {
    const endTimer = this.startTimer(name);
    try {
      const result = fn();
      endTimer();
      return result;
    } catch (error) {
      const duration = endTimer();
      logger.error('Operation failed', { name, duration, error });
      throw error;
    }
  }

  public async getSystemMetrics(): Promise<SystemMetrics> {
    const os = await import('os');
    const process = await import('process');
    
    const totalMem = os.totalmem();
    const freeMem = os.freemem();
    const usedMem = totalMem - freeMem;
    
    return {
      cpu: {
        usage: await this.getCPUUsage(),
        loadAverage: os.loadavg(),
      },
      memory: {
        used: usedMem,
        free: freeMem,
        total: totalMem,
        percentage: (usedMem / totalMem) * 100,
      },
      process: {
        pid: process.pid,
        uptime: process.uptime(),
        memoryUsage: process.memoryUsage(),
        cpuUsage: process.cpuUsage(),
      },
      cache: {
        hitRate: cacheService.getHitRate(),
        stats: await cacheService.getStats(),
      },
    };
  }

  private async getCPUUsage(): Promise<number> {
    return new Promise((resolve) => {
      const startUsage = process.cpuUsage();
      const startTime = process.hrtime();
      
      setTimeout(() => {
        const endUsage = process.cpuUsage(startUsage);
        const endTime = process.hrtime(startTime);
        
        const totalTime = endTime[0] * 1000000 + endTime[1] / 1000; // microseconds
        const totalCPU = endUsage.user + endUsage.system; // microseconds
        
        const cpuPercent = (totalCPU / totalTime) * 100;
        resolve(Math.min(100, Math.max(0, cpuPercent)));
      }, 100);
    });
  }

  public getMetrics(limit = 100): PerformanceMetric[] {
    return this.metrics.slice(-limit);
  }

  public getAPIMetrics(limit = 100): APIMetrics[] {
    return this.apiMetrics.slice(-limit);
  }

  public getMetricsByName(name: string, limit = 50): PerformanceMetric[] {
    return this.metrics
      .filter(metric => metric.name === name)
      .slice(-limit);
  }

  public getAverageMetric(name: string, timeWindow = 300000): number { // 5 minutes default
    const now = Date.now();
    const windowStart = now - timeWindow;
    
    const recentMetrics = this.metrics.filter(metric => {
      const metricTime = new Date(metric.timestamp).getTime();
      return metricTime >= windowStart && metric.name === name;
    });
    
    if (recentMetrics.length === 0) return 0;
    
    const total = recentMetrics.reduce((sum, metric) => sum + metric.duration, 0);
    return total / recentMetrics.length;
  }

  public getAPIStats(timeWindow = 300000): any {
    const now = Date.now();
    const windowStart = now - timeWindow;
    
    const recentMetrics = this.apiMetrics.filter(metric => {
      const metricTime = new Date(metric.timestamp).getTime();
      return metricTime >= windowStart;
    });
    
    if (recentMetrics.length === 0) {
      return {
        totalRequests: 0,
        averageResponseTime: 0,
        errorRate: 0,
        requestsPerMinute: 0,
      };
    }
    
    const totalRequests = recentMetrics.length;
    const totalDuration = recentMetrics.reduce((sum, metric) => sum + metric.duration, 0);
    const errorCount = recentMetrics.filter(metric => metric.statusCode >= 400).length;
    
    return {
      totalRequests,
      averageResponseTime: totalDuration / totalRequests,
      errorRate: (errorCount / totalRequests) * 100,
      requestsPerMinute: (totalRequests / (timeWindow / 60000)),
      statusCodes: this.groupBy(recentMetrics, 'statusCode'),
      endpoints: this.groupBy(recentMetrics, 'endpoint'),
    };
  }

  private groupBy(array: any[], key: string): Record<string, number> {
    return array.reduce((groups, item) => {
      const group = item[key];
      groups[group] = (groups[group] || 0) + 1;
      return groups;
    }, {});
  }

  public clearMetrics() {
    this.metrics = [];
    this.apiMetrics = [];
    logger.info('Performance metrics cleared');
  }

  public getHealthStatus(): { status: 'healthy' | 'warning' | 'critical'; details: any } {
    const systemMetrics = cacheService.get('system_metrics');
    
    if (!systemMetrics) {
      return { status: 'warning', details: { message: 'No system metrics available' } };
    }
    
    const issues: string[] = [];
    
    if ((systemMetrics as any).memory.percentage > 90) {
      issues.push('Critical memory usage');
    } else if ((systemMetrics as any).memory.percentage > 80) {
      issues.push('High memory usage');
    }
    
    if ((systemMetrics as any).cpu.usage > 90) {
      issues.push('Critical CPU usage');
    } else if ((systemMetrics as any).cpu.usage > 80) {
      issues.push('High CPU usage');
    }
    
    const cacheHitRate = cacheService.getHitRate();
    if (cacheHitRate < 0.5) {
      issues.push('Low cache hit rate');
    }
    
    let status: 'healthy' | 'warning' | 'critical' = 'healthy';
    if (issues.some(issue => issue.includes('Critical'))) {
      status = 'critical';
    } else if (issues.length > 0) {
      status = 'warning';
    }
    
    return {
      status,
      details: {
        issues,
        systemMetrics,
        cacheHitRate,
        uptime: process.uptime(),
      },
    };
  }

  public shutdown() {
    if (this.observer) {
      this.observer.disconnect();
    }
    
    if (this.systemMetricsInterval) {
      clearInterval(this.systemMetricsInterval);
    }
    
    logger.info('Performance service shutdown');
  }
}

// Create singleton instance
export const performanceService = new PerformanceService();

// Middleware for API performance tracking
export const performanceMiddleware = (req: any, res: any, next: any) => {
  const startTime = performance.now();
  
  res.on('finish', () => {
    const duration = performance.now() - startTime;
    
    performanceService.addAPIMetric({
      endpoint: req.route?.path || req.path,
      method: req.method,
      statusCode: res.statusCode,
      duration,
      timestamp: new Date().toISOString(),
      userAgent: req.get('User-Agent'),
      ip: req.ip,
    });
  });
  
  next();
};
