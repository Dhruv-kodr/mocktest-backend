const express = require('express');
const router = express.Router();
const User = require('../models/User');
const Question = require('../models/Question');
const { protect } = require('../middleware/auth');

// @PUT /api/users/profile
router.put('/profile', protect, async (req, res) => {
  try {
    const { name, phone, avatar } = req.body;
    const user = await User.findByIdAndUpdate(req.user._id, { name, phone, avatar }, { new: true });
    res.json({ success: true, user });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

// @PUT /api/users/change-password
router.put('/change-password', protect, async (req, res) => {
  try {
    const { currentPassword, newPassword } = req.body;
    const user = await User.findById(req.user._id);
    if (!(await user.matchPassword(currentPassword))) {
      return res.status(400).json({ success: false, message: 'Current password incorrect' });
    }
    user.password = newPassword;
    await user.save();
    res.json({ success: true, message: 'Password updated' });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

// @POST /api/users/bookmark/:questionId
router.post('/bookmark/:questionId', protect, async (req, res) => {
  try {
    const user = await User.findById(req.user._id);
    const qId = req.params.questionId;
    const idx = user.bookmarks.indexOf(qId);
    if (idx > -1) {
      user.bookmarks.splice(idx, 1);
    } else {
      user.bookmarks.push(qId);
    }
    await user.save();
    res.json({ success: true, bookmarks: user.bookmarks });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

// @GET /api/users/bookmarks
router.get('/bookmarks', protect, async (req, res) => {
  try {
    const user = await User.findById(req.user._id).populate('bookmarks');
    res.json({ success: true, bookmarks: user.bookmarks });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

module.exports = router;
