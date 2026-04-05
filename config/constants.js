/**
 * Centralized configuration constants
 * All hardcoded values should be defined here for easy modification
 */

// API Configuration
const API_CONFIG = {
  REQUEST_TIMEOUT_MS: parseInt(process.env.REQUEST_TIMEOUT_MS) || 30000,
  MAX_FILE_SIZE_BYTES: parseInt(process.env.MAX_FILE_SIZE) || 50 * 1024 * 1024, // 50MB
  ALLOWED_FILE_TYPES: (process.env.ALLOWED_FILE_TYPES || 'pdf,doc,docx,ppt,pptx,xls,xlsx,txt,jpg,png,gif,zip').split(','),
};

// Database Configuration
const DB_CONFIG = {
  MAX_POOL_SIZE: parseInt(process.env.MONGODB_POOL_SIZE) || 10,
  SERVER_SELECTION_TIMEOUT_MS: parseInt(process.env.MONGODB_SELECT_TIMEOUT) || 5000,
  SOCKET_TIMEOUT_MS: parseInt(process.env.MONGODB_SOCKET_TIMEOUT) || 45000,
};

// Pagination Defaults
const PAGINATION = {
  DEFAULT_PAGE: 1,
  DEFAULT_LIMIT: 10,
  MAX_LIMIT: 100,
  
  // Specific endpoint defaults
  TESTS_LIMIT: 12,
  QUESTIONS_LIMIT: 300,
  RESULTS_LIMIT: 10,
  DASHBOARD_TESTS_LIMIT: 6,
  DASHBOARD_RESULTS_LIMIT: 5,
  LEADERBOARD_LIMIT: 20,
  VIDEOS_LIMIT: 20,
  MATERIALS_LIMIT: 20,
  ADMIN_STATS_RECENT: 5,
};

// Authentication Configuration
const AUTH_CONFIG = {
  JWT_EXPIRE: process.env.JWT_EXPIRE || '7d',
  OTP_EXPIRE_MINUTES: parseInt(process.env.OTP_EXPIRE_MINUTES) || 10,
  BCRYPT_ROUNDS: parseInt(process.env.BCRYPT_ROUNDS) || 12,
  SESSION_TIMEOUT_HOURS: parseInt(process.env.SESSION_TIMEOUT_HOURS) || 24,
};

// Rate Limiting
const RATE_LIMIT = {
  WINDOW_MS: parseInt(process.env.RATE_LIMIT_WINDOW_MS) || 15 * 60 * 1000, // 15 minutes
  MAX_REQUESTS: parseInt(process.env.RATE_LIMIT_MAX_REQUESTS) || 100,
};

// Caching TTL (Time-to-live in seconds)
const CACHE_TTL = {
  CATEGORIES: 3600,      // 1 hour
  USER_SESSION: 86400,   // 24 hours
  DASHBOARD_STATS: 300,  // 5 minutes
  LEADERBOARD: 300,      // 5 minutes
  TEST_QUESTIONS: 600,   // 10 minutes
};

// Exam/Test Configuration
const EXAM_CONFIG = {
  DEFAULT_DURATION_MINUTES: 60,
  DEFAULT_MARKS_PER_QUESTION: 1,
  DEFAULT_NEGATIVE_MARKS: 0.25,
};

// Categories (shared between tests and videos)
const CATEGORIES = [
  'SSC',
  'Railway',
  'Banking',
  'UPSC',
  'Defence',
  'State PSC',
  'Teaching',
  'Other'
];

module.exports = {
  API_CONFIG,
  DB_CONFIG,
  PAGINATION,
  AUTH_CONFIG,
  RATE_LIMIT,
  CACHE_TTL,
  EXAM_CONFIG,
  CATEGORIES,
};
