/**
 * Custom error classes for better error categorization
 */

class AppError extends Error {
  constructor(message, statusCode, code = 'UNKNOWN_ERROR') {
    super(message);
    this.statusCode = statusCode;
    this.status = `${statusCode}`.startsWith('4') ? 'fail' : 'error';
    this.code = code;
    this.isOperational = true;

    Error.captureStackTrace(this, this.constructor);
  }
}

class ValidationError extends AppError {
  constructor(message) {
    super(message, 400, 'VALIDATION_ERROR');
  }
}

class NotFoundError extends AppError {
  constructor(resource = 'Resource') {
    super(`${resource} not found`, 404, 'NOT_FOUND');
  }
}

class UnauthorizedError extends AppError {
  constructor(message = 'Not authorized') {
    super(message, 401, 'UNAUTHORIZED');
  }
}

class ForbiddenError extends AppError {
  constructor(message = 'Access forbidden') {
    super(message, 403, 'FORBIDDEN');
  }
}

class ConflictError extends AppError {
  constructor(message = 'Resource already exists') {
    super(message, 409, 'CONFLICT');
  }
}

/**
 * Error categorization helper
 * Maps MongoDB/Mongoose errors to appropriate HTTP responses
 */
const categorizeError = (err) => {
  // Mongoose validation error
  if (err.name === 'ValidationError') {
    const messages = Object.values(err.errors).map(e => e.message);
    return new ValidationError(messages.join('. '));
  }

  // Mongoose cast error (invalid ObjectId, etc.)
  if (err.name === 'CastError') {
    return new ValidationError(`Invalid ${err.path}: ${err.value}`);
  }

  // MongoDB duplicate key error
  if (err.code === 11000) {
    const field = Object.keys(err.keyValue || {})[0];
    return new ConflictError(`${field || 'Field'} already exists`);
  }

  // JWT errors
  if (err.name === 'JsonWebTokenError') {
    return new UnauthorizedError('Invalid token');
  }
  if (err.name === 'TokenExpiredError') {
    return new UnauthorizedError('Token expired');
  }

  // Return original error if not categorizable
  return err;
};

/**
 * Async handler wrapper to avoid try-catch boilerplate
 * @param {Function} fn - Async route handler
 */
const asyncHandler = (fn) => (req, res, next) => {
  Promise.resolve(fn(req, res, next)).catch(next);
};

/**
 * Express error handling middleware
 */
const errorHandler = (err, req, res, next) => {
  // Categorize the error
  const error = categorizeError(err);
  
  // Log error (consider using structured logging in production)
  if (process.env.NODE_ENV !== 'production') {
    console.error('❌ Error:', {
      message: error.message,
      code: error.code,
      statusCode: error.statusCode,
      stack: error.stack,
    });
  } else {
    // In production, only log operational errors in detail
    if (error.isOperational) {
      console.error(`[${error.code}] ${error.message}`);
    } else {
      console.error('❌ Unexpected Error:', error);
    }
  }

  // Send response
  const statusCode = error.statusCode || 500;
  const response = {
    success: false,
    message: statusCode === 500 && process.env.NODE_ENV === 'production'
      ? 'Internal server error'
      : error.message,
  };

  // Add error code for client-side handling
  if (error.code) {
    response.code = error.code;
  }

  // Add stack trace in development
  if (process.env.NODE_ENV !== 'production') {
    response.stack = error.stack;
  }

  res.status(statusCode).json(response);
};

module.exports = {
  AppError,
  ValidationError,
  NotFoundError,
  UnauthorizedError,
  ForbiddenError,
  ConflictError,
  categorizeError,
  asyncHandler,
  errorHandler,
};
