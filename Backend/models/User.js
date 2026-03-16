const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');

const UserSchema = new mongoose.Schema(
  {
    username: {
      type: String,
      required: true,
      unique: true,
      trim: true,
      minlength: 3,
    },
    email: {
      type: String,
      required: true,
      unique: true,
      lowercase: true,
    },
    password: {
      type: String,
      required: true,
      minlength: 6,
    },
    role: {
      type: String,
      enum: ['user', 'admin'],
      default: 'user',
    },
    isGuest: {
      type: Boolean,
      default: false,
    },
    tier: {
      type: String,
      enum: ['guest', 'pro', 'business'],
      default: 'guest',
    },
    tokens: {
      balance: { type: Number, default: 0 },
      used: { type: Number, default: 0 },
      resetAt: { type: Date, default: null },
    },
    sessionTokensUsed: { type: Number, default: 0 },
    sessionId: { type: String, default: null },
  },
  { timestamps: true }
);

// Hash password before saving
// Mongoose 9: async pre-hooks do NOT receive `next` — just return/throw
UserSchema.pre('save', async function () {
  if (!this.isModified('password')) return;
  const salt = await bcrypt.genSalt(8);
  this.password = await bcrypt.hash(this.password, salt);
});

UserSchema.methods.comparePassword = async function (candidatePassword) {
  return bcrypt.compare(candidatePassword, this.password);
};

// Set token balance according to tier limits from env
UserSchema.methods.setTierTokens = function () {
  const limits = {
    guest: parseInt(process.env.GUEST_TOKENS || '30', 10),
    pro: parseInt(process.env.PRO_TOKENS || '300', 10),
    business: parseInt(process.env.BUSINESS_TOKENS || '700', 10),
  };
  this.tokens.balance = limits[this.tier] ?? 30;
  this.tokens.used = 0;
  this.tokens.resetAt =
    this.tier === 'guest'
      ? null
      : new Date(Date.now() + 30 * 24 * 60 * 60 * 1000); // 30 days for paid tiers
};

module.exports = mongoose.models.User || mongoose.model('User', UserSchema);
