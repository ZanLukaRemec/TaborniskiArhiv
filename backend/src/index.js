require('dotenv').config();

const cors = require('cors');
const express = require('express');
const path = require('path');
const session = require('express-session');
const archiveRoutes = require('./routes/archive');
const auditRoutes = require('./routes/audit');
const authRoutes = require('./routes/auth');
const templateRoutes = require('./routes/templates');
const userRoutes = require('./routes/users');
const pool = require('./db');

const app = express();
const port = Number(process.env.PORT) || 3001;
const sessionSecret = process.env.SESSION_SECRET;

if (!sessionSecret) {
  throw new Error('Manjka okoljska spremenljivka SESSION_SECRET.');
}

app.use(cors({
  origin: process.env.CORS_ORIGIN || 'http://localhost:5173',
  credentials: true,
}));
app.use(express.json());
app.use(session({
  name: 'taborniski.sid',
  secret: sessionSecret,
  resave: false,
  saveUninitialized: false,
  cookie: {
    httpOnly: true,
    sameSite: 'lax',
    maxAge: 8 * 60 * 60 * 1000,
  },
}));

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

app.use('/api', authRoutes);
app.use('/api', userRoutes);
app.use('/api', templateRoutes);
app.use('/api', auditRoutes);
app.use('/api', archiveRoutes);

app.use('/api', (req, res) => {
  res.status(404).json({ error: 'Endpoint ne obstaja.' });
});

if (process.env.NODE_ENV === 'production') {
  const frontendDirectory = path.join(__dirname, '../../frontend/dist');

  app.use(express.static(frontendDirectory));
  app.use((req, res, next) => {
    if (req.method !== 'GET' || !req.accepts('html')) {
      next();
      return;
    }

    res.sendFile(path.join(frontendDirectory, 'index.html'));
  });
}

app.listen(port, () => {
  console.log(`API posluša na http://localhost:${port}`);
});
