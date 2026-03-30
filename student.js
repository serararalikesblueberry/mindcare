const router  = require('express').Router();
const jwt     = require('jsonwebtoken');
const User    = require('./User');
const Session = require('./Session');

// ── Inline auth middleware ───────────────────────────────────────────────────
const protect = async (req, res, next) => {
  const auth = req.headers.authorization;
  if (!auth || !auth.startsWith('Bearer '))
    return res.status(401).json({ error: 'Not authorised — no token' });
  try {
    const decoded = jwt.verify(auth.split(' ')[1], process.env.JWT_SECRET);
    req.user = await User.findById(decoded.id).select('-password');
    if (!req.user) return res.status(401).json({ error: 'User not found' });
    next();
  } catch {
    return res.status(401).json({ error: 'Invalid or expired token' });
  }
};

const requireStudent = (req, res, next) => {
  if (req.user.role !== 'student')
    return res.status(403).json({ error: 'Access denied — students only' });
  next();
};

router.use(protect, requireStudent);

// POST /api/student/submit
router.post('/submit', async (req, res) => {
  try {
    const { answers, risk_level, normalized_score, consent, partial_info } = req.body;

    if (!Array.isArray(answers) || answers.length !== 16)
      return res.status(400).json({ error: 'Exactly 16 answers required.' });
    if (!['low', 'moderate', 'high'].includes(risk_level))
      return res.status(400).json({ error: 'Invalid risk_level.' });
    if (!['full', 'resources', 'none'].includes(consent))
      return res.status(400).json({ error: 'Invalid consent value.' });

    const formattedAnswers = answers.map(a => ({
      question_text: a.question_text,
      answer_value:  Number(a.answer_value),
    }));

    const session = await Session.create({
      student:          req.user._id,
      answers:          formattedAnswers,
      risk_level,
      normalized_score: Number(normalized_score),
      consent,
      partial_info:     consent === 'full' ? (partial_info || {}) : null,
      status:           'open',
    });

    res.status(201).json({
      sessionId:        session._id,
      risk_level:       session.risk_level,
      normalized_score: session.normalized_score,
      message:          'Check-in submitted successfully.',
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// GET /api/student/my-sessions
router.get('/my-sessions', async (req, res) => {
  try {
    const sessions = await Session.find({ student: req.user._id })
      .select('risk_level normalized_score consent status createdAt')
      .sort({ createdAt: -1 });
    res.json({ sessions });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// GET /api/student/session/:id
router.get('/session/:id', async (req, res) => {
  try {
    const session = await Session.findOne({ _id: req.params.id, student: req.user._id })
      .select('-student');
    if (!session) return res.status(404).json({ error: 'Session not found.' });
    res.json({ session });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// POST /api/student/answer-followup
router.post('/answer-followup', async (req, res) => {
  try {
    const { session_id, message_id, reply } = req.body;
    if (!reply) return res.status(400).json({ error: 'Reply text is required.' });

    const session = await Session.findOne({ _id: session_id, student: req.user._id });
    if (!session) return res.status(404).json({ error: 'Session not found.' });

    const msg = session.messages.id(message_id);
    if (!msg || msg.type !== 'followup')
      return res.status(404).json({ error: 'Follow-up question not found.' });

    msg.reply = reply;
    await session.save();
    res.json({ message: 'Reply submitted.' });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
