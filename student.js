const router  = require('express').Router();
const Session = require('../models/Session');
const { protect, requireRole } = require('../middleware/auth');

// All student routes require auth + student role
router.use(protect, requireRole('student'));

// ── POST /api/student/submit ─────────────────────────────────────────────────
// Submit the 16-question wellbeing questionnaire
// Body: { answers, risk_level, normalized_score, consent, partial_info? }
router.post('/submit', async (req, res) => {
  try {
    const { answers, risk_level, normalized_score, consent, partial_info } = req.body;

    // Basic validation
    if (!Array.isArray(answers) || answers.length !== 16) {
      return res.status(400).json({ error: 'Exactly 16 answers required.' });
    }
    if (!['low', 'moderate', 'high'].includes(risk_level)) {
      return res.status(400).json({ error: 'Invalid risk_level.' });
    }
    if (!['full', 'resources', 'none'].includes(consent)) {
      return res.status(400).json({ error: 'Invalid consent value.' });
    }

    // Build formatted answers
    const formattedAnswers = answers.map(a => ({
      question_text: a.question_text,
      answer_value:  Number(a.answer_value),
    }));

    const sessionData = {
      student:          req.user._id,
      answers:          formattedAnswers,
      risk_level,
      normalized_score: Number(normalized_score),
      consent,
      partial_info:     consent === 'full' ? (partial_info || {}) : null,
      // High risk + full consent → immediately contactable
      status: 'open',
    };

    const session = await Session.create(sessionData);

    res.status(201).json({
      sessionId:       session._id,
      risk_level:      session.risk_level,
      normalized_score: session.normalized_score,
      message:         'Check-in submitted successfully.',
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ── GET /api/student/my-sessions ────────────────────────────────────────────
// Returns the logged-in student's own session history (no personal data leaked)
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

// ── GET /api/student/session/:id ─────────────────────────────────────────────
// Full session detail for the student (their own session only)
router.get('/session/:id', async (req, res) => {
  try {
    const session = await Session.findOne({
      _id: req.params.id,
      student: req.user._id,
    }).select('-student'); // don't leak student ObjectId back

    if (!session) return res.status(404).json({ error: 'Session not found.' });
    res.json({ session });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ── POST /api/student/answer-followup ────────────────────────────────────────
// Student replies to a counsellor follow-up question
// Body: { session_id, message_id, reply }
router.post('/answer-followup', async (req, res) => {
  try {
    const { session_id, message_id, reply } = req.body;
    if (!reply) return res.status(400).json({ error: 'Reply text is required.' });

    const session = await Session.findOne({
      _id: session_id,
      student: req.user._id,
    });
    if (!session) return res.status(404).json({ error: 'Session not found.' });

    const msg = session.messages.id(message_id);
    if (!msg || msg.type !== 'followup') {
      return res.status(404).json({ error: 'Follow-up question not found.' });
    }

    msg.reply = reply;
    await session.save();
    res.json({ message: 'Reply submitted.' });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
