const express = require('express');
const router = express.Router();
const bcrypt = require('bcrypt');
const pool = require('../config/database');
const { requireAuth, requireAdmin } = require('../middleware/auth');
const { validateUser, validateUUID, handleValidationErrors } = require('../middleware/validation');

const BCRYPT_ROUNDS = parseInt(process.env.BCRYPT_ROUNDS) || 12;

// GET /api/users
router.get('/', requireAuth, requireAdmin, async (req, res) => {
  try {
    const result = await pool.query(
      'SELECT id, username, role, pages, accounts, active, created_at, updated_at FROM users ORDER BY username ASC'
    );
    res.json(result.rows);
  } catch (error) {
    console.error('Error fetching users:', error);
    res.status(500).json({ error: 'Fehler beim Laden der Benutzer' });
  }
});

// POST /api/users
router.post('/',
  requireAuth,
  requireAdmin,
  validateUser(),
  handleValidationErrors,
  async (req, res) => {
    try {
      const { username, password, role, pages, accounts, active } = req.body;

      if (!password) {
        return res.status(400).json({ error: 'Passwort erforderlich' });
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

      const result = await pool.query(
        `INSERT INTO users (username, password_hash, role, pages, accounts, active)
         VALUES ($1, $2, $3, $4, $5, $6)
         RETURNING id, username, role, pages, accounts, active, created_at, updated_at`,
        [
          username,
          passwordHash,
          role,
          JSON.stringify(pages),
          JSON.stringify(accounts || []),
          active !== undefined ? active : true
        ]
      );

      res.status(201).json(result.rows[0]);
    } catch (error) {
      console.error('Error creating user:', error);
      res.status(500).json({ error: 'Fehler beim Erstellen des Benutzers' });
    }
  }
);

// PUT /api/users/:id
router.put('/:id',
  requireAuth,
  requireAdmin,
  validateUUID('id'),
  validateUser(),
  handleValidationErrors,
  async (req, res) => {
    try {
      const { id } = req.params;
      const { username, password, role, pages, accounts, active } = req.body;

      // Check if username already exists for a different user (case-insensitive)
      const userCheck = await pool.query(
        'SELECT id FROM users WHERE LOWER(username) = LOWER($1) AND id != $2',
        [username, id]
      );

      if (userCheck.rows.length > 0) {
        return res.status(400).json({ error: 'Benutzername bereits vergeben' });
      }

      let query, params;

      if (password) {
        // Update with new password
        const passwordHash = await bcrypt.hash(password, BCRYPT_ROUNDS);
        query = `UPDATE users SET username = $1, password_hash = $2, role = $3, pages = $4, accounts = $5, active = $6
                 WHERE id = $7
                 RETURNING id, username, role, pages, accounts, active, created_at, updated_at`;
        params = [username, passwordHash, role, JSON.stringify(pages), JSON.stringify(accounts || []), active !== undefined ? active : true, id];
      } else {
        // Update without changing password
        query = `UPDATE users SET username = $1, role = $2, pages = $3, accounts = $4, active = $5
                 WHERE id = $6
                 RETURNING id, username, role, pages, accounts, active, created_at, updated_at`;
        params = [username, role, JSON.stringify(pages), JSON.stringify(accounts || []), active !== undefined ? active : true, id];
      }

      const result = await pool.query(query, params);

      if (result.rows.length === 0) {
        return res.status(404).json({ error: 'Benutzer nicht gefunden' });
      }

      res.json(result.rows[0]);
    } catch (error) {
      console.error('Error updating user:', error);
      res.status(500).json({ error: 'Fehler beim Aktualisieren des Benutzers' });
    }
  }
);

// DELETE /api/users/:id
router.delete('/:id',
  requireAuth,
  requireAdmin,
  validateUUID('id'),
  handleValidationErrors,
  async (req, res) => {
    try {
      const { id } = req.params;

      // Prevent deleting yourself
      if (id === req.user.id) {
        return res.status(400).json({ error: 'Sie können sich nicht selbst löschen' });
      }

      // Check if user exists and is admin
      const userCheck = await pool.query('SELECT role FROM users WHERE id = $1', [id]);
      
      if (userCheck.rows.length === 0) {
        return res.status(404).json({ error: 'Benutzer nicht gefunden' });
      }

      // If deleting an admin, ensure at least one admin remains
      if (userCheck.rows[0].role === 'ADMIN') {
        const adminCount = await pool.query(
          'SELECT COUNT(*) as count FROM users WHERE role = $1 AND active = true',
          ['ADMIN']
        );

        if (parseInt(adminCount.rows[0].count) <= 1) {
          return res.status(400).json({ 
            error: 'Mindestens ein aktiver Administrator muss vorhanden sein' 
          });
        }
      }

      await pool.query('DELETE FROM users WHERE id = $1', [id]);

      res.json({ message: 'Benutzer gelöscht' });
    } catch (error) {
      console.error('Error deleting user:', error);
      res.status(500).json({ error: 'Fehler beim Löschen des Benutzers' });
    }
  }
);

module.exports = router;
