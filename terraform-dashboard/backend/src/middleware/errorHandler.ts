import { Request, Response, NextFunction } from 'express';
import { logger } from '../utils/logger';

export class AppError extends Error {
  public statusCode: number;
  public isOperational: boolean;
  public code?: string;
  public details?: any;

  constructor(message: string, statusCode: number, code?: string, details?: any) {
    super(message);
    this.statusCode = statusCode;
    this.isOperational = true;
    this.code = code;
    this.details = details;

    Error.captureStackTrace(this, this.constructor);
  }
}

export const createError = (
  message: string,
  statusCode: number = 500,
  code?: string,
  details?: any
): AppError => {
  return new AppError(message, statusCode, code, details);
};

// Validation error handler
export const handleValidationError = (err: any): AppError => {
  const errors = Object.values(err.errors || {}).map((val: any) => val.message);
  const message = `Invalid input data: ${errors.join('. ')}`;
  return new AppError(message, 400, 'VALIDATION_ERROR', errors);
};

// Database error handler
export const handleDatabaseError = (err: any): AppError => {
  if (err.code === 'SQLITE_CONSTRAINT') {
    return new AppError('Database constraint violation', 400, 'DB_CONSTRAINT_ERROR');
  }
  if (err.code === 'SQLITE_BUSY') {
    return new AppError('Database is busy, please try again', 503, 'DB_BUSY_ERROR');
  }
  return new AppError('Database operation failed', 500, 'DB_ERROR', err.message);
};

// Terraform error handler
export const handleTerraformError = (err: any): AppError => {
  if (err.message?.includes('terraform not found')) {
    return new AppError('Terraform binary not found', 500, 'TERRAFORM_NOT_FOUND');
  }
  if (err.message?.includes('authentication')) {
    return new AppError('AWS authentication failed', 401, 'AWS_AUTH_ERROR');
  }
  return new AppError('Terraform operation failed', 500, 'TERRAFORM_ERROR', err.message);
};
export const errorHandler = (
  err: Error | AppError,
  req: Request,
  res: Response,
  next: NextFunction
): void => {
  let error = { ...err } as AppError;
  error.message = err.message;

  // Handle specific error types
  if (err.name === 'ValidationError') {
    error = handleValidationError(err);
  } else if (err.name === 'DatabaseError' || (err as any).code?.startsWith('SQLITE_')) {
    error = handleDatabaseError(err);
  } else if (err.message?.includes('terraform') || err.message?.includes('aws')) {
    error = handleTerraformError(err);
  }

  // Log error with context
  const errorContext = {
    method: req.method,
    url: req.url,
    ip: req.ip,
    userAgent: req.get('User-Agent'),
    userId: (req as any).user?.id,
    requestId: (req as any).requestId,
    timestamp: new Date().toISOString(),
    error: {
      message: error.message,
      stack: error.stack,
      code: error.code,
      details: error.details,
    },
  };

  if (error.statusCode >= 500) {
    logger.error('Server Error', errorContext);
  } else {
    logger.warn('Client Error', errorContext);
  }

  // Default error response
  let statusCode = 500;
  let message = 'Internal Server Error';

  if (error.isOperational) {
    statusCode = error.statusCode;
    message = error.message;
  }

  // Don't leak error details in production
  if (process.env.NODE_ENV === 'production' && statusCode === 500) {
    message = 'Internal Server Error';
  }

  res.status(statusCode).json({
    success: false,
    error: message,
    code: error.code,
    timestamp: new Date().toISOString(),
    requestId: (req as any).requestId || 'unknown',
    ...(process.env.NODE_ENV === 'development' && {
      stack: err.stack,
      details: error.details
    }),
  });
};

// Async error wrapper
export const asyncHandler = (fn: Function) => (req: Request, res: Response, next: NextFunction) => {
  Promise.resolve(fn(req, res, next)).catch(next);
};

// 404 handler
export const notFoundHandler = (req: Request, res: Response, next: NextFunction) => {
  const error = createError(`Route ${req.originalUrl} not found`, 404, 'ROUTE_NOT_FOUND');
  next(error);
};
