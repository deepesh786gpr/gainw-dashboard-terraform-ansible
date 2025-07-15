import { Request, Response, NextFunction } from 'express';
import { createError } from './errorHandler';

// Input sanitization
export const sanitizeInput = (input: any): any => {
  if (typeof input === 'string') {
    return input.trim().replace(/[<>]/g, '');
  }
  if (Array.isArray(input)) {
    return input.map(sanitizeInput);
  }
  if (typeof input === 'object' && input !== null) {
    const sanitized: any = {};
    for (const [key, value] of Object.entries(input)) {
      sanitized[key] = sanitizeInput(value);
    }
    return sanitized;
  }
  return input;
};

// Validation schemas
export const validationSchemas = {
  deployment: {
    templateId: { required: true, type: 'string', minLength: 1 },
    name: { required: true, type: 'string', minLength: 1, maxLength: 100, pattern: /^[a-zA-Z0-9-_]+$/ },
    environment: { required: true, type: 'string', enum: ['development', 'staging', 'production'] },
    variables: { required: false, type: 'object' },
  },
  template: {
    name: { required: true, type: 'string', minLength: 1, maxLength: 100 },
    description: { required: false, type: 'string', maxLength: 500 },
    category: { required: true, type: 'string', minLength: 1 },
    terraformCode: { required: true, type: 'string', minLength: 1 },
    variables: { required: false, type: 'array' },
  },
  instance: {
    instanceId: { required: true, type: 'string', pattern: /^i-[0-9a-f]{8,17}$/ },
  },
  user: {
    username: { required: true, type: 'string', minLength: 3, maxLength: 50, pattern: /^[a-zA-Z0-9_]+$/ },
    email: { required: true, type: 'string', pattern: /^[^\s@]+@[^\s@]+\.[^\s@]+$/ },
    password: { required: true, type: 'string', minLength: 8 },
  },
};

// Validation function
const validateField = (value: any, rules: any, fieldName: string): string[] => {
  const errors: string[] = [];

  // Required check
  if (rules.required && (value === undefined || value === null || value === '')) {
    errors.push(`${fieldName} is required`);
    return errors;
  }

  // Skip other validations if field is not required and empty
  if (!rules.required && (value === undefined || value === null || value === '')) {
    return errors;
  }

  // Type check
  if (rules.type) {
    const actualType = Array.isArray(value) ? 'array' : typeof value;
    if (actualType !== rules.type) {
      errors.push(`${fieldName} must be of type ${rules.type}`);
      return errors;
    }
  }

  // String validations
  if (rules.type === 'string' && typeof value === 'string') {
    if (rules.minLength && value.length < rules.minLength) {
      errors.push(`${fieldName} must be at least ${rules.minLength} characters long`);
    }
    if (rules.maxLength && value.length > rules.maxLength) {
      errors.push(`${fieldName} must be at most ${rules.maxLength} characters long`);
    }
    if (rules.pattern && !rules.pattern.test(value)) {
      errors.push(`${fieldName} format is invalid`);
    }
    if (rules.enum && !rules.enum.includes(value)) {
      errors.push(`${fieldName} must be one of: ${rules.enum.join(', ')}`);
    }
  }

  // Number validations
  if (rules.type === 'number' && typeof value === 'number') {
    if (rules.min && value < rules.min) {
      errors.push(`${fieldName} must be at least ${rules.min}`);
    }
    if (rules.max && value > rules.max) {
      errors.push(`${fieldName} must be at most ${rules.max}`);
    }
  }

  return errors;
};

// Generic validation middleware
export const validate = (schema: any) => {
  return (req: Request, res: Response, next: NextFunction) => {
    const errors: string[] = [];
    const data = { ...req.body, ...req.params, ...req.query };

    // Sanitize input
    req.body = sanitizeInput(req.body);

    // Validate each field
    for (const [fieldName, rules] of Object.entries(schema)) {
      const fieldErrors = validateField(data[fieldName], rules, fieldName);
      errors.push(...fieldErrors);
    }

    if (errors.length > 0) {
      throw createError(`Validation failed: ${errors.join(', ')}`, 400, 'VALIDATION_ERROR', errors);
    }

    next();
  };
};

// Specific validation middlewares
export const validateDeployment = validate(validationSchemas.deployment);
export const validateTemplate = validate(validationSchemas.template);
export const validateInstance = validate(validationSchemas.instance);
export const validateUser = validate(validationSchemas.user);

// Rate limiting validation
export const validateRateLimit = (maxRequests: number, windowMs: number) => {
  const requests = new Map<string, { count: number; resetTime: number }>();

  return (req: Request, res: Response, next: NextFunction) => {
    const clientId = req.ip || 'unknown';
    const now = Date.now();
    const windowStart = now - windowMs;

    // Clean old entries
    for (const [key, value] of requests.entries()) {
      if (value.resetTime < windowStart) {
        requests.delete(key);
      }
    }

    // Check current client
    const clientData = requests.get(clientId);
    if (!clientData) {
      requests.set(clientId, { count: 1, resetTime: now + windowMs });
      next();
      return;
    }

    if (clientData.count >= maxRequests) {
      throw createError('Too many requests', 429, 'RATE_LIMIT_EXCEEDED');
    }

    clientData.count++;
    next();
  };
};

// File upload validation
export const validateFileUpload = (allowedTypes: string[], maxSize: number) => {
  return (req: Request, res: Response, next: NextFunction) => {
    if (!req.file) {
      throw createError('No file uploaded', 400, 'NO_FILE_UPLOADED');
    }

    // Check file type
    if (!allowedTypes.includes(req.file.mimetype)) {
      throw createError(`File type not allowed. Allowed types: ${allowedTypes.join(', ')}`, 400, 'INVALID_FILE_TYPE');
    }

    // Check file size
    if (req.file.size > maxSize) {
      throw createError(`File too large. Maximum size: ${maxSize} bytes`, 400, 'FILE_TOO_LARGE');
    }

    next();
  };
};

// Environment validation
export const validateEnvironment = (req: Request, res: Response, next: NextFunction) => {
  const requiredEnvVars = [
    'NODE_ENV',
    'JWT_SECRET',
    'DATABASE_URL',
  ];

  const missingVars = requiredEnvVars.filter(varName => !process.env[varName]);

  if (missingVars.length > 0) {
    throw createError(`Missing required environment variables: ${missingVars.join(', ')}`, 500, 'MISSING_ENV_VARS');
  }

  next();
};

// CORS validation
export const validateCORS = (allowedOrigins: string[]) => {
  return (req: Request, res: Response, next: NextFunction) => {
    const origin = req.headers.origin;

    if (origin && !allowedOrigins.includes(origin)) {
      throw createError('CORS policy violation', 403, 'CORS_VIOLATION');
    }

    next();
  };
};
