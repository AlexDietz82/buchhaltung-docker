const express = require('express');
const router = express.Router();
const pool = require('../config/database');
const { requireAuth } = require('../middleware/auth');
const { validateAccount, validateUUID, handleValidationErrors } = require('../middleware/validation');

// GET /api/accounts
router.get('/', requireAuth, async (req, res) => {
  try {
    let query = 'SELECT * FROM accounts WHERE 1=1';
    const params = [];

    // Filter by account access
    if (req.user.accounts && req.user.accounts.length > 0) {
      query += ' AND id = ANY($1)';
      params.push(req.user.accounts);
    }

    query += ' ORDER BY name ASC';

    const result = await pool.query(query, params);
    res.json(result.rows);
  } catch (error) {
    console.error('Error fetching accounts:', error);
    res.status(500).json({ error: 'Fehler beim Laden der Konten' });
  }
});

// POST /api/accounts
router.post('/',
  requireAuth,
  validateAccount(),
  handleValidationErrors,
  async (req, res) => {
    try {
      const { name, opening_balance, currency } = req.body;

      const result = await pool.query(
        `INSERT INTO accounts (name, opening_balance, current_balance, currency)
         VALUES ($1, $2, $3, $4)
         RETURNING *`,
        [name, opening_balance, opening_balance, currency || 'EUR']
      );

      res.status(201).json(result.rows[0]);
    } catch (error) {
      console.error('Error creating account:', error);
      res.status(500).json({ error: 'Fehler beim Erstellen des Kontos' });
    }
  }
);

// PUT /api/accounts/:id
router.put('/:id',
  requireAuth,
  validateUUID('id'),
  validateAccount(),
  handleValidationErrors,
  async (req, res) => {
    try {
      const { id } = req.params;
      const { name, opening_balance, currency } = req.body;

      // Get current account
      const currentResult = await pool.query('SELECT * FROM accounts WHERE id = $1', [id]);
      
      if (currentResult.rows.length === 0) {
        return res.status(404).json({ error: 'Konto nicht gefunden' });
      }

      const currentAccount = currentResult.rows[0];
      
      // Calculate new current_balance if opening_balance changed
      let newCurrentBalance = currentAccount.current_balance;
      if (opening_balance !== currentAccount.opening_balance) {
        const difference = parseFloat(opening_balance) - parseFloat(currentAccount.opening_balance);
        newCurrentBalance = parseFloat(currentAccount.current_balance) + difference;
      }

      const result = await pool.query(
        `UPDATE accounts SET name = $1, opening_balance = $2, current_balance = $3, currency = $4
         WHERE id = $5
         RETURNING *`,
        [name, opening_balance, newCurrentBalance, currency || 'EUR', id]
      );

      res.json(result.rows[0]);
    } catch (error) {
      console.error('Error updating account:', error);
      res.status(500).json({ error: 'Fehler beim Aktualisieren des Kontos' });
    }
  }
);

// DELETE /api/accounts/:id
router.delete('/:id',
  requireAuth,
  validateUUID('id'),
  handleValidationErrors,
  async (req, res) => {
    try {
      const { id } = req.params;

      // Check if account has transactions
      const transactionsCheck = await pool.query(
        'SELECT COUNT(*) as count FROM transactions WHERE account_id = $1',
        [id]
      );

      if (parseInt(transactionsCheck.rows[0].count) > 0) {
        return res.status(400).json({ 
          error: 'Konto kann nicht gelöscht werden, da Buchungen vorhanden sind' 
        });
      }

      // Check if account has recurring bookings
      const recurringCheck = await pool.query(
        'SELECT COUNT(*) as count FROM recurring WHERE account_id = $1',
        [id]
      );

      if (parseInt(recurringCheck.rows[0].count) > 0) {
        return res.status(400).json({ 
          error: 'Konto kann nicht gelöscht werden, da wiederkehrende Buchungen vorhanden sind' 
        });
      }

      // Check if account has regular bookings
      const regularCheck = await pool.query(
        'SELECT COUNT(*) as count FROM regular_bookings WHERE account_id = $1',
        [id]
      );

      if (parseInt(regularCheck.rows[0].count) > 0) {
        return res.status(400).json({ 
          error: 'Konto kann nicht gelöscht werden, da reguläre Buchungen vorhanden sind' 
        });
      }

      const result = await pool.query('DELETE FROM accounts WHERE id = $1 RETURNING id', [id]);

      if (result.rows.length === 0) {
        return res.status(404).json({ error: 'Konto nicht gefunden' });
      }

      res.json({ message: 'Konto gelöscht' });
    } catch (error) {
      console.error('Error deleting account:', error);
      res.status(500).json({ error: 'Fehler beim Löschen des Kontos' });
    }
  }
);

module.exports = router;
