const express = require('express');
const router = express.Router();
const Video = require('../models/Video');
const User = require('../models/User');
const { protect, adminOnly, teacherOrAdmin } = require('../middleware/auth');
const { escapeRegex } = require('../middleware/security');

// @GET /api/videos — List videos
router.get('/', protect, async (req, res) => {
  try {
    const { category, search, page = 1, limit = 12 } = req.query;
    const query = { isActive: true };
    if (category && category !== 'All') query.category = category;
    if (search) query.title = new RegExp(escapeRegex(search), 'i');
    const total = await Video.countDocuments(query);
    const videos = await Video.find(query)
      .select('-qualities')
      .populate('createdBy', 'name role')
      .sort({ order: 1, createdAt: -1 })
      .skip((page - 1) * limit).limit(Number(limit));
    res.json({ success: true, videos, total });
  } catch (err) { res.status(500).json({ success: false, message: err.message }); }
});

// @GET /api/videos/manage — Teacher/Admin: list own or all videos
router.get('/manage', protect, teacherOrAdmin, async (req, res) => {
  try {
    const query = { isActive: true };
    if (req.user.role === 'teacher') query.createdBy = req.user._id;
    const videos = await Video.find(query)
      .populate('createdBy', 'name role')
      .sort({ createdAt: -1 });
    res.json({ success: true, videos });
  } catch (err) { res.status(500).json({ success: false, message: err.message }); }
});

// @GET /api/videos/:id
router.get('/:id', protect, async (req, res) => {
  try {
    const video = await Video.findById(req.params.id);
    if (!video || !video.isActive)
      return res.status(404).json({ success: false, message: 'Video not found' });
    if (video.isPremium && !req.user.isPremium() && req.user.role === 'user')
      return res.status(403).json({ success: false, message: 'Premium required', requiresPremium: true });
    await Video.findByIdAndUpdate(req.params.id, { $inc: { views: 1 } });
    res.json({ success: true, video });
  } catch (err) { res.status(500).json({ success: false, message: err.message }); }
});

// @POST /api/videos — Teacher or Admin
router.post('/', protect, teacherOrAdmin, async (req, res) => {
  try {
    const video = await Video.create({ ...req.body, createdBy: req.user._id });
    if (req.user.role === 'teacher') {
      await User.findByIdAndUpdate(req.user._id, { $inc: { videosUploaded: 1 } });
    }
    res.status(201).json({ success: true, video });
  } catch (err) { res.status(500).json({ success: false, message: err.message }); }
});

// @PUT /api/videos/:id — Teacher (own) or Admin (any)
router.put('/:id', protect, teacherOrAdmin, async (req, res) => {
  try {
    const video = await Video.findById(req.params.id);
    if (!video) return res.status(404).json({ success: false, message: 'Not found' });
    if (req.user.role === 'teacher' && video.createdBy?.toString() !== req.user._id.toString()) {
      return res.status(403).json({ success: false, message: 'You can only edit your own videos' });
    }
    const updated = await Video.findByIdAndUpdate(req.params.id, req.body, { new: true });
    res.json({ success: true, video: updated });
  } catch (err) { res.status(500).json({ success: false, message: err.message }); }
});

// @DELETE /api/videos/:id — Teacher (own) or Admin (any)
router.delete('/:id', protect, teacherOrAdmin, async (req, res) => {
  try {
    const video = await Video.findById(req.params.id);
    if (!video) return res.status(404).json({ success: false, message: 'Not found' });
    if (req.user.role === 'teacher' && video.createdBy?.toString() !== req.user._id.toString()) {
      return res.status(403).json({ success: false, message: 'You can only delete your own videos' });
    }
    await Video.findByIdAndUpdate(req.params.id, { isActive: false });
    res.json({ success: true, message: 'Video deleted' });
  } catch (err) { res.status(500).json({ success: false, message: err.message }); }
});

module.exports = router;
