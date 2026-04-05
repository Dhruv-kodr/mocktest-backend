const express = require('express');
const router = express.Router();
const multer = require('multer');
const path = require('path');
const fs = require('fs');
const StudyMaterial = require('../models/StudyMaterial');
const { protect, adminOnly, teacherOrAdmin } = require('../middleware/auth');
const { escapeRegex } = require('../middleware/security');

// ─── Multer config (local storage) ────────────────────────────────────────
const uploadDir = path.join(__dirname, '../uploads');
if (!fs.existsSync(uploadDir)) fs.mkdirSync(uploadDir, { recursive: true });

const storage = multer.diskStorage({
  destination: (req, file, cb) => cb(null, uploadDir),
  filename: (req, file, cb) => {
    const unique = Date.now() + '-' + Math.round(Math.random() * 1e9);
    cb(null, unique + path.extname(file.originalname));
  },
});

const ALLOWED_TYPES = [
  'application/pdf',
  'application/msword',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  'application/vnd.ms-powerpoint',
  'application/vnd.openxmlformats-officedocument.presentationml.presentation',
  'application/vnd.ms-excel',
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  'text/plain',
  'image/jpeg', 'image/png', 'image/gif',
  'application/zip',
];

const upload = multer({
  storage,
  limits: { fileSize: 50 * 1024 * 1024 }, // 50MB
  fileFilter: (req, file, cb) => {
    if (ALLOWED_TYPES.includes(file.mimetype)) {
      cb(null, true);
    } else {
      cb(new Error(`File type not allowed: ${file.mimetype}`), false);
    }
  },
});

// ─── GET /api/material — List materials (public) ───────────────────────────
router.get('/', protect, async (req, res) => {
  try {
    const { category, search, page = 1, limit = 20 } = req.query;
    const query = { isActive: true };
    if (category && category !== 'All') query.category = category;
    if (search) {
      const safeSearch = new RegExp(escapeRegex(search), 'i');
      query.$or = [{ title: safeSearch }, { description: safeSearch }];
    }
    const total = await StudyMaterial.countDocuments(query);
    const materials = await StudyMaterial.find(query)
      .populate('uploadedBy', 'name role')
      .sort({ createdAt: -1 })
      .skip((page - 1) * Number(limit))
      .limit(Number(limit));

    // Build download URL for each material
    const baseUrl = process.env.BASE_URL || `http://localhost:${process.env.PORT || 5000}`;
    const materialsWithUrl = materials.map(m => ({
      ...m.toObject(),
      downloadUrl: m.fileUrl.startsWith('http') ? m.fileUrl : `${baseUrl}/uploads/${path.basename(m.fileUrl)}`,
    }));

    res.json({ success: true, materials: materialsWithUrl, total });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

// ─── GET /api/material/all — Admin: all including inactive ─────────────────
router.get('/all', protect, teacherOrAdmin, async (req, res) => {
  try {
    const { category, search, page = 1, limit = 30 } = req.query;
    const query = {};
    // Teachers see only their own
    if (req.user.role === 'teacher') query.uploadedBy = req.user._id;
    if (category && category !== 'All') query.category = category;
    if (search) query.title = new RegExp(escapeRegex(search), 'i');
    const total = await StudyMaterial.countDocuments(query);
    const materials = await StudyMaterial.find(query)
      .populate('uploadedBy', 'name role')
      .sort({ createdAt: -1 })
      .skip((page - 1) * Number(limit))
      .limit(Number(limit));
    const baseUrl = process.env.BASE_URL || `http://localhost:${process.env.PORT || 5000}`;
    const materialsWithUrl = materials.map(m => ({
      ...m.toObject(),
      downloadUrl: m.fileUrl.startsWith('http') ? m.fileUrl : `${baseUrl}/uploads/${path.basename(m.fileUrl)}`,
    }));
    res.json({ success: true, materials: materialsWithUrl, total });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

// ─── POST /api/material/upload — Upload file ───────────────────────────────
router.post('/upload', protect, teacherOrAdmin, (req, res) => {
  upload.single('file')(req, res, async (err) => {
    if (err instanceof multer.MulterError) {
      if (err.code === 'LIMIT_FILE_SIZE') return res.status(400).json({ success: false, message: 'File too large. Max 50MB allowed.' });
      return res.status(400).json({ success: false, message: err.message });
    } else if (err) {
      return res.status(400).json({ success: false, message: err.message });
    }

    try {
      const { title, description, category, tags } = req.body;
      if (!title?.trim()) return res.status(400).json({ success: false, message: 'Title is required' });
      if (!category?.trim()) return res.status(400).json({ success: false, message: 'Category is required' });

      let fileUrl, fileName, fileType, fileSize;

      if (req.file) {
        // Local file upload
        fileUrl = req.file.path;
        fileName = req.file.originalname;
        fileType = path.extname(req.file.originalname).replace('.', '').toLowerCase();
        fileSize = req.file.size;
      } else if (req.body.fileUrl) {
        // URL-based upload (Cloudinary/S3 URL passed directly)
        fileUrl = req.body.fileUrl;
        fileName = req.body.fileName || 'file';
        fileType = req.body.fileType || 'pdf';
        fileSize = 0;
      } else {
        return res.status(400).json({ success: false, message: 'File or file URL is required' });
      }

      const material = await StudyMaterial.create({
        title: title.trim(),
        description: description?.trim() || '',
        category: category.trim(),
        fileUrl,
        fileName,
        fileType,
        fileSize,
        uploadedBy: req.user._id,
        tags: tags ? tags.split(',').map(t => t.trim()).filter(Boolean) : [],
      });

      const populated = await StudyMaterial.findById(material._id).populate('uploadedBy', 'name role');
      res.status(201).json({ success: true, material: populated, message: 'Material uploaded successfully' });
    } catch (err) {
      res.status(500).json({ success: false, message: err.message });
    }
  });
});

// ─── PUT /api/material/:id — Update metadata ──────────────────────────────
router.put('/:id', protect, teacherOrAdmin, async (req, res) => {
  try {
    const mat = await StudyMaterial.findById(req.params.id);
    if (!mat) return res.status(404).json({ success: false, message: 'Material not found' });
    if (req.user.role === 'teacher' && mat.uploadedBy?.toString() !== req.user._id.toString()) {
      return res.status(403).json({ success: false, message: 'You can only edit your own materials' });
    }
    const { title, description, category, isActive, tags } = req.body;
    if (title) mat.title = title.trim();
    if (description !== undefined) mat.description = description.trim();
    if (category) mat.category = category.trim();
    if (isActive !== undefined) mat.isActive = Boolean(isActive);
    if (tags) mat.tags = tags.split(',').map(t => t.trim()).filter(Boolean);
    await mat.save();
    res.json({ success: true, material: mat, message: 'Material updated' });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

// ─── DELETE /api/material/:id ──────────────────────────────────────────────
router.delete('/:id', protect, teacherOrAdmin, async (req, res) => {
  try {
    const mat = await StudyMaterial.findById(req.params.id);
    if (!mat) return res.status(404).json({ success: false, message: 'Material not found' });
    if (req.user.role === 'teacher' && mat.uploadedBy?.toString() !== req.user._id.toString()) {
      return res.status(403).json({ success: false, message: 'You can only delete your own materials' });
    }
    // Delete local file if exists
    if (mat.fileUrl && !mat.fileUrl.startsWith('http') && fs.existsSync(mat.fileUrl)) {
      fs.unlinkSync(mat.fileUrl);
    }
    await StudyMaterial.findByIdAndDelete(req.params.id);
    res.json({ success: true, message: 'Material deleted successfully' });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

// ─── POST /api/material/:id/download — Track download count ───────────────
router.post('/:id/download', protect, async (req, res) => {
  try {
    await StudyMaterial.findByIdAndUpdate(req.params.id, { $inc: { downloadCount: 1 } });
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

module.exports = router;
