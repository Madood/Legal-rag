const express = require('express');
const router = express.Router();
const jwt = require('jsonwebtoken');
const crypto = require('crypto');
const User = require('../models/User');
const TokenTransaction = require('../models/TokenTransaction');
const { isDbReady } = require('../config/db');

// Use built-in crypto instead of uuid package (avoids ESM incompatibility)
const uuidv4 = () => crypto.randomUUID();

// Guard: reject all auth requests when MongoDB is not connected
router.use((req, res, next) => {
  if (!isDbReady()) {
    return res.status(503).json({
      success: false,
      error: 'Database unavailable. Please start MongoDB and restart the server.',
    });
  }
  next();
});

function signToken(userId) {
  return jwt.sign(
    { userId },
    process.env.JWT_SECRET || 'change_me',
    { expiresIn: process.env.JWT_EXPIRES_IN || '7d' }
  );
}

function userPayload(user) {
  return {
    id: user._id,
    username: user.username,
    email: user.email,
    isGuest: user.isGuest,
    tier: user.tier,
    tokens: user.tokens,
    sessionTokensUsed: user.sessionTokensUsed,
  };
}

// POST /api/auth/guest — create a temporary guest account
router.post('/guest', async (req, res) => {
  try {
    const sessionId = uuidv4();
    const guestNum = Date.now();
    const user = new User({
      username: `guest_${guestNum}`,
      email: `guest_${guestNum}@noreply.local`,
      password: uuidv4(), // random, never used
      isGuest: true,
      tier: 'guest',
      sessionId,
      sessionTokensUsed: 0,
    });
    user.setTierTokens();
    await user.save();

    await TokenTransaction.create({
      userId: user._id,
      type: 'grant',
      amount: user.tokens.balance,
      balanceAfter: user.tokens.balance,
      reason: 'guest_signup',
      sessionId,
    });

    const token = signToken(user._id);
    res.status(201).json({ success: true, data: { user: userPayload(user), token } });
  } catch (error) {
    console.error('Guest creation failed:', error);
    res.status(500).json({ success: false, error: 'Guest creation failed' });
  }
});

// POST /api/auth/register
router.post('/register', async (req, res) => {
  try {
    const { username, email, password, tier = 'pro' } = req.body;
    if (!username || !email || !password) {
      return res.status(400).json({ success: false, error: 'Username, email, and password are required' });
    }

    const existing = await User.findOne({ $or: [{ email }, { username }] });
    if (existing) {
      return res.status(400).json({ success: false, error: 'User already exists' });
    }

    const allowedTiers = ['pro', 'business'];
    const safeTier = allowedTiers.includes(tier) ? tier : 'pro';
    const user = new User({ username, email, password, tier: safeTier });
    user.setTierTokens();
    await user.save();

    await TokenTransaction.create({
      userId: user._id,
      type: 'grant',
      amount: user.tokens.balance,
      balanceAfter: user.tokens.balance,
      reason: 'signup_bonus',
    });

    const token = signToken(user._id);
    res.status(201).json({ success: true, data: { user: userPayload(user), token } });
  } catch (error) {
    console.error('Registration failed:', error);
    res.status(500).json({ success: false, error: 'Registration failed' });
  }
});

// POST /api/auth/login
router.post('/login', async (req, res) => {
  try {
    const { email, password } = req.body;
    if (!email || !password) {
      return res.status(400).json({ success: false, error: 'Email and password are required' });
    }

    const user = await User.findOne({ email, isGuest: false });
    if (!user) {
      return res.status(401).json({ success: false, error: 'Invalid credentials' });
    }

    const valid = await user.comparePassword(password);
    if (!valid) {
      return res.status(401).json({ success: false, error: 'Invalid credentials' });
    }

    const token = signToken(user._id);
    res.json({ success: true, data: { user: userPayload(user), token } });
  } catch (error) {
    console.error('Login failed:', error);
    res.status(500).json({ success: false, error: 'Login failed' });
  }
});

// GET /api/auth/me  (requires Authorization: Bearer <token>)
router.get('/me', async (req, res) => {
  const authHeader = req.headers.authorization;
  if (!authHeader?.startsWith('Bearer ')) {
    return res.status(401).json({ success: false, error: 'Not authenticated' });
  }
  try {
    const decoded = jwt.verify(
      authHeader.slice(7),
      process.env.JWT_SECRET || 'change_me'
    );
    const user = await User.findById(decoded.userId).select('-password');
    if (!user) return res.status(401).json({ success: false, error: 'User not found' });
    res.json({ success: true, data: { user: userPayload(user) } });
  } catch {
    res.status(401).json({ success: false, error: 'Invalid token' });
  }
});

module.exports = router;
