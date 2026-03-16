const mongoose = require('mongoose');

const PasswordResetTokenSchema = new mongoose.Schema({
  userId:    { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  codeHash:  { type: String, required: true },   // SHA-256 of the 6-digit code
  expiresAt: { type: Date, required: true },
  used:      { type: Boolean, default: false },
}, { timestamps: true });

// MongoDB TTL: auto-delete expired documents
PasswordResetTokenSchema.index({ expiresAt: 1 }, { expireAfterSeconds: 0 });

module.exports = mongoose.model('PasswordResetToken', PasswordResetTokenSchema);
