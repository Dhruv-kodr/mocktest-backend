const mongoose = require('mongoose');

const studyMaterialSchema = new mongoose.Schema({
  title: { type: String, required: true, trim: true },
  description: { type: String, default: '', trim: true },
  category: { type: String, required: true, trim: true },
  fileUrl: { type: String, required: true },
  fileName: { type: String, default: '' },
  fileType: { type: String, default: '' },  // pdf, docx, ppt, etc.
  fileSize: { type: Number, default: 0 },   // bytes
  downloadCount: { type: Number, default: 0 },
  isActive: { type: Boolean, default: true },
  uploadedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  tags: [{ type: String }],
}, { timestamps: true });

// Performance indexes for common query patterns
studyMaterialSchema.index({ category: 1, isActive: 1 });
studyMaterialSchema.index({ uploadedBy: 1 });
studyMaterialSchema.index({ title: 'text', description: 'text' }); // Text search

module.exports = mongoose.model('StudyMaterial', studyMaterialSchema);
