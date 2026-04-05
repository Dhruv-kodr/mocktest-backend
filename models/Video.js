const mongoose = require('mongoose');

const videoSchema = new mongoose.Schema({
  title: { type: String, required: true, trim: true },
  description: { type: String, default: '' },
  category: {
    type: String,
    enum: ['SSC', 'Railway', 'Banking', 'UPSC', 'Defence', 'State PSC', 'Teaching', 'Other'],
    required: true
  },
  subject: { type: String, default: '' },
  videoUrl: { type: String, required: true },
  thumbnailUrl: { type: String, default: '' },
  duration: { type: Number, default: 0 }, // seconds
  qualities: [{
    label: { type: String, enum: ['360p', '480p', '720p', '1080p'] },
    url: { type: String }
  }],
  isPremium: { type: Boolean, default: false },
  isActive: { type: Boolean, default: true },
  views: { type: Number, default: 0 },
  order: { type: Number, default: 0 },
  tags: [String],
  createdBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
}, { timestamps: true });

// Performance indexes for common query patterns
videoSchema.index({ category: 1, isActive: 1 });
videoSchema.index({ isPremium: 1, isActive: 1 });
videoSchema.index({ createdBy: 1 });
videoSchema.index({ title: 'text', description: 'text' }); // Text search

module.exports = mongoose.model('Video', videoSchema);
