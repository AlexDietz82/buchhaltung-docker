// server.js (superstabil für Unraid/Docker/Session-Auth, Final-Version)
const express = require('express');
const session = require('express-session');
const cors = require('cors');
const helmet = require('helmet');
const pool = require('./config/database');
const fs = require('fs').promises;
const path = require('path');
const { requireAuth } = require('./middleware/auth');
const { validateUUID, handleValidationErrors } = require('./middleware/validation');

const app = express();
const PORT = process.env.PORT || 8079;

// 1. PROXY-Einstellung für Docker/nginx!
app.set('trust proxy', 1);

// 2. CORS – unbedingt EXAKTE Browser-Adresse!
app.use(cors({
  origin: 'http://192.168.1.7:8082',
  credentials: true,
}));

// 3. Session – secure: false, sameSite: 'lax'
app.use(session({
  name: 'connect.sid',
  secret: process.env.SESSION_SECRET || 'changeme_very_long_random_session_secret_min_32_chars',
  resave: false,
  saveUninitialized: false,
  cookie: {
    httpOnly: true,
    secure: false,    // WICHTIG: Immer false,
    sameSite: 'lax',  // WICHTIG: Immer lax!
    maxAge: 24 * 60 * 60 * 1000
  }
}));


// ---- 4. SECURITY-/PARSER-Middleware ----
app.use(helmet({
  contentSecurityPolicy: false,
  crossOriginEmbedderPolicy: false
}));
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// ---- 5. DEBUG: Zeige Session-Objekt in jedem Request (ggf. auskommentieren im Produktivbetrieb) ----
app.use((req, res, next) => {
  console.log('[DEBUG SESSION]', req.session);
  next();
});

// ---- 6. ROUTES ----
app.use('/api/auth', require('./routes/auth'));
app.use('/api/transactions', require('./routes/transactions'));
app.use('/api/recurring', require('./routes/recurring'));
app.use('/api/regular-bookings', require('./routes/regular-bookings'));
app.use('/api/accounts', require('./routes/accounts'));
app.use('/api/users', require('./routes/users'));
app.use('/api/categories', require('./routes/categories'));
app.use('/api/reports', require('./routes/reports'));

// File download with auth
app.get('/api/files/:fileId',
  requireAuth,
  validateUUID('fileId'),
  handleValidationErrors,
  async (req, res) => {
    try {
      const { fileId } = req.params;
      const result = await pool.query('SELECT * FROM files WHERE id = $1', [fileId]);
      if (result.rows.length === 0) {
        return res.status(404).json({ error: 'Datei nicht gefunden' });
      }
      const file = result.rows[0];
      const filePath = path.join(process.env.UPLOAD_DIR || '/app/uploads', file.storage_key);
      res.download(filePath, file.filename_original);
    } catch (error) {
      console.error('Error downloading file:', error);
      res.status(500).json({ error: 'Fehler beim Herunterladen der Datei' });
    }
  }
);

// Health check endpoint
app.get('/health', (req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

// ---- 7. FEHLER-BEHANDLUNG ----
app.use((err, req, res, next) => {
  console.error('Error:', err);

  if (err.name === 'MulterError') {
    if (err.code === 'LIMIT_FILE_SIZE') {
      return res.status(400).json({ error: 'Datei zu groß (max. 10MB)' });
    }
    return res.status(400).json({ error: 'Fehler beim Datei-Upload' });
  }
  res.status(err.status || 500).json({
    error: err.message || 'Interner Serverfehler'
  });
});

// ---- 8. 404 HANDLER ----
app.use((req, res) => {
  res.status(404).json({ error: 'Endpoint nicht gefunden' });
});

// ---- 9. SERVER-START UND DB-CHECK ----
const startServer = async () => {
  try {
    await pool.query('SELECT NOW()');
    console.log('Database connection established');
    app.listen(PORT, '0.0.0.0', () => {
      console.log(`Server running on port ${PORT}`);
      console.log(`Environment: ${process.env.NODE_ENV || 'development'}`);
    });
  } catch (error) {
    console.error('Failed to start server:', error);
    process.exit(1);
  }
};

// ---- 10. GRACEFUL SHUTDOWN ----
process.on('SIGTERM', async () => {
  console.log('SIGTERM received, closing server...');
  await pool.end();
  process.exit(0);
});
process.on('SIGINT', async () => {
  console.log('SIGINT received, closing server...');
  await pool.end();
  process.exit(0);
});

startServer();
