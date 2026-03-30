require('dotenv').config();
const express   = require('express');
const cors      = require('cors');
const connectDB = require('./db');

const app = express();

app.use(cors({
  origin: '*',
  methods: ['GET', 'POST', 'PATCH', 'DELETE'],
  allowedHeaders: ['Content-Type', 'Authorization']
}));//app.use(cors());
app.use(express.json());

app.use('/api/auth',       require('./auth'));
app.use('/api/student',    require('./student'));
app.use('/api/counsellor', require('./counsellor'));

app.get('/health', (_, res) => res.json({ status: 'ok', app: 'MindCare API' }));

app.use((_, res) => res.status(404).json({ error: 'Route not found.' }));

const PORT = process.env.PORT || 5000;
connectDB().then(() => {
  app.listen(PORT, () => console.log(`🚀 MindCare API running on port ${PORT}`));
});
