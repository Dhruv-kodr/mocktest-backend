const express = require('express');
const router = express.Router();
const mongoose = require('mongoose');
const Feedback = require('../models/Feedback');
const Test = require('../models/Test');
const { protect, adminOnly } = require('../middleware/auth');
const { validateObjectId } = require('../middleware/validateObjectId');

// @POST /api/feedback — Submit feedback after test
router.post('/', protect, async (req, res) => {
  try {
    const { testId, resultId, rating, review } = req.body;
    if (!rating || rating < 1 || rating > 5)
      return res.status(400).json({ success: false, message: 'Rating must be 1-5' });

    const existing = await Feedback.findOne({ user: req.user._id, test: testId });
    if (existing)
      return res.status(400).json({ success: false, message: 'You already reviewed this test' });

    const feedback = await Feedback.create({
      user: req.user._id, test: testId, result: resultId, rating, review
    });
    res.status(201).json({ success: true, feedback });
  } catch (err) { res.status(500).json({ success: false, message: err.message }); }
});

// @GET /api/feedback/test/:testId — Get feedback for a test
router.get('/test/:testId', protect, validateObjectId('testId'), async (req, res) => {
  try {
    const { page = 1, limit = 10 } = req.query;
    const testObjectId = new mongoose.Types.ObjectId(req.params.testId);
    
    const total = await Feedback.countDocuments({ test: testObjectId, isPublished: true });
    const feedbacks = await Feedback.find({ test: testObjectId, isPublished: true })
      .populate('user', 'name avatar')
      .sort({ createdAt: -1 })
      .skip((page - 1) * limit).limit(Number(limit));

    const stats = await Feedback.aggregate([
      { $match: { test: testObjectId } },
      { $group: { _id: null, avgRating: { $avg: '$rating' }, total: { $sum: 1 },
        dist: { $push: '$rating' } } }
    ]);

    const ratingDist = [1,2,3,4,5].map(r => ({
      star: r,
      count: stats[0]?.dist?.filter(d => d === r).length || 0
    }));

    res.json({ success: true, feedbacks, total, avgRating: stats[0]?.avgRating || 0, ratingDist });
  } catch (err) { res.status(500).json({ success: false, message: err.message }); }
});

// @GET /api/feedback/my — My feedback
router.get('/my', protect, async (req, res) => {
  try {
    const feedbacks = await Feedback.find({ user: req.user._id })
      .populate('test', 'title category').sort({ createdAt: -1 });
    res.json({ success: true, feedbacks });
  } catch (err) { res.status(500).json({ success: false, message: err.message }); }
});

// @GET /api/feedback/all — Admin: all feedback
router.get('/all', protect, adminOnly, async (req, res) => {
  try {
    const { page = 1, limit = 20 } = req.query;
    const total = await Feedback.countDocuments();
    const feedbacks = await Feedback.find()
      .populate('user', 'name email').populate('test', 'title category')
      .sort({ createdAt: -1 }).skip((page - 1) * limit).limit(Number(limit));
    res.json({ success: true, feedbacks, total });
  } catch (err) { res.status(500).json({ success: false, message: err.message }); }
});

// @PUT /api/feedback/:id/toggle — Admin toggle publish
router.put('/:id/toggle', protect, adminOnly, async (req, res) => {
  try {
    const fb = await Feedback.findById(req.params.id);
    if (!fb) return res.status(404).json({ success: false, message: 'Not found' });
    fb.isPublished = !fb.isPublished;
    await fb.save();
    res.json({ success: true, feedback: fb });
  } catch (err) { res.status(500).json({ success: false, message: err.message }); }
});

module.exports = router;
