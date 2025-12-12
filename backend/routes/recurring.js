const express = require('express');
const router = express.Router();
const pool = require('../config/database');
const { requireAuth, checkAccountAccess } = require('../middleware/auth');
const { validateRecurring, validateUUID, handleValidationErrors } = require('../middleware/validation');

// GET /api/recurring
router.get('/', requireAuth, async (req, res) => {
  try {
    const { account_id } = req.query;
    
    let query = `
      SELECT r.*, a.name as account_name 
      FROM recurring r
      JOIN accounts a ON r.account_id = a.id
      WHERE 1=1
    `;
    const params = [];
    let paramCount = 0;

    // Filter by account access
    if (req.user.accounts && req.user.accounts.length > 0) {
      paramCount++;
      query += ` AND r.account_id = ANY($${paramCount})`;
      params.push(req.user.accounts);
    }

    // Filter by specific account
    if (account_id) {
      paramCount++;
      query += ` AND r.account_id = $${paramCount}`;
      params.push(account_id);
    }

    query += ' ORDER BY r.start_date DESC, r.created_at DESC';

    const result = await pool.query(query, params);
    res.json(result.rows);
  } catch (error) {
    console.error('Error fetching recurring:', error);
    res.status(500).json({ error: 'Fehler beim Laden der wiederkehrenden Buchungen' });
  }
});

// POST /api/recurring
router.post('/',
  requireAuth,
  validateRecurring(),
  handleValidationErrors,
  checkAccountAccess,
  async (req, res) => {
    try {
      const {
        account_id,
        description,
        interval,
        interval_count,
        start_date,
        end_date,
        day_of_month,
        occurrence_amount,
        total_remaining,
        last_installment,
        remaining_installments,
        note,
        category,
        payment_method,
        recurring,
        art,
        booked_on_giro,
        extra_data
      } = req.body;

      // Validate end_date >= start_date
      if (end_date && new Date(end_date) < new Date(start_date)) {
        return res.status(400).json({ error: 'Enddatum muss nach Startdatum liegen' });
      }

      const result = await pool.query(
        `INSERT INTO recurring (
          account_id, description, interval, interval_count, start_date, end_date,
          day_of_month, occurrence_amount, total_remaining, last_installment,
          remaining_installments, note, category, payment_method, recurring, art,
          booked_on_giro, extra_data
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17, $18)
        RETURNING *`,
        [
          account_id,
          description,
          interval,
          interval_count || 1,
          start_date,
          end_date || null,
          day_of_month || null,
          occurrence_amount,
          total_remaining || null,
          last_installment || null,
          remaining_installments || null,
          note || null,
          category || null,
          payment_method,
          recurring !== undefined ? recurring : true,
          art,
          booked_on_giro !== undefined ? booked_on_giro : false,
          extra_data ? JSON.stringify(extra_data) : null
        ]
      );

      res.status(201).json(result.rows[0]);
    } catch (error) {
      console.error('Error creating recurring:', error);
      res.status(500).json({ error: 'Fehler beim Erstellen der wiederkehrenden Buchung' });
    }
  }
);

// PUT /api/recurring/:id
router.put('/:id',
  requireAuth,
  validateUUID('id'),
  validateRecurring(),
  handleValidationErrors,
  checkAccountAccess,
  async (req, res) => {
    try {
      const { id } = req.params;
      const {
        account_id,
        description,
        interval,
        interval_count,
        start_date,
        end_date,
        day_of_month,
        occurrence_amount,
        total_remaining,
        last_installment,
        remaining_installments,
        note,
        category,
        payment_method,
        recurring,
        art,
        booked_on_giro,
        extra_data
      } = req.body;

      // Validate end_date >= start_date
      if (end_date && new Date(end_date) < new Date(start_date)) {
        return res.status(400).json({ error: 'Enddatum muss nach Startdatum liegen' });
      }

      const result = await pool.query(
        `UPDATE recurring SET
          account_id = $1, description = $2, interval = $3, interval_count = $4,
          start_date = $5, end_date = $6, day_of_month = $7, occurrence_amount = $8,
          total_remaining = $9, last_installment = $10, remaining_installments = $11,
          note = $12, category = $13, payment_method = $14, recurring = $15, art = $16,
          booked_on_giro = $17, extra_data = $18
        WHERE id = $19
        RETURNING *`,
        [
          account_id,
          description,
          interval,
          interval_count || 1,
          start_date,
          end_date || null,
          day_of_month || null,
          occurrence_amount,
          total_remaining || null,
          last_installment || null,
          remaining_installments || null,
          note || null,
          category || null,
          payment_method,
          recurring !== undefined ? recurring : true,
          art,
          booked_on_giro !== undefined ? booked_on_giro : false,
          extra_data ? JSON.stringify(extra_data) : null,
          id
        ]
      );

      if (result.rows.length === 0) {
        return res.status(404).json({ error: 'Wiederkehrende Buchung nicht gefunden' });
      }

      res.json(result.rows[0]);
    } catch (error) {
      console.error('Error updating recurring:', error);
      res.status(500).json({ error: 'Fehler beim Aktualisieren der wiederkehrenden Buchung' });
    }
  }
);

// DELETE /api/recurring/:id
router.delete('/:id',
  requireAuth,
  validateUUID('id'),
  handleValidationErrors,
  async (req, res) => {
    try {
      const { id } = req.params;

      const result = await pool.query('DELETE FROM recurring WHERE id = $1 RETURNING id', [id]);

      if (result.rows.length === 0) {
        return res.status(404).json({ error: 'Wiederkehrende Buchung nicht gefunden' });
      }

      res.json({ message: 'Wiederkehrende Buchung gelöscht' });
    } catch (error) {
      console.error('Error deleting recurring:', error);
      res.status(500).json({ error: 'Fehler beim Löschen der wiederkehrenden Buchung' });
    }
  }
);

module.exports = router;
