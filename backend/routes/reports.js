const express = require('express');
const router = express.Router();
const pool = require('../config/database');
const { requireAuth } = require('../middleware/auth');

// GET /api/reports/monthly
router.get('/monthly', requireAuth, async (req, res) => {
  try {
    const { month, account_id } = req.query;

    if (!month) {
      return res.status(400).json({ error: 'Monat erforderlich (Format: YYYY-MM)' });
    }

    // Parse month
    const [year, monthNum] = month.split('-');
    const startDate = `${year}-${monthNum}-01`;
    const endDate = new Date(year, monthNum, 0).toISOString().split('T')[0]; // Last day of month

    let query = `
      SELECT t.*, a.name as account_name
      FROM transactions t
      JOIN accounts a ON t.account_id = a.id
      WHERE t.date >= $1 AND t.date <= $2
    `;
    const params = [startDate, endDate];
    let paramCount = 2;

    // Filter by account access
    if (req.user.accounts && req.user.accounts.length > 0) {
      paramCount++;
      query += ` AND t.account_id = ANY($${paramCount})`;
      params.push(req.user.accounts);
    }

    // Filter by specific account
    if (account_id) {
      paramCount++;
      query += ` AND t.account_id = $${paramCount}`;
      params.push(account_id);
    }

    query += ' ORDER BY t.date ASC, t.created_at ASC';

    const result = await pool.query(query, params);

    // Calculate totals
    const totals = {
      income: 0,
      expenses: 0,
      balance: 0
    };

    result.rows.forEach(t => {
      const amount = parseFloat(t.amount);
      if (amount > 0) {
        totals.income += amount;
      } else {
        totals.expenses += Math.abs(amount);
      }
      totals.balance += amount;
    });

    res.json({
      month,
      transactions: result.rows,
      totals
    });
  } catch (error) {
    console.error('Error fetching monthly report:', error);
    res.status(500).json({ error: 'Fehler beim Laden des Monatsberichts' });
  }
});

// GET /api/reports/charts
router.get('/charts', requireAuth, async (req, res) => {
  try {
    const { month, account_id } = req.query;

    if (!month) {
      return res.status(400).json({ error: 'Monat erforderlich (Format: YYYY-MM)' });
    }

    // Parse month
    const [year, monthNum] = month.split('-');
    const startDate = `${year}-${monthNum}-01`;
    const endDate = new Date(year, monthNum, 0).toISOString().split('T')[0];

    let query = `
      SELECT category, SUM(ABS(amount)) as total
      FROM transactions
      WHERE date >= $1 AND date <= $2 AND amount < 0 AND category IS NOT NULL
    `;
    const params = [startDate, endDate];
    let paramCount = 2;

    // Filter by account access
    if (req.user.accounts && req.user.accounts.length > 0) {
      paramCount++;
      query += ` AND account_id = ANY($${paramCount})`;
      params.push(req.user.accounts);
    }

    // Filter by specific account
    if (account_id) {
      paramCount++;
      query += ` AND account_id = $${paramCount}`;
      params.push(account_id);
    }

    query += ' GROUP BY category ORDER BY total DESC';

    const result = await pool.query(query, params);

    // Get category colors
    const categories = await pool.query('SELECT key, label, color FROM categories');
    const categoryMap = {};
    categories.rows.forEach(c => {
      categoryMap[c.key] = { label: c.label, color: c.color };
    });

    // Prepare chart data
    const chartData = result.rows.map(row => ({
      category: row.category,
      label: categoryMap[row.category]?.label || row.category,
      color: categoryMap[row.category]?.color || '#9E9E9E',
      amount: parseFloat(row.total)
    }));

    res.json({
      month,
      data: chartData
    });
  } catch (error) {
    console.error('Error fetching chart data:', error);
    res.status(500).json({ error: 'Fehler beim Laden der Chart-Daten' });
  }
});

module.exports = router;
