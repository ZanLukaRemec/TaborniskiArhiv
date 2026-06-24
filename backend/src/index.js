require('dotenv').config();

const cors = require('cors');
const express = require('express');
const archiveRoutes = require('./routes/archive');
const pool = require('./db');

const app = express();
const port = Number(process.env.PORT) || 3001;

app.use(cors({
  origin: process.env.CORS_ORIGIN || 'http://localhost:5173',
  credentials: true,
}));
app.use(express.json());

app.get('/api/health', (req, res) => {
  res.json({
    status: 'ok',
    service: 'taborniški-arhiv-api',
  });
});

app.get('/api/db-health', async (req, res) => {
  try {
    await pool.query('SELECT 1');
    res.json({ status: 'ok' });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Povezava z bazo ni uspela.' });
  }
});

app.use('/api', archiveRoutes);

app.use('/api', (req, res) => {
  res.status(404).json({ error: 'Endpoint ne obstaja.' });
});

app.listen(port, () => {
  console.log(`API posluša na http://localhost:${port}`);
});
