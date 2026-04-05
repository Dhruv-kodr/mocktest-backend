const mongoose = require('mongoose');

const paymentSchema = new mongoose.Schema({
  user: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  plan: { type: mongoose.Schema.Types.ObjectId, ref: 'MembershipPlan', required: true },
  amount: { type: Number, required: true },
  currency: { type: String, default: 'INR' },
  gateway: { type: String, enum: ['razorpay', 'stripe', 'manual'], default: 'razorpay' },
  gatewayOrderId: { type: String },
  gatewayPaymentId: { type: String },
  gatewaySignature: { type: String },
  status: { type: String, enum: ['pending', 'success', 'failed', 'refunded'], default: 'pending' },
  membershipStart: { type: Date },
  membershipEnd: { type: Date },
  metadata: { type: Object, default: {} },
}, { timestamps: true });

module.exports = mongoose.model('Payment', paymentSchema);
