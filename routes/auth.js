const express = require('express');
const router = express.Router();
const { body, validationResult } = require('express-validator');
const crypto = require('crypto');
const bcrypt = require('bcryptjs');
const User = require('../models/User');
const { generateToken, protect, invalidateUserCache } = require('../middleware/auth');
// Rate limiting removed for testing - unlimited login attempts allowed

// ─── Helpers ───────────────────────────────────────────────────────────────
const generateOTP = () => Math.floor(100000 + Math.random() * 900000).toString();

// Hash OTP for secure storage (using faster rounds for OTPs since they expire quickly)
const hashOTP = async (otp) => bcrypt.hash(otp, 6);
const verifyOTP = async (otp, hashedOTP) => bcrypt.compare(otp, hashedOTP);

// Simulate SMS (replace with Twilio in production)
const sendSMS = async (phone, otp) => {
  console.log(`📱 [OTP SMS] To: ${phone} | OTP: ${otp} | Expires: 5 min`);
  // Twilio example (uncomment when configured):
  // const twilio = require('twilio')(process.env.TWILIO_SID, process.env.TWILIO_TOKEN);
  // await twilio.messages.create({ body: `Your Janta Exam OTP is: ${otp}`, from: process.env.TWILIO_PHONE, to: phone });
  return true;
};

// ─── Register ───────────────────────────────────────────────────────────────
router.post('/register', [
  body('name').notEmpty().trim().isLength({ min: 2, max: 100 }).withMessage('Name must be 2-100 characters'),
  body('email').isEmail().normalizeEmail().withMessage('Valid email required'),
  body('password')
    .isLength({ min: 8 })
    .withMessage('Password must be at least 8 characters')
    .matches(/^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)/)
    .withMessage('Password must contain uppercase, lowercase, and number'),
], async (req, res) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({ success: false, message: errors.array()[0].msg });
  }
  try {
    const { name, email, password, phone } = req.body;
    const exists = await User.findOne({ email });
    if (exists) return res.status(400).json({ success: false, message: 'Email is already registered' });

    const userData = { name, email, password, role: 'user', authProvider: 'local', isVerified: true };
    if (phone) userData.phone = phone;

    const user = await User.create(userData);
    const token = generateToken(user._id);
    res.status(201).json({ success: true, token, user, message: 'Account created successfully' });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

// ─── Login (all roles) ──────────────────────────────────────────────────────
// NOTE: This endpoint is used by the student portal and ONLY allows role='user'
// Admin and Teacher must use their respective login endpoints
router.post('/login', [
  body('email').isEmail().withMessage('Valid email required'),
  body('password').notEmpty().withMessage('Password required'),
], async (req, res) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) return res.status(400).json({ success: false, message: errors.array()[0].msg });
  try {
    const { email, password } = req.body;
    const user = await User.findOne({ email });
    if (!user) return res.status(401).json({ success: false, message: 'Invalid email or password' });
    
    // Enforce role-based portal access: /login is ONLY for students (role='user')
    if (user.role !== 'user') {
      return res.status(403).json({ 
        success: false, 
        message: `This login is for students only. Please use the ${user.role} login portal.`,
        redirectTo: user.role === 'admin' ? '/admin/login' : '/teacher/login'
      });
    }
    
    if (user.authProvider === 'google' && !user.password) {
      return res.status(400).json({ success: false, message: 'This account uses Google login. Please sign in with Google.' });
    }
    if (!(await user.matchPassword(password))) {
      return res.status(401).json({ success: false, message: 'Invalid email or password' });
    }
    if (user.isBlocked) return res.status(403).json({ success: false, message: 'Account blocked. Contact admin.' });
    if (!user.isActive) return res.status(403).json({ success: false, message: 'Account deactivated. Contact admin.' });
    user.lastLogin = new Date();
    await user.save({ validateBeforeSave: false });
    const token = generateToken(user._id);
    res.json({ success: true, token, user });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

// ─── Admin Login ────────────────────────────────────────────────────────────
router.post('/admin-login', [
  body('email').isEmail().withMessage('Valid email required'),
  body('password').notEmpty().withMessage('Password required'),
], async (req, res) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) return res.status(400).json({ success: false, message: errors.array()[0].msg });
  try {
    const { email, password } = req.body;
    
    // First check if user exists at all (for better error messages)
    const anyUser = await User.findOne({ email });
    if (!anyUser) {
      return res.status(401).json({ success: false, message: 'Invalid admin credentials' });
    }
    
    // Check if the user is actually an admin
    if (anyUser.role !== 'admin') {
      return res.status(403).json({ 
        success: false, 
        message: 'This login is for administrators only. Please use the appropriate login portal.',
        redirectTo: anyUser.role === 'user' ? '/login' : '/teacher/login'
      });
    }
    
    if (!(await anyUser.matchPassword(password))) {
      return res.status(401).json({ success: false, message: 'Invalid admin credentials' });
    }
    anyUser.lastLogin = new Date();
    await anyUser.save({ validateBeforeSave: false });
    const token = generateToken(anyUser._id);
    res.json({ success: true, token, user: anyUser });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

// ─── Teacher Login ──────────────────────────────────────────────────────────
router.post('/teacher-login', [
  body('email').isEmail().withMessage('Valid email required'),
  body('password').notEmpty().withMessage('Password required'),
], async (req, res) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) return res.status(400).json({ success: false, message: errors.array()[0].msg });
  try {
    const { email, password } = req.body;
    
    // First check if user exists at all (for better error messages)
    const anyUser = await User.findOne({ email });
    if (!anyUser) {
      return res.status(401).json({ success: false, message: 'Invalid teacher credentials' });
    }
    
    // Check if the user is actually a teacher
    if (anyUser.role !== 'teacher') {
      return res.status(403).json({ 
        success: false, 
        message: 'This login is for teachers only. Please use the appropriate login portal.',
        redirectTo: anyUser.role === 'user' ? '/login' : '/admin/login'
      });
    }
    
    if (!(await anyUser.matchPassword(password))) {
      return res.status(401).json({ success: false, message: 'Invalid teacher credentials' });
    }
    if (anyUser.isBlocked) return res.status(403).json({ success: false, message: 'Account blocked.' });
    if (!anyUser.isActive) return res.status(403).json({ success: false, message: 'Account deactivated.' });
    anyUser.lastLogin = new Date();
    await anyUser.save({ validateBeforeSave: false });
    const token = generateToken(anyUser._id);
    res.json({ success: true, token, user: anyUser });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

// ─── Google OAuth Login / Register ─────────────────────────────────────────
router.post('/google-login', async (req, res) => {
  try {
    const { googleId, email, name, avatar } = req.body;
    if (!googleId || !email) {
      return res.status(400).json({ success: false, message: 'Google ID and email are required' });
    }

    // Find by googleId or email
    let user = await User.findOne({ $or: [{ googleId }, { email }] });

    if (user) {
      // Update Google info if existing user
      if (!user.googleId) user.googleId = googleId;
      if (avatar && !user.avatar) user.avatar = avatar;
      user.authProvider = 'google';
      user.isVerified = true;
      user.lastLogin = new Date();
      await user.save({ validateBeforeSave: false });
    } else {
      // Create new user via Google
      user = await User.create({
        name, email, googleId, avatar: avatar || '',
        authProvider: 'google', isVerified: true,
        role: 'user', password: '',
      });
    }

    if (user.isBlocked) return res.status(403).json({ success: false, message: 'Account blocked. Contact admin.' });

    const token = generateToken(user._id);
    res.json({ success: true, token, user, message: user.createdAt === user.updatedAt ? 'Account created' : 'Login successful' });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

// ─── Send OTP (Phone) ───────────────────────────────────────────────────────
router.post('/send-otp', async (req, res) => {
  try {
    const { phone } = req.body;
    if (!phone || phone.trim().length < 10) {
      return res.status(400).json({ success: false, message: 'Valid phone number is required' });
    }
    const otp = generateOTP();
    const hashedOTP = await hashOTP(otp); // Hash OTP before storing
    const otpExpiry = new Date(Date.now() + 5 * 60 * 1000); // 5 minutes

    // Save OTP to temp record (or find existing user)
    let user = await User.findOne({ phone: phone.trim() });
    if (!user) {
      // Store OTP in a temporary user or use a separate OTP store
      // For now, we'll create a minimal record
      user = await User.findOneAndUpdate(
        { phone: phone.trim() },
        { $set: { otp: hashedOTP, otpExpiry } },
        { new: true, upsert: false }
      );
      // If no user with this phone, just return OTP in response for demo
      await sendSMS(phone, otp);
      return res.json({ 
        success: true, 
        message: 'OTP sent successfully',
        // Only expose OTP in development for testing
        ...(process.env.NODE_ENV !== 'production' && { demo_otp: otp })
      });
    }

    user.otp = hashedOTP; // Store hashed OTP
    user.otpExpiry = otpExpiry;
    await user.save({ validateBeforeSave: false });
    await sendSMS(phone, otp);

    res.json({
      success: true,
      message: 'OTP sent to your phone number',
      // Only expose OTP in development for testing
      ...(process.env.NODE_ENV !== 'production' && { demo_otp: otp })
    });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

// ─── Verify OTP ─────────────────────────────────────────────────────────────
router.post('/verify-otp', async (req, res) => {
  try {
    const { phone, otp } = req.body;
    if (!phone || !otp) {
      return res.status(400).json({ success: false, message: 'Phone and OTP are required' });
    }
    const user = await User.findOne({ phone: phone.trim() });
    if (!user) return res.status(404).json({ success: false, message: 'No account with this phone number' });
    if (!user.otp) {
      return res.status(400).json({ success: false, message: 'No OTP request found. Please request a new OTP.' });
    }
    
    // Verify hashed OTP
    const isValidOTP = await verifyOTP(otp.trim(), user.otp);
    if (!isValidOTP) {
      return res.status(400).json({ success: false, message: 'Invalid OTP' });
    }
    if (!user.otpExpiry || user.otpExpiry < new Date()) {
      return res.status(400).json({ success: false, message: 'OTP has expired. Please request a new one.' });
    }
    user.phoneVerified = true;
    user.otp = '';
    user.otpExpiry = null;
    await user.save({ validateBeforeSave: false });
    
    // Invalidate user cache after phone verification
    invalidateUserCache(user._id.toString());
    
    res.json({ success: true, message: 'Phone verified successfully!' });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

// ─── Get current user ───────────────────────────────────────────────────────
router.get('/me', protect, async (req, res) => {
  res.json({ success: true, user: req.user });
});

module.exports = router;
