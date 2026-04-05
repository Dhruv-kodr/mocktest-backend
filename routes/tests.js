const express = require('express');
const router = express.Router();
const mongoose = require('mongoose');
const Test = require('../models/Test');
const Question = require('../models/Question');
const { protect, adminOnly, teacherOrAdmin } = require('../middleware/auth');
const { escapeRegex } = require('../middleware/security');

// ─── IMPORTANT: Specific routes BEFORE parameterized routes ─────────────────

// @GET /api/tests/builder/questions — Load questions for test builder (admin/teacher)
router.get('/builder/questions', protect, teacherOrAdmin, async (req, res) => {
  try {
    const { category, search } = req.query;
    const query = { isActive: true };
    if (category && category !== 'All') query.category = category;
    if (search) query.text = new RegExp(escapeRegex(search), 'i');
    const questions = await Question.find(query)
      .select('text category subject difficulty options correctAnswer')
      .sort({ category: 1, createdAt: -1 })
      .limit(300);
    res.json({ success: true, questions, total: questions.length });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

// @GET /api/tests/admin/all — Admin: get ALL tests including inactive, with questions count
router.get('/admin/all', protect, teacherOrAdmin, async (req, res) => {
  try {
    const { category, search, page = 1, limit = 50 } = req.query;
    const query = {};
    if (category && category !== 'All') query.category = category;
    if (search) query.title = new RegExp(escapeRegex(search), 'i');
    const total = await Test.countDocuments(query);
    const tests = await Test.find(query)
      .populate('createdBy', 'name role')
      .sort({ createdAt: -1 })
      .skip((page - 1) * Number(limit))
      .limit(Number(limit));
    res.json({ success: true, tests, total });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

// ─── Public / User routes ────────────────────────────────────────────────────

// @GET /api/tests — Active tests for users
router.get('/', protect, async (req, res) => {
  try {
    const { category, difficulty, search, page = 1, limit = 12 } = req.query;
    const query = { isActive: true };
    if (category && category !== 'All') query.category = category;
    if (difficulty) query.difficulty = difficulty;
    if (search) query.title = new RegExp(escapeRegex(search), 'i');
    const total = await Test.countDocuments(query);
    const tests = await Test.find(query)
      .select('-questions')
      .sort({ createdAt: -1 })
      .skip((page - 1) * Number(limit))
      .limit(Number(limit));
    res.json({ success: true, tests, total, page: Number(page), pages: Math.ceil(total / Number(limit)) });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

// @GET /api/tests/:id — Get single test with questions
router.get('/:id', protect, async (req, res) => {
  try {
    // Validate ObjectId
    if (!mongoose.Types.ObjectId.isValid(req.params.id)) {
      return res.status(400).json({ success: false, message: 'Invalid test ID' });
    }
    const test = await Test.findById(req.params.id).populate({
      path: 'questions',
      match: { isActive: true },
    });
    if (!test) return res.status(404).json({ success: false, message: 'Test not found' });

    let questions = test.questions || [];

    // Randomize if needed
    if (test.isRandom && test.randomCount > 0) {
      questions = [...questions].sort(() => Math.random() - 0.5).slice(0, test.randomCount);
    }

    // Strip correct answers for regular users
    if (req.user.role === 'user') {
      questions = questions.map(q => {
        const obj = q.toObject ? q.toObject() : q;
        const { correctAnswer, explanation, ...rest } = obj;
        return rest;
      });
    }

    res.json({ success: true, test: { ...test.toObject(), questions } });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

// @POST /api/tests — Admin or Teacher creates test
router.post('/', protect, teacherOrAdmin, async (req, res) => {
  try {
    const {
      title, description, category, duration, totalMarks,
      marksPerQuestion, negativeMarking, negativeMarks,
      difficulty, isActive, isRandom, randomCount,
      questions, instructions, tags,
    } = req.body;

    // Validate required fields
    if (!title || !title.trim()) {
      return res.status(400).json({ success: false, message: 'Test title is required' });
    }
    if (!category || !category.trim()) {
      return res.status(400).json({ success: false, message: 'Category is required' });
    }
    if (!duration || Number(duration) < 1) {
      return res.status(400).json({ success: false, message: 'Duration must be at least 1 minute' });
    }
    if (!totalMarks || Number(totalMarks) < 1) {
      return res.status(400).json({ success: false, message: 'Total marks must be at least 1' });
    }

    const questionIds = Array.isArray(questions) ? questions.filter(id => mongoose.Types.ObjectId.isValid(id)) : [];

    if (!isRandom && questionIds.length === 0) {
      return res.status(400).json({ success: false, message: 'Add at least one question, or enable random mode' });
    }

    const totalQuestions = isRandom ? (Number(randomCount) || questionIds.length) : questionIds.length;

    const test = await Test.create({
      title: title.trim(),
      description: description || '',
      category: category.trim(),
      duration: Number(duration),
      totalMarks: Number(totalMarks),
      marksPerQuestion: Number(marksPerQuestion) || 1,
      negativeMarking: Boolean(negativeMarking),
      negativeMarks: Number(negativeMarks) || 0.25,
      difficulty: difficulty || 'Mixed',
      isActive: isActive !== undefined ? Boolean(isActive) : true,
      isRandom: Boolean(isRandom),
      randomCount: Number(randomCount) || 0,
      questions: questionIds,
      totalQuestions,
      instructions: Array.isArray(instructions) ? instructions.filter(Boolean) : [],
      tags: Array.isArray(tags) ? tags.filter(Boolean) : [],
      createdBy: req.user._id,
    });

    const populated = await Test.findById(test._id).populate('createdBy', 'name role');
    res.status(201).json({ success: true, test: populated, message: 'Test created successfully' });
  } catch (err) {
    console.error('Test create error:', err);
    if (err.name === 'ValidationError') {
      const messages = Object.values(err.errors).map(e => e.message).join(', ');
      return res.status(400).json({ success: false, message: messages });
    }
    res.status(500).json({ success: false, message: err.message });
  }
});

// @PUT /api/tests/:id — Admin or Teacher updates test
router.put('/:id', protect, teacherOrAdmin, async (req, res) => {
  try {
    if (!mongoose.Types.ObjectId.isValid(req.params.id)) {
      return res.status(400).json({ success: false, message: 'Invalid test ID' });
    }

    const test = await Test.findById(req.params.id);
    if (!test) return res.status(404).json({ success: false, message: 'Test not found' });

    // Teachers can only edit their own tests
    if (req.user.role === 'teacher' && test.createdBy?.toString() !== req.user._id.toString()) {
      return res.status(403).json({ success: false, message: 'You can only edit your own tests' });
    }

    const {
      title, description, category, duration, totalMarks,
      marksPerQuestion, negativeMarking, negativeMarks,
      difficulty, isActive, isRandom, randomCount,
      questions, instructions, tags,
    } = req.body;

    // Build update object with only defined fields
    const updateData = {};
    if (title !== undefined) updateData.title = title.trim();
    if (description !== undefined) updateData.description = description;
    if (category !== undefined) updateData.category = category.trim();
    if (duration !== undefined) updateData.duration = Number(duration);
    if (totalMarks !== undefined) updateData.totalMarks = Number(totalMarks);
    if (marksPerQuestion !== undefined) updateData.marksPerQuestion = Number(marksPerQuestion);
    if (negativeMarking !== undefined) updateData.negativeMarking = Boolean(negativeMarking);
    if (negativeMarks !== undefined) updateData.negativeMarks = Number(negativeMarks);
    if (difficulty !== undefined) updateData.difficulty = difficulty;
    if (isActive !== undefined) updateData.isActive = Boolean(isActive);
    if (isRandom !== undefined) updateData.isRandom = Boolean(isRandom);
    if (randomCount !== undefined) updateData.randomCount = Number(randomCount);
    if (instructions !== undefined) updateData.instructions = Array.isArray(instructions) ? instructions.filter(Boolean) : [];
    if (tags !== undefined) updateData.tags = Array.isArray(tags) ? tags.filter(Boolean) : [];

    if (questions !== undefined) {
      const questionIds = Array.isArray(questions)
        ? questions.filter(id => mongoose.Types.ObjectId.isValid(String(id))).map(id => String(id))
        : [];
      updateData.questions = questionIds;
      updateData.totalQuestions = updateData.isRandom
        ? (updateData.randomCount || questionIds.length)
        : questionIds.length;
    }

    const updated = await Test.findByIdAndUpdate(
      req.params.id,
      { $set: updateData },
      { new: true, runValidators: true }
    ).populate('createdBy', 'name role');

    res.json({ success: true, test: updated, message: 'Test updated successfully' });
  } catch (err) {
    console.error('Test update error:', err);
    if (err.name === 'ValidationError') {
      const messages = Object.values(err.errors).map(e => e.message).join(', ');
      return res.status(400).json({ success: false, message: messages });
    }
    res.status(500).json({ success: false, message: err.message });
  }
});

// @DELETE /api/tests/:id
router.delete('/:id', protect, teacherOrAdmin, async (req, res) => {
  try {
    if (!mongoose.Types.ObjectId.isValid(req.params.id)) {
      return res.status(400).json({ success: false, message: 'Invalid test ID' });
    }
    const test = await Test.findById(req.params.id);
    if (!test) return res.status(404).json({ success: false, message: 'Test not found' });
    if (req.user.role === 'teacher' && test.createdBy?.toString() !== req.user._id.toString()) {
      return res.status(403).json({ success: false, message: 'You can only delete your own tests' });
    }
    await Test.findByIdAndUpdate(req.params.id, { isActive: false });
    res.json({ success: true, message: 'Test deleted successfully' });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

module.exports = router;
