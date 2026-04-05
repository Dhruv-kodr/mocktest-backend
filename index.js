require('dotenv').config();
const express  = require('express');
const cors     = require('cors');
const path     = require('path');
const helmet   = require('helmet');
const connectDB = require('./config/db');
const { errorHandler } = require('./middleware/errorHandler');
const { API_CONFIG } = require('./config/constants');
const { apiLimiter, sanitizeInput, securityLogger } = require('./middleware/security');

// ── Startup Security Validation ─────────────────────────────────────
const validateEnvironment = () => {
  const required = ['JWT_SECRET'];
  const missing = required.filter(key => !process.env[key]);
  
  if (missing.length > 0) {
    console.error('❌ FATAL: Missing required environment variables:', missing.join(', '));
    console.error('   Please set these in your .env file before starting the server.');
    process.exit(1);
  }
  
  // Warn about weak JWT secret
  if (process.env.JWT_SECRET && process.env.JWT_SECRET.length < 32) {
    console.warn('⚠️  WARNING: JWT_SECRET should be at least 32 characters for security');
  }
  
  // Warn about missing recommended variables
  const recommended = ['RAZORPAY_KEY_ID', 'RAZORPAY_KEY_SECRET', 'MONGODB_URI'];
  const missingRecommended = recommended.filter(key => !process.env[key]);
  if (missingRecommended.length > 0) {
    console.warn('⚠️  Warning: Missing recommended environment variables:', missingRecommended.join(', '));
  }
};

validateEnvironment();

const app = express();
connectDB();

// ── Security Headers (Helmet.js) ────────────────────────────────────
app.use(helmet({
  contentSecurityPolicy: {
    directives: {
      defaultSrc: ["'self'"],
      styleSrc: ["'self'", "'unsafe-inline'", "https://fonts.googleapis.com"],
      fontSrc: ["'self'", "https://fonts.gstatic.com"],
      imgSrc: ["'self'", "data:", "https:", "blob:"],
      scriptSrc: ["'self'"],
      connectSrc: ["'self'", process.env.CLIENT_URL || "http://localhost:3000"],
      frameSrc: ["'self'", "https://www.youtube.com", "https://youtube.com"],
    },
  },
  crossOriginEmbedderPolicy: false, // Allow YouTube embeds
  crossOriginResourcePolicy: { policy: "cross-origin" },
}));

// ── CORS Configuration ──────────────────────────────────────────────
const allowedOrigins = process.env.CLIENT_URL
  ? process.env.CLIENT_URL.split(',').map(o => o.trim())
  : ['http://localhost:3000'];

app.use(cors({
  origin: (origin, cb) => {
    // Allow requests with no origin (mobile apps, Postman, etc.) in development
    if (!origin && process.env.NODE_ENV !== 'production') {
      return cb(null, true);
    }
    // In production, strictly validate origin
    if (allowedOrigins.includes(origin)) {
      return cb(null, true);
    }
    // Block wildcard in production
    if (process.env.NODE_ENV === 'production') {
      return cb(new Error('Not allowed by CORS'));
    }
    // Allow in development
    return cb(null, true);
  },
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization', 'X-Requested-With'],
}));

// ── Rate Limiting & Input Sanitization ──────────────────────────────
// app.use(apiLimiter); // Disabled for testing - unlimited API requests
app.use(sanitizeInput);
app.use(securityLogger('api_request'));

// ── Body Parsing ────────────────────────────────────────────────────
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

// Request timeout middleware
app.use((req, res, next) => {
  res.setTimeout(API_CONFIG.REQUEST_TIMEOUT_MS, () => {
    res.status(408).json({ success: false, message: 'Request timeout', code: 'REQUEST_TIMEOUT' });
  });
  next();
});

// Morgan only in development
if (process.env.NODE_ENV !== 'production') {
  const morgan = require('morgan');
  app.use(morgan('dev'));
}

// ── Static files ────────────────────────────────────────────────────
app.use('/uploads', express.static(path.join(__dirname, 'uploads')));

// ── API Routes ──────────────────────────────────────────────────────
app.use('/api/auth',        require('./routes/auth'));
app.use('/api/users',       require('./routes/users'));
app.use('/api/questions',   require('./routes/questions'));
app.use('/api/tests',       require('./routes/tests'));
app.use('/api/results',     require('./routes/results'));
app.use('/api/admin',       require('./routes/admin'));
app.use('/api/leaderboard', require('./routes/leaderboard'));
app.use('/api/feedback',    require('./routes/feedback'));
app.use('/api/videos',      require('./routes/videos'));
app.use('/api/plans',       require('./routes/plans'));
app.use('/api/payments',    require('./routes/payments'));
app.use('/api/reports',     require('./routes/reports'));
app.use('/api/categories',  require('./routes/categories'));
app.use('/api/material',    require('./routes/material'));

app.get('/api/health', (req, res) => {
  // Minimal response in production to avoid information disclosure
  if (process.env.NODE_ENV === 'production') {
    return res.json({ status: 'OK' });
  }
  res.json({ status: 'OK', app: 'Janta Exam API', version: '5.0', env: process.env.NODE_ENV, time: new Date() });
});

// ── Serve React build in production ────────────────────────────────
if (process.env.NODE_ENV === 'production') {
  const clientBuild = path.join(__dirname, '../client/build');
  app.use(express.static(clientBuild));
  app.get('*', (req, res) => {
    if (!req.path.startsWith('/api')) {
      res.sendFile(path.join(clientBuild, 'index.html'));
    }
  });
}

// ── Global error handler ────────────────────────────────────────────
app.use(errorHandler);

const PORT = process.env.PORT || 5000;
app.listen(PORT, () => {
  const env = process.env.NODE_ENV || 'development';
  console.log(`🚀 Janta Exam API v5.0 running on port ${PORT} [${env}]`);
});
