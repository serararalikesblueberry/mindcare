require('dotenv').config();
const express   = require('express');
const cors      = require('cors');
const connectDB = require('./config/db');

const app = express();

// ── Middleware ────────────────────────────────────────────────────────────────
app.use(cors());
app.use(express.json());

// ── Routes ────────────────────────────────────────────────────────────────────
app.use('/api/auth',       require('./routes/auth'));
app.use('/api/student',    require('./routes/student'));
app.use('/api/counsellor', require('./routes/counsellor'));

// ── Health check ──────────────────────────────────────────────────────────────
app.get('/health', (_, res) => res.json({ status: 'ok', app: 'MindCare API' }));

// ── 404 fallback ─────────────────────────────────────────────────────────────
app.use((_, res) => res.status(404).json({ error: 'Route not found.' }));

// ── Start ─────────────────────────────────────────────────────────────────────
const PORT = process.env.PORT || 5000;
connectDB().then(() => {
  app.listen(PORT, () => console.log(`🚀 MindCare API running on port ${PORT}`));
});
