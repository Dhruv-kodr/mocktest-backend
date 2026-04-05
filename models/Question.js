const mongoose = require('mongoose');

const questionSchema = new mongoose.Schema({
  text: { type: String, required: true },
  options: {
    A: { type: String, required: true },
    B: { type: String, required: true },
    C: { type: String, required: true },
    D: { type: String, required: true },
  },
  correctAnswer: { type: String, enum: ['A', 'B', 'C', 'D'], required: true },
  explanation: { type: String, default: '' },
  // category as plain String — no enum so dynamic categories from DB work
  category: { type: String, required: true, trim: true },
  subject: { type: String, required: true, trim: true },
  difficulty: { type: String, enum: ['Easy', 'Medium', 'Hard'], default: 'Medium' },
  tags: [String],
  createdBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
  isActive: { type: Boolean, default: true },
  timesAttempted: { type: Number, default: 0 },
  timesCorrect: { type: Number, default: 0 },
}, { timestamps: true });

// Performance indexes for common query patterns
questionSchema.index({ category: 1, isActive: 1 });
questionSchema.index({ subject: 1, difficulty: 1 });
questionSchema.index({ createdBy: 1 });
questionSchema.index({ isActive: 1, createdAt: -1 });
questionSchema.index({ text: 'text', category: 'text' }); // Text search

module.exports = mongoose.model('Question', questionSchema);
