const mongoose = require('mongoose');

const reportSchema = new mongoose.Schema({
  user: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  question: { type: mongoose.Schema.Types.ObjectId, ref: 'Question', required: true },
  test: { type: mongoose.Schema.Types.ObjectId, ref: 'Test' },
  type: {
    type: String,
    enum: ['wrong_answer', 'unclear_question', 'typo', 'wrong_explanation', 'suggestion', 'other'],
    required: true
  },
  description: { type: String, required: true, trim: true },
  status: { type: String, enum: ['pending', 'reviewed', 'resolved', 'rejected'], default: 'pending' },
  adminNote: { type: String, default: '' },
  resolvedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
  resolvedAt: { type: Date },
}, { timestamps: true });

module.exports = mongoose.model('Report', reportSchema);
