const router  = require('express').Router();
const jwt     = require('jsonwebtoken');
const User    = require('../models/User');

const signToken = (id) =>
  jwt.sign({ id }, process.env.JWT_SECRET, { expiresIn: process.env.JWT_EXPIRES_IN || '7d' });

// ── POST /api/auth/register ──────────────────────────────────────────────────
// Body: { username, password, role }
// Role must be "student" or "counsellor"
router.post('/register', async (req, res) => {
  try {
    const { username, password, role } = req.body;

    if (!username || !password || !role) {
      return res.status(400).json({ error: 'username, password and role are required.' });
    }
    if (!['student', 'counsellor'].includes(role)) {
      return res.status(400).json({ error: 'Role must be student or counsellor.' });
    }

    const exists = await User.findOne({ username: username.trim() });
    if (exists) return res.status(409).json({ error: 'Username already taken.' });

    const user = await User.create({ username: username.trim(), password, role });
    const token = signToken(user._id);

    res.status(201).json({
      token,
      user: { id: user._id, username: user.username, role: user.role },
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ── POST /api/auth/login ─────────────────────────────────────────────────────
// Body: { username, password }
router.post('/login', async (req, res) => {
  try {
    const { username, password } = req.body;
    if (!username || !password) {
      return res.status(400).json({ error: 'Username and password are required.' });
    }

    const user = await User.findOne({ username: username.trim() });
    if (!user || !(await user.comparePassword(password))) {
      return res.status(401).json({ error: 'Invalid username or password.' });
    }

    const token = signToken(user._id);
    res.json({
      token,
      user: { id: user._id, username: user.username, role: user.role },
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
