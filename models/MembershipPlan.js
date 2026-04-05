const mongoose = require('mongoose');

const membershipPlanSchema = new mongoose.Schema({
  name: { type: String, required: true, trim: true },
  slug: { type: String, required: true, unique: true },
  description: { type: String, default: '' },
  price: { type: Number, required: true },
  currency: { type: String, default: 'INR' },
  durationDays: { type: Number, required: true },
  features: [String],
  maxTests: { type: Number, default: -1 }, // -1 = unlimited
  isActive: { type: Boolean, default: true },
  isPopular: { type: Boolean, default: false },
  order: { type: Number, default: 0 },
}, { timestamps: true });

module.exports = mongoose.model('MembershipPlan', membershipPlanSchema);
