import winston from 'winston';
import path from 'path';
import fs from 'fs';

// Ensure logs directory exists
const logsDir = path.join(__dirname, '../../logs');
if (!fs.existsSync(logsDir)) {
  fs.mkdirSync(logsDir, { recursive: true });
}

// Custom log format
const logFormat = winston.format.combine(
  winston.format.timestamp({ format: 'YYYY-MM-DD HH:mm:ss' }),
  winston.format.errors({ stack: true }),
  winston.format.json(),
  winston.format.prettyPrint()
);

// Console format for development
const consoleFormat = winston.format.combine(
  winston.format.colorize(),
  winston.format.timestamp({ format: 'HH:mm:ss' }),
  winston.format.printf(({ timestamp, level, message, ...meta }) => {
    let metaStr = '';
    if (Object.keys(meta).length > 0) {
      metaStr = '\n' + JSON.stringify(meta, null, 2);
    }
    return `${timestamp} [${level}]: ${message}${metaStr}`;
  })
);

// Create logger instance
export const logger = winston.createLogger({
  level: process.env.LOG_LEVEL || 'info',
  format: logFormat,
  defaultMeta: { service: 'terraform-dashboard' },
  transports: [
    // Error log file
    new winston.transports.File({
      filename: path.join(logsDir, 'error.log'),
      level: 'error',
      maxsize: 5242880, // 5MB
      maxFiles: 5,
    }),
    // Combined log file
    new winston.transports.File({
      filename: path.join(logsDir, 'combined.log'),
      maxsize: 5242880, // 5MB
      maxFiles: 5,
    }),
    // Application log file
    new winston.transports.File({
      filename: path.join(logsDir, 'app.log'),
      level: 'info',
      maxsize: 5242880, // 5MB
      maxFiles: 3,
    }),
  ],
});

// Add console transport for development
if (process.env.NODE_ENV !== 'production') {
  logger.add(new winston.transports.Console({
    format: consoleFormat,
  }));
}

// Performance logging
export const performanceLogger = {
  start: (operation: string) => {
    const startTime = Date.now();
    return {
      end: (additionalData?: any) => {
        const duration = Date.now() - startTime;
        logger.info('Performance metric', {
          operation,
          duration: `${duration}ms`,
          ...additionalData,
        });
        return duration;
      },
    };
  },
};

// Audit logging for security events
export const auditLogger = {
  log: (event: string, userId?: string, details?: any) => {
    logger.info('Audit event', {
      event,
      userId,
      timestamp: new Date().toISOString(),
      ...details,
    });
  },
  
  loginAttempt: (username: string, success: boolean, ip: string) => {
    auditLogger.log('LOGIN_ATTEMPT', username, { success, ip });
  },
  
  deploymentAction: (action: string, userId: string, deploymentId: string, details?: any) => {
    auditLogger.log('DEPLOYMENT_ACTION', userId, { action, deploymentId, ...details });
  },
  
  instanceAction: (action: string, userId: string, instanceId: string, details?: any) => {
    auditLogger.log('INSTANCE_ACTION', userId, { action, instanceId, ...details });
  },
};

// Request logging middleware
export const requestLogger = (req: any, res: any, next: any) => {
  const startTime = Date.now();
  const requestId = req.headers['x-request-id'] || `req_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  
  req.requestId = requestId;
  
  // Log request
  logger.info('Incoming request', {
    requestId,
    method: req.method,
    url: req.url,
    ip: req.ip,
    userAgent: req.get('User-Agent'),
    userId: req.user?.id,
  });
  
  // Log response
  res.on('finish', () => {
    const duration = Date.now() - startTime;
    logger.info('Request completed', {
      requestId,
      method: req.method,
      url: req.url,
      statusCode: res.statusCode,
      duration: `${duration}ms`,
      userId: req.user?.id,
    });
  });
  
  next();
};

export default logger;
