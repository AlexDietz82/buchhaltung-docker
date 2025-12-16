const express = require('express');
const router = express.Router();
const pool = require('../config/database');
const { requireAuth } = require('../middleware/auth');
const { validateCategory, validateUUID, handleValidationErrors } = require('../middleware/validation');

// GET /api/categories
router.get('/', requireAuth, async (req, res) => {
  try {
    const result = await pool.query('SELECT * FROM categories ORDER BY label ASC');
    res.json(result.rows);
  } catch (error) {
    console.error('Error fetching categories:', error);
    res.status(500).json({ error: 'Fehler beim Laden der Kategorien' });
  }
});

// POST /api/categories
router.post('/',
  requireAuth,
  validateCategory(),
  handleValidationErrors,
  async (req, res) => {
    try {
      const { key, label, color, active } = req.body;

      // Check if key already exists
      const keyCheck = await pool.query('SELECT id FROM categories WHERE key = $1', [key]);

      if (keyCheck.rows.length > 0) {
        return res.status(400).json({ error: 'Kategorie-Key bereits vorhanden' });
      }

      const result = await pool.query(
        `INSERT INTO categories (key, label, color, active)
         VALUES ($1, $2, $3, $4)
         RETURNING *`,
        [key, label, color, active !== undefined ? active : true]
      );

      res.status(201).json(result.rows[0]);
    } catch (error) {
      console.error('Error creating category:', error);
      res.status(500).json({ error: 'Fehler beim Erstellen der Kategorie' });
    }
  }
);

// PUT /api/categories/:id
router.put('/:id',
  requireAuth,
  validateUUID('id'),
  validateCategory(),
  handleValidationErrors,
  async (req, res) => {
    try {
      const { id } = req.params;
      const { key, label, color, active } = req.body;

      // Check if key already exists for a different category
      const keyCheck = await pool.query(
        'SELECT id FROM categories WHERE key = $1 AND id != $2',
        [key, id]
      );

      if (keyCheck.rows.length > 0) {
        return res.status(400).json({ error: 'Kategorie-Key bereits vorhanden' });
      }

      const result = await pool.query(
        `UPDATE categories SET key = $1, label = $2, color = $3, active = $4
         WHERE id = $5
         RETURNING *`,
        [key, label, color, active !== undefined ? active : true, id]
      );

      if (result.rows.length === 0) {
        return res.status(404).json({ error: 'Kategorie nicht gefunden' });
      }

      res.json(result.rows[0]);
    } catch (error) {
      console.error('Error updating category:', error);
      res.status(500).json({ error: 'Fehler beim Aktualisieren der Kategorie' });
    }
  }
);

module.exports = router;
