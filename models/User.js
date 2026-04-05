const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');

const userSchema = new mongoose.Schema({
  name: { type: String, required: true, trim: true },
  email: { type: String, required: true, unique: true, lowercase: true, trim: true },
  password: { type: String, minlength: 6, default: '' },
  role: { type: String, enum: ['user', 'admin', 'teacher'], default: 'user' },
  avatar: { type: String, default: '' },
  phone: { type: String, default: '', trim: true },
  phoneVerified: { type: Boolean, default: false },
  isVerified: { type: Boolean, default: false },
  isBlocked: { type: Boolean, default: false },
  isActive: { type: Boolean, default: true },

  // Google OAuth
  googleId: { type: String, default: '' },
  authProvider: { type: String, enum: ['local', 'google'], default: 'local' },

  // OTP
  otp: { type: String, default: '' },
  otpExpiry: { type: Date, default: null },

  // Stats
  bookmarks: [{ type: mongoose.Schema.Types.ObjectId, ref: 'Question' }],
  totalAttempts: { type: Number, default: 0 },
  totalScore: { type: Number, default: 0 },
  questionsAdded: { type: Number, default: 0 },
  videosUploaded: { type: Number, default: 0 },

  // Membership
  membership: {
    plan: { type: mongoose.Schema.Types.ObjectId, ref: 'MembershipPlan', default: null },
    status: { type: String, enum: ['free', 'premium', 'expired'], default: 'free' },
    startDate: { type: Date, default: null },
    endDate: { type: Date, default: null },
  },

  lastLogin: { type: Date },
}, { timestamps: true });

userSchema.pre('save', async function (next) {
  if (!this.isModified('password') || !this.password) return next();
  const salt = await bcrypt.genSalt(12);
  this.password = await bcrypt.hash(this.password, salt);
  next();
});

userSchema.methods.matchPassword = async function (entered) {
  if (!this.password) return false;
  return await bcrypt.compare(entered, this.password);
};

userSchema.methods.isPremium = function () {
  return this.membership.status === 'premium' && this.membership.endDate > new Date();
};

userSchema.methods.toJSON = function () {
  const obj = this.toObject();
  delete obj.password;
  delete obj.otp;
  delete obj.otpExpiry;
  return obj;
};

// Performance indexes for common query patterns
userSchema.index({ email: 1 });
userSchema.index({ role: 1 });
userSchema.index({ 'membership.status': 1, 'membership.endDate': 1 });
userSchema.index({ isActive: 1, createdAt: -1 });

module.exports = mongoose.model('User', userSchema);
