const jwt = require('jsonwebtoken');
const User = require('../models/User');
const { AUTH_CONFIG } = require('../config/constants');

// Validate JWT_SECRET at module load
if (!process.env.JWT_SECRET) {
  console.error('❌ FATAL: JWT_SECRET environment variable is required');
  // Don't exit here - let index.js handle startup validation
}

// Simple in-memory cache for user sessions (consider Redis for production)
const userCache = new Map();
const CACHE_TTL_MS = 60 * 1000; // 1 minute (reduced from 5 for security)

const getCachedUser = (userId) => {
  const cached = userCache.get(userId);
  if (cached && Date.now() - cached.timestamp < CACHE_TTL_MS) {
    return cached.user;
  }
  userCache.delete(userId);
  return null;
};

const setCachedUser = (userId, user) => {
  userCache.set(userId, { user, timestamp: Date.now() });
};

const invalidateUserCache = (userId) => {
  userCache.delete(userId);
};

const protect = async (req, res, next) => {
  let token;
  if (req.headers.authorization?.startsWith('Bearer'))
    token = req.headers.authorization.split(' ')[1];
  if (!token)
    return res.status(401).json({ success: false, message: 'Not authorized, no token' });
  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    
    // Try to get user from cache first
    let user = getCachedUser(decoded.id);
    
    if (!user) {
      // Only populate membership.plan when not in cache
      user = await User.findById(decoded.id).select('-password').populate('membership.plan').lean();
      if (user) {
        // Add isPremium method result to cached user object
        user._isPremium = user.membership?.status === 'premium' && 
          new Date(user.membership?.endDate) > new Date();
        setCachedUser(decoded.id, user);
      }
    }
    
    if (!user) return res.status(401).json({ success: false, message: 'User not found' });
    if (user.isBlocked) return res.status(403).json({ success: false, message: 'Account blocked. Contact admin.' });
    if (!user.isActive) return res.status(403).json({ success: false, message: 'Account deactivated. Contact admin.' });
    
    // Add helper method for premium check
    user.isPremium = () => user._isPremium;
    req.user = user;
    next();
  } catch {
    return res.status(401).json({ success: false, message: 'Token invalid or expired' });
  }
};

const adminOnly = (req, res, next) => {
  if (req.user?.role === 'admin') return next();
  return res.status(403).json({ success: false, message: 'Admin access required' });
};

const teacherOrAdmin = (req, res, next) => {
  if (req.user?.role === 'admin' || req.user?.role === 'teacher') return next();
  return res.status(403).json({ success: false, message: 'Teacher or Admin access required' });
};

const premiumOrAdmin = (req, res, next) => {
  if (req.user?.role === 'admin') return next();
  if (req.user?.isPremium()) return next();
  return res.status(403).json({ success: false, message: 'Premium membership required', requiresPremium: true });
};

const generateToken = (id) =>
  jwt.sign({ id }, process.env.JWT_SECRET, {
    expiresIn: AUTH_CONFIG.JWT_EXPIRE
  });

module.exports = { protect, adminOnly, teacherOrAdmin, premiumOrAdmin, generateToken, invalidateUserCache };
