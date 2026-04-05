/**
 * Security middleware - Rate limiting, input sanitization, CSRF protection
 */

const rateLimit = require('express-rate-limit');

// Escape regex special characters to prevent NoSQL injection
const escapeRegex = (str) => {
  if (!str || typeof str !== 'string') return '';
  return str.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
};

// Create safe regex from user input
const safeRegex = (str, flags = 'i') => {
  const escaped = escapeRegex(str);
  return escaped ? new RegExp(escaped, flags) : null;
};

// Sanitize object keys to prevent prototype pollution
const sanitizeObject = (obj) => {
  if (!obj || typeof obj !== 'object') return obj;
  
  const dangerous = ['__proto__', 'constructor', 'prototype'];
  const clean = {};
  
  for (const key of Object.keys(obj)) {
    if (dangerous.includes(key)) continue;
    clean[key] = typeof obj[key] === 'object' 
      ? sanitizeObject(obj[key]) 
      : obj[key];
  }
  
  return clean;
};

// Rate limiter for login endpoints
const loginLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 5, // 5 attempts per window
  message: { 
    success: false, 
    message: 'Too many login attempts. Please try again after 15 minutes.',
    code: 'RATE_LIMIT_EXCEEDED'
  },
  standardHeaders: true,
  legacyHeaders: false,
  // Use default key generator (uses req.ip properly)
});

// Rate limiter for OTP sending
const otpSendLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 3, // 3 OTP requests per window
  message: { 
    success: false, 
    message: 'Too many OTP requests. Please try again after 15 minutes.',
    code: 'OTP_RATE_LIMIT'
  },
  // Use default key generator
});

// Rate limiter for OTP verification
const otpVerifyLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 5, // 5 verification attempts per window
  message: { 
    success: false, 
    message: 'Too many verification attempts. Please request a new OTP.',
    code: 'OTP_VERIFY_LIMIT'
  },
  // Use default key generator
});

// General API rate limiter
const apiLimiter = rateLimit({
  windowMs: 60 * 1000, // 1 minute
  max: 100, // 100 requests per minute
  message: { 
    success: false, 
    message: 'Too many requests. Please slow down.',
    code: 'API_RATE_LIMIT'
  },
  skip: (req) => {
    // Skip rate limiting for health checks
    return req.path === '/api/health';
  },
});

// Strict rate limiter for sensitive admin operations
const adminLimiter = rateLimit({
  windowMs: 60 * 1000, // 1 minute
  max: 30, // 30 requests per minute
  message: { 
    success: false, 
    message: 'Rate limit exceeded for admin operations.',
    code: 'ADMIN_RATE_LIMIT'
  },
});

// Input sanitization middleware
const sanitizeInput = (req, res, next) => {
  if (req.body && typeof req.body === 'object') {
    req.body = sanitizeObject(req.body);
  }
  if (req.query && typeof req.query === 'object') {
    req.query = sanitizeObject(req.query);
  }
  if (req.params && typeof req.params === 'object') {
    req.params = sanitizeObject(req.params);
  }
  next();
};

// Security logging middleware
const securityLogger = (eventType) => (req, res, next) => {
  const originalSend = res.send;
  
  res.send = function(body) {
    // Log security events on certain responses
    if (res.statusCode === 401 || res.statusCode === 403 || res.statusCode === 429) {
      const logEntry = {
        timestamp: new Date().toISOString(),
        event: eventType,
        severity: res.statusCode === 429 ? 'warning' : 'info',
        ip: req.ip || req.connection?.remoteAddress,
        userAgent: req.get('User-Agent'),
        path: req.path,
        method: req.method,
        statusCode: res.statusCode,
        userId: req.user?._id || null,
      };
      
      // In production, send to logging service
      if (process.env.NODE_ENV === 'production') {
        console.log('[SECURITY]', JSON.stringify(logEntry));
      } else {
        console.log('[SECURITY]', logEntry);
      }
    }
    
    return originalSend.call(this, body);
  };
  
  next();
};

module.exports = {
  escapeRegex,
  safeRegex,
  sanitizeObject,
  sanitizeInput,
  loginLimiter,
  otpSendLimiter,
  otpVerifyLimiter,
  apiLimiter,
  adminLimiter,
  securityLogger,
};
