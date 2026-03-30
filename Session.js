const mongoose = require('mongoose');

// One answer per question
const answerSchema = new mongoose.Schema({
  question_text: { type: String, required: true },
  answer_value:  { type: Number, min: 1, max: 6, required: true }, // raw 1–6
}, { _id: false });

// What the student chose to reveal (only stored when consent === 'full')
const partialInfoSchema = new mongoose.Schema({
  year:  { type: String, default: '' },
  block: { type: String, default: '' },
  dept:  { type: String, default: '' },
}, { _id: false });

// A message from counsellor back to the student (follow-up Q or advice)
const counsellorMessageSchema = new mongoose.Schema({
  type:    { type: String, enum: ['followup', 'advice'], required: true },
  content: { type: String, required: true },
  sentAt:  { type: Date, default: Date.now },
  // Student reply (only for follow-up type)
  reply:   { type: String, default: null },
}, { _id: true });

const sessionSchema = new mongoose.Schema({
  // Student reference — stored internally, never exposed to counsellor
  student: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true,
  },

  // ── Questionnaire results ──────────────────────────
  answers:          { type: [answerSchema], required: true },
  risk_level:       { type: String, enum: ['low', 'moderate', 'high'], required: true },
  normalized_score: { type: Number, min: 0, max: 100, required: true },

  // ── Consent ───────────────────────────────────────
  // 'full'      → student wants counsellor contact, shared partial_info
  // 'resources' → student wants self-help only
  // 'none'      → no follow-up
  consent:      { type: String, enum: ['full', 'resources', 'none'], required: true },
  partial_info: { type: partialInfoSchema, default: null },

  // ── Counsellor workflow ───────────────────────────
  // null = unclaimed, ObjectId = claimed by this counsellor
  claimed_by:   { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null },
  claimed_at:   { type: Date, default: null },
  status:       { type: String, enum: ['open', 'in_progress', 'closed'], default: 'open' },

  // Messages from counsellor (follow-up Qs and advice)
  messages: { type: [counsellorMessageSchema], default: [] },

  // Flag: counsellor has been notified about this high-risk session
  notified: { type: Boolean, default: false },

}, { timestamps: true });

// Index so counsellor queries are fast
sessionSchema.index({ risk_level: 1, status: 1, createdAt: -1 });
sessionSchema.index({ claimed_by: 1, status: 1 });

module.exports = mongoose.model('Session', sessionSchema);
