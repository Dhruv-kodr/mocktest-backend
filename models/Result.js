const mongoose = require('mongoose');

const answerSchema = new mongoose.Schema({
  question: { type: mongoose.Schema.Types.ObjectId, ref: 'Question', required: true },
  selectedAnswer: { type: String, enum: ['A', 'B', 'C', 'D', null], default: null },
  isCorrect: { type: Boolean, default: false },
  isMarkedForReview: { type: Boolean, default: false },
  timeSpent: { type: Number, default: 0 }, // seconds
}, { _id: false });

const resultSchema = new mongoose.Schema({
  user: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  test: { type: mongoose.Schema.Types.ObjectId, ref: 'Test', required: true },
  answers: [answerSchema],
  score: { type: Number, default: 0 },
  totalMarks: { type: Number, required: true },
  percentage: { type: Number, default: 0 },
  correctAnswers: { type: Number, default: 0 },
  incorrectAnswers: { type: Number, default: 0 },
  skippedAnswers: { type: Number, default: 0 },
  timeTaken: { type: Number, default: 0 }, // seconds
  rank: { type: Number, default: 0 },
  status: { type: String, enum: ['completed', 'auto-submitted', 'in-progress'], default: 'completed' },
  startTime: { type: Date, required: true },
  endTime: { type: Date },
}, { timestamps: true });

// Performance indexes for common query patterns
resultSchema.index({ user: 1, test: 1 });
resultSchema.index({ test: 1, percentage: -1 }); // Leaderboard ranking
resultSchema.index({ user: 1, createdAt: -1 }); // User results timeline
resultSchema.index({ createdAt: -1 }); // Dashboard aggregations
resultSchema.index({ test: 1, score: -1 }); // Rank calculation

module.exports = mongoose.model('Result', resultSchema);
