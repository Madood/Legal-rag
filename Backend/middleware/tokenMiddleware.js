const jwt = require('jsonwebtoken');
const User = require('../models/User');
const TokenTransaction = require('../models/TokenTransaction');
const { isDbReady } = require('../config/db');

// Attach req.user from JWT (required on protected routes)
async function authenticate(req, res, next) {
  // When DB is unavailable, bypass auth so RAG queries still work (no token tracking)
  if (!isDbReady()) {
    req.user = null;
    req._tokenCost = 0;
    return next();
  }

  const authHeader = req.headers.authorization;
  if (!authHeader?.startsWith('Bearer ')) {
    return res.status(401).json({ success: false, error: 'Authentication required' });
  }
  try {
    const decoded = jwt.verify(
      authHeader.slice(7),
      process.env.JWT_SECRET || 'change_me'
    );
    const user = await User.findById(decoded.userId).select('-password');
    if (!user) return res.status(401).json({ success: false, error: 'User not found' });
    req.user = user;
    next();
  } catch {
    res.status(401).json({ success: false, error: 'Invalid or expired token' });
  }
}

// Determine token cost for a request
function calculateTokenCost(req) {
  const body = req.body || {};
  const question = (body.question || '').toLowerCase();

  // AI fallback indicator from body (Python service may set this later; estimate here)
  if (question.includes('?') && question.length < 20) return 0; // clarification
  if (body._aiUsed) return 3;
  if (body._crossStatute) return 2;
  return 1; // standard query
}

// Gate the request based on token balance and session limits
async function checkTokens(req, res, next) {
  const user = req.user;
  // DB unavailable bypass — allow query without token deduction
  if (!user) return next();

  const cost = calculateTokenCost(req);
  req._tokenCost = cost; // stash for deductTokens

  if (cost === 0) return next(); // clarifications are free

  if (user.tokens.balance < cost) {
    return res.status(402).json({
      success: false,
      error: 'Insufficient tokens',
      code: 'TOKEN_EXHAUSTED',
      data: {
        balance: user.tokens.balance,
        required: cost,
        tier: user.tier,
      },
    });
  }

  // Guest session limit
  if (user.isGuest) {
    const limit = parseInt(process.env.GUEST_SESSION_LIMIT || '5', 10);
    if (user.sessionTokensUsed >= limit) {
      return res.status(402).json({
        success: false,
        error: 'Session limit reached',
        code: 'SESSION_LIMIT',
        data: {
          sessionUsed: user.sessionTokensUsed,
          limit,
          tier: 'guest',
        },
      });
    }
  }

  next();
}

// Deduct tokens after a successful response (call after sending response)
async function deductTokens(user, cost, meta = {}) {
  if (cost === 0) return;
  try {
    user.tokens.balance -= cost;
    user.tokens.used += cost;
    if (user.isGuest) user.sessionTokensUsed += cost;
    await user.save();

    await TokenTransaction.create({
      userId: user._id,
      type: 'deduct',
      amount: cost,
      balanceAfter: user.tokens.balance,
      reason: 'chat_query',
      sessionId: user.sessionId || null,
      queryMeta: {
        statute: meta.statute || null,
        doctrineLevel: meta.doctrineLevel || null,
        aiUsed: meta.aiUsed || false,
        crossStatute: meta.crossStatute || false,
      },
    });
  } catch (err) {
    console.error('Token deduction failed (non-fatal):', err.message);
  }
}

module.exports = { authenticate, checkTokens, calculateTokenCost, deductTokens };
