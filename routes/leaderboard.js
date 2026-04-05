const express = require('express');
const router = express.Router();
const mongoose = require('mongoose');
const Result = require('../models/Result');
const { protect } = require('../middleware/auth');
const { validateObjectId } = require('../middleware/validateObjectId');

// @GET /api/leaderboard/global/top - MUST come before /:testId
router.get('/global/top', protect, async (req, res) => {
  try {
    const topUsers = await Result.aggregate([
      { $group: {
        _id: '$user',
        avgScore: { $avg: '$percentage' },
        totalAttempts: { $sum: 1 },
        totalScore: { $sum: '$score' }
      }},
      { $sort: { avgScore: -1 } },
      { $limit: 20 },
      { $lookup: { from: 'users', localField: '_id', foreignField: '_id', as: 'user' } },
      { $unwind: '$user' },
      { $project: { 'user.password': 0, 'user.otp': 0, 'user.otpExpiry': 0 } }
    ]);
    res.json({ success: true, leaderboard: topUsers });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

// @GET /api/leaderboard/:testId
router.get('/:testId', protect, validateObjectId('testId'), async (req, res) => {
  try {
    const testObjectId = new mongoose.Types.ObjectId(req.params.testId);
    const results = await Result.find({ test: testObjectId })
      .populate('user', 'name avatar')
      .sort({ score: -1, timeTaken: 1 })
      .limit(50);
    
    const leaderboard = results.map((r, i) => ({
      rank: i + 1,
      user: r.user,
      score: r.score,
      percentage: r.percentage,
      timeTaken: r.timeTaken,
      correctAnswers: r.correctAnswers,
      date: r.createdAt,
    }));

    res.json({ success: true, leaderboard });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

module.exports = router;
