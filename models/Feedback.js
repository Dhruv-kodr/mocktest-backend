const mongoose = require('mongoose');

const feedbackSchema = new mongoose.Schema({
  user: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  test: { type: mongoose.Schema.Types.ObjectId, ref: 'Test', required: true },
  result: { type: mongoose.Schema.Types.ObjectId, ref: 'Result' },
  rating: { type: Number, min: 1, max: 5, required: true },
  review: { type: String, trim: true, maxlength: 1000 },
  isPublished: { type: Boolean, default: true },
}, { timestamps: true });

feedbackSchema.index({ test: 1, user: 1 }, { unique: true });

module.exports = mongoose.model('Feedback', feedbackSchema);
