const express = require('express');
const router = express.Router();
const User = require('../models/User');
const Test = require('../models/Test');
const Question = require('../models/Question');
const Result = require('../models/Result');
const { protect, adminOnly } = require('../middleware/auth');
const { escapeRegex } = require('../middleware/security');
const { validateObjectId } = require('../middleware/validateObjectId');

router.use(protect, adminOnly); // adminLimiter removed for testing

// ─── Dashboard Stats ────────────────────────────────────────────────────────
router.get('/stats', async (req, res) => {
  try {
    const [totalUsers, totalTeachers, totalTests, totalQuestions, totalAttempts, recentUsers, recentResults] = await Promise.all([
      User.countDocuments({ role: 'user' }),
      User.countDocuments({ role: 'teacher' }),
      Test.countDocuments({ isActive: true }),
      Question.countDocuments({ isActive: true }),
      Result.countDocuments(),
      User.find({ role: 'user' }).sort({ createdAt: -1 }).limit(5).select('name email createdAt'),
      Result.find().sort({ createdAt: -1 }).limit(5).populate('user', 'name').populate('test', 'title'),
    ]);
    const categoryStats = await Test.aggregate([
      { $match: { isActive: true } },
      { $group: { _id: '$category', count: { $sum: 1 } } },
    ]);
    const monthlyAttempts = await Result.aggregate([
      { $group: { _id: { year: { $year: '$createdAt' }, month: { $month: '$createdAt' } }, count: { $sum: 1 } } },
      { $sort: { '_id.year': -1, '_id.month': -1 } },
      { $limit: 6 },
    ]);
    res.json({ success: true, stats: { totalUsers, totalTeachers, totalTests, totalQuestions, totalAttempts }, categoryStats, monthlyAttempts: monthlyAttempts.reverse(), recentUsers, recentResults });
  } catch (err) { res.status(500).json({ success: false, message: err.message }); }
});

// ─── Admin Profile ──────────────────────────────────────────────────────────
router.get('/profile', async (req, res) => {
  try {
    const admin = await User.findById(req.user._id).select('-password -otp -otpExpiry');
    res.json({ success: true, admin });
  } catch (err) { res.status(500).json({ success: false, message: err.message }); }
});

router.put('/update-profile', async (req, res) => {
  try {
    const { name, email, phone, avatar } = req.body;
    if (!name?.trim()) return res.status(400).json({ success: false, message: 'Name is required' });
    if (email && email !== req.user.email) {
      const exists = await User.findOne({ email: email.toLowerCase(), _id: { $ne: req.user._id } });
      if (exists) return res.status(400).json({ success: false, message: 'Email already in use' });
    }
    const updated = await User.findByIdAndUpdate(
      req.user._id,
      { name: name.trim(), email: email?.toLowerCase() || req.user.email, phone: phone || '', avatar: avatar || '' },
      { new: true }
    ).select('-password -otp -otpExpiry');
    res.json({ success: true, admin: updated, message: 'Profile updated successfully' });
  } catch (err) { res.status(500).json({ success: false, message: err.message }); }
});

router.put('/change-password', async (req, res) => {
  try {
    const { oldPassword, newPassword, confirmPassword } = req.body;
    if (!oldPassword || !newPassword || !confirmPassword) {
      return res.status(400).json({ success: false, message: 'All password fields are required' });
    }
    if (newPassword.length < 6) {
      return res.status(400).json({ success: false, message: 'New password must be at least 6 characters' });
    }
    if (newPassword !== confirmPassword) {
      return res.status(400).json({ success: false, message: 'New password and confirm password do not match' });
    }
    const admin = await User.findById(req.user._id);
    const isMatch = await admin.matchPassword(oldPassword);
    if (!isMatch) return res.status(400).json({ success: false, message: 'Old password is incorrect' });
    admin.password = newPassword;
    await admin.save();
    res.json({ success: true, message: 'Password changed successfully!' });
  } catch (err) { res.status(500).json({ success: false, message: err.message }); }
});

// ─── User Management ────────────────────────────────────────────────────────
router.get('/users', async (req, res) => {
  try {
    const { search, page = 1, limit = 20 } = req.query;
    const query = { role: 'user' };
    if (search) {
      const safeSearch = new RegExp(escapeRegex(search), 'i');
      query.$or = [{ name: safeSearch }, { email: safeSearch }];
    }
    const total = await User.countDocuments(query);
    const users = await User.find(query).sort({ createdAt: -1 }).skip((page - 1) * limit).limit(Number(limit)).select('-password -otp');
    res.json({ success: true, users, total, page: Number(page), pages: Math.ceil(total / limit) });
  } catch (err) { res.status(500).json({ success: false, message: err.message }); }
});

router.put('/users/:id/toggle-block', async (req, res) => {
  try {
    const user = await User.findById(req.params.id);
    if (!user) return res.status(404).json({ success: false, message: 'User not found' });
    user.isBlocked = !user.isBlocked;
    await user.save({ validateBeforeSave: false });
    res.json({ success: true, user, message: user.isBlocked ? 'User blocked' : 'User unblocked' });
  } catch (err) { res.status(500).json({ success: false, message: err.message }); }
});

// ─── Teacher Management ─────────────────────────────────────────────────────
router.get('/teachers', async (req, res) => {
  try {
    const { search, page = 1, limit = 20 } = req.query;
    const query = { role: 'teacher' };
    if (search) {
      const safeSearch = new RegExp(escapeRegex(search), 'i');
      query.$or = [{ name: safeSearch }, { email: safeSearch }];
    }
    const total = await User.countDocuments(query);
    const teachers = await User.find(query).sort({ createdAt: -1 }).skip((page - 1) * limit).limit(Number(limit)).select('-password -otp');
    res.json({ success: true, teachers, total });
  } catch (err) { res.status(500).json({ success: false, message: err.message }); }
});

router.post('/teachers', async (req, res) => {
  try {
    const { name, email, password, phone } = req.body;
    if (!name || !email || !password) return res.status(400).json({ success: false, message: 'Name, email and password are required' });
    const exists = await User.findOne({ email });
    if (exists) return res.status(400).json({ success: false, message: 'Email already registered' });
    const teacher = await User.create({ name, email, password, phone, role: 'teacher', isActive: true });
    res.status(201).json({ success: true, teacher, message: 'Teacher account created' });
  } catch (err) { res.status(500).json({ success: false, message: err.message }); }
});

router.put('/teachers/:id/toggle-block', async (req, res) => {
  try {
    const teacher = await User.findOne({ _id: req.params.id, role: 'teacher' });
    if (!teacher) return res.status(404).json({ success: false, message: 'Teacher not found' });
    teacher.isBlocked = !teacher.isBlocked;
    await teacher.save({ validateBeforeSave: false });
    res.json({ success: true, teacher, message: teacher.isBlocked ? 'Teacher blocked' : 'Teacher unblocked' });
  } catch (err) { res.status(500).json({ success: false, message: err.message }); }
});

router.put('/teachers/:id/toggle-active', async (req, res) => {
  try {
    const teacher = await User.findOne({ _id: req.params.id, role: 'teacher' });
    if (!teacher) return res.status(404).json({ success: false, message: 'Teacher not found' });
    teacher.isActive = !teacher.isActive;
    await teacher.save({ validateBeforeSave: false });
    res.json({ success: true, teacher, message: teacher.isActive ? 'Teacher activated' : 'Teacher deactivated' });
  } catch (err) { res.status(500).json({ success: false, message: err.message }); }
});

router.delete('/teachers/:id', async (req, res) => {
  try {
    await User.findByIdAndDelete(req.params.id);
    res.json({ success: true, message: 'Teacher deleted' });
  } catch (err) { res.status(500).json({ success: false, message: err.message }); }
});

// ─── Results ────────────────────────────────────────────────────────────────
router.get('/results', async (req, res) => {
  try {
    const { testId, page = 1, limit = 20 } = req.query;
    const query = testId ? { test: testId } : {};
    const total = await Result.countDocuments(query);
    const results = await Result.find(query).populate('user', 'name email').populate('test', 'title category').sort({ createdAt: -1 }).skip((page - 1) * limit).limit(Number(limit));
    res.json({ success: true, results, total });
  } catch (err) { res.status(500).json({ success: false, message: err.message }); }
});

module.exports = router;
