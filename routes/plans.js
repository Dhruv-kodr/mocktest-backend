const express = require('express');
const router = express.Router();
const MembershipPlan = require('../models/MembershipPlan');
const { protect, adminOnly } = require('../middleware/auth');

// @GET /api/plans — Public listing
router.get('/', async (req, res) => {
  try {
    const plans = await MembershipPlan.find({ isActive: true }).sort({ order: 1 });
    res.json({ success: true, plans });
  } catch (err) { res.status(500).json({ success: false, message: err.message }); }
});

// @GET /api/plans/all — Admin all plans
router.get('/all', protect, adminOnly, async (req, res) => {
  try {
    const plans = await MembershipPlan.find().sort({ order: 1 });
    res.json({ success: true, plans });
  } catch (err) { res.status(500).json({ success: false, message: err.message }); }
});

// @POST /api/plans — Admin create
router.post('/', protect, adminOnly, async (req, res) => {
  try {
    const plan = await MembershipPlan.create(req.body);
    res.status(201).json({ success: true, plan });
  } catch (err) { res.status(500).json({ success: false, message: err.message }); }
});

// @PUT /api/plans/:id — Admin update
router.put('/:id', protect, adminOnly, async (req, res) => {
  try {
    const plan = await MembershipPlan.findByIdAndUpdate(req.params.id, req.body, { new: true });
    res.json({ success: true, plan });
  } catch (err) { res.status(500).json({ success: false, message: err.message }); }
});

// @DELETE /api/plans/:id — Admin delete
router.delete('/:id', protect, adminOnly, async (req, res) => {
  try {
    await MembershipPlan.findByIdAndUpdate(req.params.id, { isActive: false });
    res.json({ success: true, message: 'Plan deactivated' });
  } catch (err) { res.status(500).json({ success: false, message: err.message }); }
});

module.exports = router;
