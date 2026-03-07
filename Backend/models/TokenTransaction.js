const mongoose = require('mongoose');

const TokenTransactionSchema = new mongoose.Schema(
  {
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
      index: true,
    },
    type: {
      type: String,
      enum: ['deduct', 'grant', 'reset'],
      required: true,
    },
    amount: { type: Number, required: true },
    balanceAfter: { type: Number, required: true },
    reason: { type: String, default: '' }, // e.g. 'chat_query', 'signup_bonus'
    sessionId: { type: String, default: null },
    queryMeta: {
      statute: { type: String, default: null },
      doctrineLevel: { type: String, default: null },
      aiUsed: { type: Boolean, default: false },
      crossStatute: { type: Boolean, default: false },
    },
  },
  { timestamps: true }
);

module.exports =
  mongoose.models.TokenTransaction ||
  mongoose.model('TokenTransaction', TokenTransactionSchema);
