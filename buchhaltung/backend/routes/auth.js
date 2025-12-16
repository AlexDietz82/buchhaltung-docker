const express = require('express');
const router = express.Router();
const bcrypt = require('bcrypt');
const pool = require('../config/database');
const { validateUsername, validatePassword, handleValidationErrors } = require('../middleware/validation');
const rateLimit = require('express-rate-limit');

const BCRYPT_ROUNDS = parseInt(process.env.BCRYPT_ROUNDS) || 12;

// Rate limiter for auth endpoints
const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 5, // 5 requests per window
  message: 'Zu viele Versuche, bitte später erneut versuchen'
});

// GET /api/auth/admin-exists
router.get('/admin-exists', async (req, res) => {
  try {
    const result = await pool.query(
      'SELECT COUNT(*) as count FROM users WHERE role = $1 AND active = true',
      ['ADMIN']
    );
    const adminExists = parseInt(result.rows[0].count) > 0;
    res.json({ adminExists });
  } catch (error) {
    console.error('Error checking admin existence:', error);
    res.status(500).json({ error: 'Serverfehler' });
  }
});

// GET /api/auth/setup
router.get('/setup', async (req, res) => {
  try {
    const result = await pool.query(
      'SELECT COUNT(*) as count FROM users WHERE role = $1 AND active = true',
      ['ADMIN']
    );
    const adminExists = parseInt(result.rows[0].count) > 0;
    
    if (adminExists) {
      return res.status(410).json({ error: 'Setup bereits abgeschlossen' });
    }
    
    res.json({ message: 'Setup verfügbar' });
  } catch (error) {
    console.error('Error checking setup status:', error);
    res.status(500).json({ error: 'Serverfehler' });
  }
});

// POST /api/auth/setup
router.post('/setup', 
  authLimiter,
  validateUsername(),
  validatePassword(),
  handleValidationErrors,
  async (req, res) => {
    try {
      const { username, password, password_confirm } = req.body;

      // Check if admin already exists
      const adminCheck = await pool.query(
        'SELECT COUNT(*) as count FROM users WHERE role = $1 AND active = true',
        ['ADMIN']
      );
      const adminExists = parseInt(adminCheck.rows[0].count) > 0;
      
      if (adminExists) {
        return res.status(410).json({ error: 'Setup bereits abgeschlossen' });
      }

      // Validate password confirmation
      if (password !== password_confirm) {
        return res.status(400).json({ error: 'Passwörter stimmen nicht überein' });
      }

      // Check if username already exists (case-insensitive)
      const userCheck = await pool.query(
        'SELECT id FROM users WHERE LOWER(username) = LOWER($1)',
        [username]
      );

      if (userCheck.rows.length > 0) {
        return res.status(400).json({ error: 'Benutzername bereits vergeben' });
      }

      // Hash password
      const passwordHash = await bcrypt.hash(password, BCRYPT_ROUNDS);

      // Create admin user
      const result = await pool.query(
        `INSERT INTO users (username, password_hash, role, pages, accounts, active) 
         VALUES ($1, $2, $3, $4, $5, true) 
         RETURNING id, username, role, pages, accounts, active`,
        [
          username,
          passwordHash,
          'ADMIN',
          JSON.stringify(['dashboard', 'transactions', 'recurring', 'paypal', 'paypalneu', 'reports', 'charts', 'admin', 'categories']),
          JSON.stringify([])
        ]
      );

      const user = result.rows[0];

      // Create session
      req.session.userId = user.id;
      req.session.username = user.username;
      req.session.role = user.role;

      res.status(201).json({
        message: 'Admin erfolgreich erstellt',
        user: {
          id: user.id,
          username: user.username,
          role: user.role,
          pages: user.pages,
          accounts: user.accounts
        }
      });
    } catch (error) {
      console.error('Error during setup:', error);
      res.status(500).json({ error: 'Serverfehler beim Setup' });
    }
  }
);

// POST /api/auth/login
router.post('/login',
  authLimiter,
  validateUsername(),
  validatePassword(),
  handleValidationErrors,
  async (req, res) => {
    try {
      const { username, password } = req.body;

      // Find user (case-insensitive)
      const result = await pool.query(
        'SELECT id, username, password_hash, role, pages, accounts, active FROM users WHERE LOWER(username) = LOWER($1)',
        [username]
      );

      if (result.rows.length === 0) {
        return res.status(401).json({ error: 'Ungültige Anmeldedaten' });
      }

      const user = result.rows[0];

      // Check if user is active
      if (!user.active) {
        return res.status(401).json({ error: 'Benutzer ist inaktiv' });
      }

      // Verify password
      const isValid = await bcrypt.compare(password, user.password_hash);

      if (!isValid) {
        return res.status(401).json({ error: 'Ungültige Anmeldedaten' });
      }

      // Create session
      req.session.userId = user.id;
      req.session.username = user.username;
      req.session.role = user.role;

      res.json({
        message: 'Login erfolgreich',
        user: {
          id: user.id,
          username: user.username,
          role: user.role,
          pages: user.pages,
          accounts: user.accounts
        }
      });
    } catch (error) {
      console.error('Error during login:', error);
      res.status(500).json({ error: 'Serverfehler beim Login' });
    }
  }
);

// POST /api/auth/logout
router.post('/logout', (req, res) => {
  req.session.destroy((err) => {
    if (err) {
      console.error('Error destroying session:', err);
      return res.status(500).json({ error: 'Fehler beim Logout' });
    }
    res.json({ message: 'Logout erfolgreich' });
  });
});

module.exports = router;
