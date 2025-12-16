const express = require('express');
const router = express.Router();
const pool = require('../config/database');
const { requireAuth, checkAccountAccess } = require('../middleware/auth');
const { validateRegularBooking, validateUUID, handleValidationErrors } = require('../middleware/validation');
const { calculateNormalizedMonthlyAmount } = require('../utils/helpers');

// GET /api/regular-bookings
router.get('/', requireAuth, async (req, res) => {
  try {
    const { account_id } = req.query;
    
    let query = `
      SELECT rb.*, a.name as account_name 
      FROM regular_bookings rb
      JOIN accounts a ON rb.account_id = a.id
      WHERE 1=1
    `;
    const params = [];
    let paramCount = 0;

    // Filter by account access
    if (req.user.accounts && req.user.accounts.length > 0) {
      paramCount++;
      query += ` AND rb.account_id = ANY($${paramCount})`;
      params.push(req.user.accounts);
    }

    // Filter by specific account
    if (account_id) {
      paramCount++;
      query += ` AND rb.account_id = $${paramCount}`;
      params.push(account_id);
    }

    query += ' ORDER BY rb.start_date DESC, rb.created_at DESC';

    const result = await pool.query(query, params);
    res.json(result.rows);
  } catch (error) {
    console.error('Error fetching regular bookings:', error);
    res.status(500).json({ error: 'Fehler beim Laden der regulären Buchungen' });
  }
});

// POST /api/regular-bookings
router.post('/',
  requireAuth,
  validateRegularBooking(),
  handleValidationErrors,
  checkAccountAccess,
  async (req, res) => {
    try {
      const {
        account_id,
        description,
        art,
        start_date,
        end_date,
        booking_date,
        interval,
        amount,
        category,
        booked_on_giro,
        extra_data
      } = req.body;

      // Validate end_date >= start_date
      if (end_date && new Date(end_date) < new Date(start_date)) {
        return res.status(400).json({ error: 'Enddatum muss nach Startdatum liegen' });
      }

      // Calculate normalized monthly amount
      const normalizedMonthlyAmount = calculateNormalizedMonthlyAmount(amount, interval);

      const result = await pool.query(
        `INSERT INTO regular_bookings (
          account_id, description, art, start_date, end_date, booking_date,
          interval, amount, category, normalized_monthly_amount, booked_on_giro, extra_data
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12)
        RETURNING *`,
        [
          account_id,
          description,
          art,
          start_date,
          end_date || null,
          booking_date || null,
          interval,
          amount,
          category || null,
          normalizedMonthlyAmount,
          booked_on_giro !== undefined ? booked_on_giro : false,
          extra_data ? JSON.stringify(extra_data) : null
        ]
      );

      res.status(201).json(result.rows[0]);
    } catch (error) {
      console.error('Error creating regular booking:', error);
      res.status(500).json({ error: 'Fehler beim Erstellen der regulären Buchung' });
    }
  }
);

// PUT /api/regular-bookings/:id
router.put('/:id',
  requireAuth,
  validateUUID('id'),
  validateRegularBooking(),
  handleValidationErrors,
  checkAccountAccess,
  async (req, res) => {
    try {
      const { id } = req.params;
      const {
        account_id,
        description,
        art,
        start_date,
        end_date,
        booking_date,
        interval,
        amount,
        category,
        booked_on_giro,
        extra_data
      } = req.body;

      // Validate end_date >= start_date
      if (end_date && new Date(end_date) < new Date(start_date)) {
        return res.status(400).json({ error: 'Enddatum muss nach Startdatum liegen' });
      }

      // Calculate normalized monthly amount
      const normalizedMonthlyAmount = calculateNormalizedMonthlyAmount(amount, interval);

      const result = await pool.query(
        `UPDATE regular_bookings SET
          account_id = $1, description = $2, art = $3, start_date = $4, end_date = $5,
          booking_date = $6, interval = $7, amount = $8, category = $9,
          normalized_monthly_amount = $10, booked_on_giro = $11, extra_data = $12
        WHERE id = $13
        RETURNING *`,
        [
          account_id,
          description,
          art,
          start_date,
          end_date || null,
          booking_date || null,
          interval,
          amount,
          category || null,
          normalizedMonthlyAmount,
          booked_on_giro !== undefined ? booked_on_giro : false,
          extra_data ? JSON.stringify(extra_data) : null,
          id
        ]
      );

      if (result.rows.length === 0) {
        return res.status(404).json({ error: 'Reguläre Buchung nicht gefunden' });
      }

      res.json(result.rows[0]);
    } catch (error) {
      console.error('Error updating regular booking:', error);
      res.status(500).json({ error: 'Fehler beim Aktualisieren der regulären Buchung' });
    }
  }
);

// DELETE /api/regular-bookings/:id
router.delete('/:id',
  requireAuth,
  validateUUID('id'),
  handleValidationErrors,
  async (req, res) => {
    try {
      const { id } = req.params;

      const result = await pool.query('DELETE FROM regular_bookings WHERE id = $1 RETURNING id', [id]);

      if (result.rows.length === 0) {
        return res.status(404).json({ error: 'Reguläre Buchung nicht gefunden' });
      }

      res.json({ message: 'Reguläre Buchung gelöscht' });
    } catch (error) {
      console.error('Error deleting regular booking:', error);
      res.status(500).json({ error: 'Fehler beim Löschen der regulären Buchung' });
    }
  }
);

module.exports = router;
