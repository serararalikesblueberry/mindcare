const router  = require('express').Router();
const Session = require('../models/Session');
const { protect, requireRole } = require('../middleware/auth');

router.use(protect, requireRole('counsellor'));

// ── GET /api/counsellor/dashboard ────────────────────────────────────────────
// Summary stats for the counsellor dashboard
router.get('/dashboard', async (req, res) => {
  try {
    const [total, high, moderate, low, mine, pending24h] = await Promise.all([
      Session.countDocuments({ consent: 'full' }),
      Session.countDocuments({ risk_level: 'high', consent: 'full' }),
      Session.countDocuments({ risk_level: 'moderate', consent: 'full' }),
      Session.countDocuments({ risk_level: 'low', consent: 'full' }),
      Session.countDocuments({ claimed_by: req.user._id, status: 'in_progress' }),

      // High-risk unclaimed sessions older than 24h — urgent!
      Session.countDocuments({
        risk_level: 'high',
        consent: 'full',
        status: 'open',
        createdAt: { $lte: new Date(Date.now() - 24 * 60 * 60 * 1000) },
      }),
    ]);

    res.json({ stats: { total, high, moderate, low, mine, pending24h } });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ── GET /api/counsellor/sessions ─────────────────────────────────────────────
// All sessions where student gave consent=full, with optional risk filter
// Query params: ?risk=high&status=open&page=1&limit=20
router.get('/sessions', async (req, res) => {
  try {
    const { risk, status, page = 1, limit = 20 } = req.query;
    const filter = { consent: 'full' };
    if (risk)   filter.risk_level = risk;
    if (status) filter.status = status;

    const sessions = await Session.find(filter)
      .select('risk_level normalized_score consent partial_info status claimed_by createdAt messages')
      .populate('claimed_by', 'username')
      .sort({ risk_level: 1, createdAt: -1 }) // high risk first
      .skip((page - 1) * limit)
      .limit(Number(limit));

    const total = await Session.countDocuments(filter);

    // Never expose student identity — strip student field
    res.json({ sessions, total, page: Number(page) });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ── GET /api/counsellor/session/:id ──────────────────────────────────────────
// Full session detail — answers, messages, partial_info
// Student ObjectId is never returned
router.get('/session/:id', async (req, res) => {
  try {
    const session = await Session.findOne({
      _id: req.params.id,
      consent: 'full',
    })
      .select('-student') // 🔒 anonymity preserved
      .populate('claimed_by', 'username');

    if (!session) return res.status(404).json({ error: 'Session not found.' });
    res.json({ session });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ── POST /api/counsellor/claim/:id ───────────────────────────────────────────
// Counsellor claims a session to work on it
router.post('/claim/:id', async (req, res) => {
  try {
    const session = await Session.findOne({ _id: req.params.id, consent: 'full' });
    if (!session) return res.status(404).json({ error: 'Session not found.' });
    if (session.claimed_by) {
      return res.status(409).json({ error: 'Session already claimed.' });
    }

    session.claimed_by = req.user._id;
    session.claimed_at = new Date();
    session.status = 'in_progress';
    await session.save();

    res.json({ message: 'Session claimed.', session_id: session._id });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ── POST /api/counsellor/message/:id ─────────────────────────────────────────
// Send a follow-up question or advice to the student
// Body: { type: "followup"|"advice", content }
router.post('/message/:id', async (req, res) => {
  try {
    const { type, content } = req.body;
    if (!['followup', 'advice'].includes(type)) {
      return res.status(400).json({ error: 'type must be followup or advice.' });
    }
    if (!content) return res.status(400).json({ error: 'content is required.' });

    const session = await Session.findOne({
      _id: req.params.id,
      consent: 'full',
      claimed_by: req.user._id,
    });
    if (!session) return res.status(404).json({ error: 'Session not found or not yours.' });

    session.messages.push({ type, content });
    await session.save();

    const newMsg = session.messages[session.messages.length - 1];
    res.json({ message: 'Sent.', msg_id: newMsg._id });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ── PATCH /api/counsellor/close/:id ──────────────────────────────────────────
// Mark a session as resolved
router.patch('/close/:id', async (req, res) => {
  try {
    const session = await Session.findOne({
      _id: req.params.id,
      claimed_by: req.user._id,
    });
    if (!session) return res.status(404).json({ error: 'Session not found.' });

    session.status = 'closed';
    await session.save();
    res.json({ message: 'Session closed.' });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
