const express = require('express');
const router = express.Router();
const Result = require('../models/Result');
const Test = require('../models/Test');
const Question = require('../models/Question');
const User = require('../models/User');
const { protect } = require('../middleware/auth');

// @POST /api/results/submit
router.post('/submit', protect, async (req, res) => {
  try {
    const { testId, answers, timeTaken, startTime, status } = req.body;
    const test = await Test.findById(testId).populate('questions');
    if (!test) return res.status(404).json({ success: false, message: 'Test not found' });

    let score = 0;
    let correctAnswers = 0;
    let incorrectAnswers = 0;
    let skippedAnswers = 0;

    // Build processed answers and bulk update operations in a single pass
    const bulkOps = [];
    const processedAnswers = test.questions.map((question) => {
      const userAnswer = answers.find(a => a.questionId === question._id.toString());
      const selected = userAnswer ? userAnswer.selectedAnswer : null;
      const isCorrect = selected && selected === question.correctAnswer;

      if (!selected) {
        skippedAnswers++;
      } else if (isCorrect) {
        correctAnswers++;
        score += test.marksPerQuestion;
      } else {
        incorrectAnswers++;
        if (test.negativeMarking) score -= test.negativeMarks;
      }

      // Prepare bulk operation for question stats update
      bulkOps.push({
        updateOne: {
          filter: { _id: question._id },
          update: { $inc: { timesAttempted: 1, ...(isCorrect ? { timesCorrect: 1 } : {}) } }
        }
      });

      return {
        question: question._id,
        selectedAnswer: selected,
        isCorrect,
        isMarkedForReview: userAnswer?.isMarkedForReview || false,
        timeSpent: userAnswer?.timeSpent || 0,
      };
    });

    // Execute all question updates in a single bulk write (N queries → 1 query)
    if (bulkOps.length > 0) {
      await Question.bulkWrite(bulkOps, { ordered: false });
    }

    const percentage = (score / test.totalMarks) * 100;

    const result = await Result.create({
      user: req.user._id,
      test: testId,
      answers: processedAnswers,
      score: Math.max(0, score),
      totalMarks: test.totalMarks,
      percentage: Math.max(0, percentage),
      correctAnswers,
      incorrectAnswers,
      skippedAnswers,
      timeTaken,
      startTime: new Date(startTime),
      endTime: new Date(),
      status: status || 'completed',
    });

    // Batch the remaining updates using Promise.all (3 independent operations)
    const [, , betterResults] = await Promise.all([
      // Update test attempt count
      Test.findByIdAndUpdate(testId, { $inc: { attempts: 1 } }),
      // Update user stats
      User.findByIdAndUpdate(req.user._id, {
        $inc: { totalAttempts: 1, totalScore: Math.max(0, score) }
      }),
      // Calculate rank using index-optimized count
      Result.countDocuments({
        test: testId,
        score: { $gt: result.score }
      })
    ]);

    // Update rank in result
    result.rank = betterResults + 1;
    await result.save();

    const populatedResult = await Result.findById(result._id)
      .populate('test', 'title category totalMarks duration negativeMarking marksPerQuestion negativeMarks')
      .populate({ path: 'answers.question', select: 'text options correctAnswer explanation category subject difficulty' });

    res.status(201).json({ success: true, result: populatedResult });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

// @GET /api/results/my
router.get('/my', protect, async (req, res) => {
  try {
    const { page = 1, limit = 10 } = req.query;
    const total = await Result.countDocuments({ user: req.user._id });
    const results = await Result.find({ user: req.user._id })
      .populate('test', 'title category duration totalMarks')
      .sort({ createdAt: -1 })
      .skip((page - 1) * limit).limit(Number(limit));
    res.json({ success: true, results, total, page: Number(page), pages: Math.ceil(total / limit) });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

// @GET /api/results/:id
router.get('/:id', protect, async (req, res) => {
  try {
    const result = await Result.findById(req.params.id)
      .populate('test', 'title category totalMarks duration negativeMarking marksPerQuestion negativeMarks')
      .populate({ path: 'answers.question', select: 'text options correctAnswer explanation category subject difficulty' });
    if (!result) return res.status(404).json({ success: false, message: 'Result not found' });
    if (result.user.toString() !== req.user._id.toString() && req.user.role !== 'admin') {
      return res.status(403).json({ success: false, message: 'Not authorized' });
    }
    res.json({ success: true, result });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

module.exports = router;
