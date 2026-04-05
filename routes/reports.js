const express = require('express');
const router = express.Router();
const Report = require('../models/Report');
const Question = require('../models/Question');
const { protect, adminOnly } = require('../middleware/auth');

// @POST /api/reports — Submit a report
router.post('/', protect, async (req, res) => {
  try {
    const { questionId, testId, type, description } = req.body;
    if (!description?.trim())
      return res.status(400).json({ success: false, message: 'Description required' });

    const report = await Report.create({
      user: req.user._id, question: questionId,
      test: testId, type, description
    });
    res.status(201).json({ success: true, report, message: 'Report submitted. Thank you!' });
  } catch (err) { res.status(500).json({ success: false, message: err.message }); }
});

// @GET /api/reports/all — Admin all reports
router.get('/all', protect, adminOnly, async (req, res) => {
  try {
    const { status, page = 1, limit = 20 } = req.query;
    const query = status ? { status } : {};
    const total = await Report.countDocuments(query);
    const reports = await Report.find(query)
      .populate('user', 'name email')
      .populate('question', 'text options correctAnswer category')
      .populate('test', 'title')
      .sort({ createdAt: -1 })
      .skip((page - 1) * limit).limit(Number(limit));
    res.json({ success: true, reports, total });
  } catch (err) { res.status(500).json({ success: false, message: err.message }); }
});

// @PUT /api/reports/:id/resolve — Admin resolve
router.put('/:id/resolve', protect, adminOnly, async (req, res) => {
  try {
    const { status, adminNote } = req.body;
    const report = await Report.findByIdAndUpdate(req.params.id, {
      status, adminNote,
      resolvedBy: req.user._id, resolvedAt: new Date()
    }, { new: true });
    res.json({ success: true, report });
  } catch (err) { res.status(500).json({ success: false, message: err.message }); }
});

module.exports = router;
