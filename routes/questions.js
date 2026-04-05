const express = require('express');
const router = express.Router();
const Question = require('../models/Question');
const User = require('../models/User');
const { protect, adminOnly, teacherOrAdmin } = require('../middleware/auth');
const { escapeRegex } = require('../middleware/security');
const { validateObjectId } = require('../middleware/validateObjectId');

// @GET /api/questions — Admin/Teacher get all with filters
router.get('/', protect, teacherOrAdmin, async (req, res) => {
  try {
    const { category, difficulty, subject, search, page = 1, limit = 20 } = req.query;
    const query = { isActive: true };
    // Teachers only see their own questions
    if (req.user.role === 'teacher') query.createdBy = req.user._id;
    if (category) query.category = category;
    if (difficulty) query.difficulty = difficulty;
    if (subject) query.subject = new RegExp(escapeRegex(subject), 'i');
    if (search) query.text = new RegExp(escapeRegex(search), 'i');
    const total = await Question.countDocuments(query);
    const questions = await Question.find(query)
      .populate('createdBy', 'name role')
      .skip((page - 1) * limit).limit(Number(limit))
      .sort({ createdAt: -1 });
    res.json({ success: true, questions, total, page: Number(page), pages: Math.ceil(total / limit) });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

// @POST /api/questions — Teacher or Admin
router.post('/', protect, teacherOrAdmin, async (req, res) => {
  try {
    const q = await Question.create({ ...req.body, createdBy: req.user._id });
    // Update teacher stats
    if (req.user.role === 'teacher') {
      await User.findByIdAndUpdate(req.user._id, { $inc: { questionsAdded: 1 } });
    }
    res.status(201).json({ success: true, question: q });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

// @PUT /api/questions/:id — Teacher (own) or Admin (any)
router.put('/:id', protect, teacherOrAdmin, async (req, res) => {
  try {
    const q = await Question.findById(req.params.id);
    if (!q) return res.status(404).json({ success: false, message: 'Question not found' });
    // Teachers can only edit their own
    if (req.user.role === 'teacher' && q.createdBy?.toString() !== req.user._id.toString()) {
      return res.status(403).json({ success: false, message: 'You can only edit your own questions' });
    }
    const updated = await Question.findByIdAndUpdate(req.params.id, req.body, { new: true });
    res.json({ success: true, question: updated });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

// @DELETE /api/questions/:id — Teacher (own) or Admin (any)
router.delete('/:id', protect, teacherOrAdmin, async (req, res) => {
  try {
    const q = await Question.findById(req.params.id);
    if (!q) return res.status(404).json({ success: false, message: 'Question not found' });
    if (req.user.role === 'teacher' && q.createdBy?.toString() !== req.user._id.toString()) {
      return res.status(403).json({ success: false, message: 'You can only delete your own questions' });
    }
    await Question.findByIdAndUpdate(req.params.id, { isActive: false });
    res.json({ success: true, message: 'Question deleted' });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

// @POST /api/questions/bulk — Admin only
router.post('/bulk', protect, adminOnly, async (req, res) => {
  try {
    const questions = req.body.questions.map(q => ({ ...q, createdBy: req.user._id }));
    const inserted = await Question.insertMany(questions);
    res.status(201).json({ success: true, count: inserted.length, questions: inserted });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

module.exports = router;
