const mongoose = require('mongoose');

const testSchema = new mongoose.Schema({
  title: { type: String, required: true, trim: true },
  description: { type: String, default: '' },
  // category stored as String (matches Category.name) — no enum restriction so dynamic categories work
  category: { type: String, required: true, trim: true },
  questions: [{ type: mongoose.Schema.Types.ObjectId, ref: 'Question' }],
  totalQuestions: { type: Number, required: true, min: 1 },
  duration: { type: Number, required: true, min: 1 }, // minutes
  totalMarks: { type: Number, required: true, min: 1 },
  marksPerQuestion: { type: Number, default: 1, min: 0 },
  negativeMarking: { type: Boolean, default: false },
  negativeMarks: { type: Number, default: 0.25, min: 0 },
  difficulty: { type: String, enum: ['Easy', 'Medium', 'Hard', 'Mixed'], default: 'Mixed' },
  isActive: { type: Boolean, default: true },
  isRandom: { type: Boolean, default: false },
  randomCount: { type: Number, default: 0 },
  attempts: { type: Number, default: 0 },
  createdBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
  thumbnail: { type: String, default: '' },
  instructions: [{ type: String }],
  tags: [{ type: String }],
}, { timestamps: true });

// Performance indexes for common query patterns
testSchema.index({ category: 1, isActive: 1 });
testSchema.index({ createdBy: 1 });
testSchema.index({ isActive: 1, createdAt: -1 });
testSchema.index({ title: 'text', description: 'text' }); // Text search

module.exports = mongoose.model('Test', testSchema);
