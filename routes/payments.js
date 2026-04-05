const express = require('express');
const router = express.Router();
const crypto = require('crypto');
const Payment = require('../models/Payment');
const MembershipPlan = require('../models/MembershipPlan');
const User = require('../models/User');
const { protect, adminOnly } = require('../middleware/auth');

// Lazy-load Razorpay to avoid crash if not installed
let Razorpay;
try { Razorpay = require('razorpay'); } catch { Razorpay = null; }

const getRazorpay = () => {
  if (!Razorpay || !process.env.RAZORPAY_KEY_ID) return null;
  return new Razorpay({
    key_id: process.env.RAZORPAY_KEY_ID,
    key_secret: process.env.RAZORPAY_KEY_SECRET,
  });
};

// @POST /api/payments/create-order
router.post('/create-order', protect, async (req, res) => {
  try {
    const { planId } = req.body;
    const plan = await MembershipPlan.findById(planId);
    if (!plan || !plan.isActive)
      return res.status(404).json({ success: false, message: 'Plan not found' });

    const razorpay = getRazorpay();

    // If Razorpay not configured, use manual/demo mode
    if (!razorpay) {
      const payment = await Payment.create({
        user: req.user._id, plan: planId,
        amount: plan.price, currency: plan.currency,
        gateway: 'manual', status: 'pending',
        gatewayOrderId: `DEMO_${Date.now()}`
      });
      return res.json({ success: true, demo: true, payment, plan,
        message: 'Demo mode: Razorpay not configured' });
    }

    const order = await razorpay.orders.create({
      amount: plan.price * 100, currency: plan.currency,
      receipt: `receipt_${Date.now()}`,
    });

    const payment = await Payment.create({
      user: req.user._id, plan: planId,
      amount: plan.price, currency: plan.currency,
      gateway: 'razorpay', gatewayOrderId: order.id,
    });

    res.json({ success: true, order, payment, plan });
    // Note: Razorpay key is sent via separate /config endpoint for security
  } catch (err) { res.status(500).json({ success: false, message: err.message }); }
});

// @POST /api/payments/verify — Verify Razorpay payment
router.post('/verify', protect, async (req, res) => {
  try {
    const { paymentId, orderId, signature, razorpayPaymentId } = req.body;

    const payment = await Payment.findOne({ gatewayOrderId: orderId }).populate('plan');
    if (!payment) return res.status(404).json({ success: false, message: 'Payment not found' });

    // Verify signature
    if (process.env.RAZORPAY_KEY_SECRET) {
      const body = orderId + '|' + razorpayPaymentId;
      const expectedSig = crypto.createHmac('sha256', process.env.RAZORPAY_KEY_SECRET)
        .update(body).digest('hex');
      if (expectedSig !== signature)
        return res.status(400).json({ success: false, message: 'Payment verification failed' });
    }

    await activateMembership(payment, razorpayPaymentId, signature);
    res.json({ success: true, message: 'Payment successful! Membership activated.' });
  } catch (err) { res.status(500).json({ success: false, message: err.message }); }
});

// @POST /api/payments/demo-activate — Demo activation (no real payment)
router.post('/demo-activate', protect, async (req, res) => {
  try {
    const { paymentId } = req.body;
    const payment = await Payment.findById(paymentId).populate('plan');
    if (!payment) return res.status(404).json({ success: false, message: 'Not found' });
    await activateMembership(payment, 'DEMO_PAYMENT', 'DEMO_SIG');
    res.json({ success: true, message: 'Demo membership activated!' });
  } catch (err) { res.status(500).json({ success: false, message: err.message }); }
});

async function activateMembership(payment, gatewayPaymentId, signature) {
  const start = new Date();
  const end = new Date();
  end.setDate(end.getDate() + payment.plan.durationDays);

  payment.status = 'success';
  payment.gatewayPaymentId = gatewayPaymentId;
  payment.gatewaySignature = signature;
  payment.membershipStart = start;
  payment.membershipEnd = end;
  await payment.save();

  await User.findByIdAndUpdate(payment.user, {
    'membership.plan': payment.plan._id,
    'membership.status': 'premium',
    'membership.startDate': start,
    'membership.endDate': end,
  });
}

// @GET /api/payments/config — Get public Razorpay config (key only, not secret)
router.get('/config', protect, (req, res) => {
  res.json({
    success: true,
    key: process.env.RAZORPAY_KEY_ID || null,
    currency: 'INR',
  });
});

// @GET /api/payments/my — User's payments
router.get('/my', protect, async (req, res) => {
  try {
    const payments = await Payment.find({ user: req.user._id })
      .populate('plan', 'name price durationDays').sort({ createdAt: -1 });
    res.json({ success: true, payments });
  } catch (err) { res.status(500).json({ success: false, message: err.message }); }
});

// @GET /api/payments/all — Admin all payments
router.get('/all', protect, adminOnly, async (req, res) => {
  try {
    const { page = 1, limit = 20, status } = req.query;
    const query = status ? { status } : {};
    const total = await Payment.countDocuments(query);
    const payments = await Payment.find(query)
      .populate('user', 'name email')
      .populate('plan', 'name price')
      .sort({ createdAt: -1 })
      .skip((page - 1) * limit).limit(Number(limit));
    res.json({ success: true, payments, total });
  } catch (err) { res.status(500).json({ success: false, message: err.message }); }
});

// @GET /api/payments/stats — Admin payment stats
router.get('/stats', protect, adminOnly, async (req, res) => {
  try {
    const [totalRevenue, totalPayments, successPayments, premiumUsers] = await Promise.all([
      Payment.aggregate([{ $match: { status: 'success' } }, { $group: { _id: null, total: { $sum: '$amount' } } }]),
      Payment.countDocuments(),
      Payment.countDocuments({ status: 'success' }),
      User.countDocuments({ 'membership.status': 'premium', 'membership.endDate': { $gt: new Date() } }),
    ]);
    res.json({ success: true, stats: {
      totalRevenue: totalRevenue[0]?.total || 0,
      totalPayments, successPayments, premiumUsers
    }});
  } catch (err) { res.status(500).json({ success: false, message: err.message }); }
});

module.exports = router;
