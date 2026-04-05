const express  = require('express');
const router   = express.Router();
const Category = require('../models/Category');
const { protect, adminOnly } = require('../middleware/auth');

// ── @GET /api/categories — Public listing ────────────────────────────
router.get('/', async (req, res) => {
  try {
    const categories = await Category.find({ isActive: true }).sort({ order: 1, name: 1 });
    res.json({ success: true, categories });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

// ── @GET /api/categories/all — Admin (incl. inactive) ───────────────
router.get('/all', protect, adminOnly, async (req, res) => {
  try {
    const categories = await Category.find().sort({ order: 1, name: 1 });
    res.json({ success: true, categories });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

// ── @POST /api/categories — Admin create ────────────────────────────
router.post('/', protect, adminOnly, async (req, res) => {
  try {
    const { name, description, icon, color, order } = req.body;
    if (!name || !name.trim()) {
      return res.status(400).json({ success: false, message: 'Category name is required' });
    }

    const trimmed = name.trim();
    const existing = await Category.findOne({ name: { $regex: `^${trimmed}$`, $options: 'i' } });
    if (existing) {
      return res.status(400).json({ success: false, message: `Category "${trimmed}" already exists` });
    }

    const slug = trimmed.toLowerCase().replace(/\s+/g, '-').replace(/[^a-z0-9-]/g, '') || `cat-${Date.now()}`;
    const cat  = await Category.create({
      name: trimmed, slug, description: description || '',
      icon: icon || '📚', color: color || '#6366f1',
      order: order || 0, isActive: true,
    });
    res.status(201).json({ success: true, category: cat, message: 'Category created successfully' });
  } catch (err) {
    if (err.code === 11000) {
      const field = err.keyValue?.name ? 'name' : 'slug';
      return res.status(400).json({ success: false, message: `A category with that ${field} already exists` });
    }
    res.status(500).json({ success: false, message: err.message });
  }
});

// ── @PUT /api/categories/:id — Admin update ─────────────────────────
// BUG FIX: The old route always regenerated the slug from name,
// causing E11000 duplicate key when updating a category to the same
// name it already has (slug collides with itself in the index).
// Fix: exclude current doc from duplicate check, and only update
// slug when name actually changes to a DIFFERENT value.
router.put('/:id', protect, adminOnly, async (req, res) => {
  try {
    const { name, description, icon, color, order, isActive } = req.body;

    const current = await Category.findById(req.params.id);
    if (!current) return res.status(404).json({ success: false, message: 'Category not found' });

    const updateData = {};
    if (description !== undefined) updateData.description = description;
    if (icon        !== undefined) updateData.icon        = icon;
    if (color       !== undefined) updateData.color       = color;
    if (order       !== undefined) updateData.order       = order;
    if (isActive    !== undefined) updateData.isActive    = isActive;

    if (name && name.trim()) {
      const trimmed = name.trim();

      // Only check / update if name actually changed
      if (trimmed !== current.name) {
        // Check for duplicate name (exclude self)
        const duplicate = await Category.findOne({
          name: { $regex: `^${trimmed}$`, $options: 'i' },
          _id: { $ne: req.params.id },
        });
        if (duplicate) {
          return res.status(400).json({ success: false, message: `Category "${trimmed}" already exists` });
        }
        updateData.name = trimmed;
        updateData.slug = trimmed.toLowerCase().replace(/\s+/g, '-').replace(/[^a-z0-9-]/g, '') || `cat-${Date.now()}`;
      }
      // If name is same, don't touch name or slug → avoids self-collision
    }

    const cat = await Category.findByIdAndUpdate(
      req.params.id,
      { $set: updateData },
      { new: true, runValidators: false }, // runValidators: false avoids unique re-check on unchanged fields
    );
    res.json({ success: true, category: cat, message: 'Category updated successfully' });
  } catch (err) {
    if (err.code === 11000) {
      return res.status(400).json({ success: false, message: 'A category with that name or slug already exists' });
    }
    res.status(500).json({ success: false, message: err.message });
  }
});

// ── @DELETE /api/categories/:id — Soft delete ────────────────────────
router.delete('/:id', protect, adminOnly, async (req, res) => {
  try {
    const cat = await Category.findByIdAndUpdate(
      req.params.id, { $set: { isActive: false } }, { new: true }
    );
    if (!cat) return res.status(404).json({ success: false, message: 'Category not found' });
    res.json({ success: true, message: 'Category deactivated successfully' });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

module.exports = router;
