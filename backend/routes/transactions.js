const express = require('express');
const router = express.Router();
const pool = require('../config/database');
const { requireAuth, checkAccountAccess } = require('../middleware/auth');
const { validateTransaction, validateUUID, handleValidationErrors } = require('../middleware/validation');
const upload = require('../middleware/upload');
const fs = require('fs').promises;
const path = require('path');

// GET /api/transactions
router.get('/', requireAuth, async (req, res) => {
  try {
    const { account_id, from, to } = req.query;
    
    let query = `
      SELECT t.*, a.name as account_name 
      FROM transactions t
      JOIN accounts a ON t.account_id = a.id
      WHERE 1=1
    `;
    const params = [];
    let paramCount = 0;

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

    // Filter by date range
    if (from) {
      paramCount++;
      query += ` AND t.date >= $${paramCount}`;
      params.push(from);
    }

    if (to) {
      paramCount++;
      query += ` AND t.date <= $${paramCount}`;
      params.push(to);
    }

    query += ' ORDER BY t.date DESC, t.created_at DESC';

    const result = await pool.query(query, params);

    // Get files for each transaction
    const transactionIds = result.rows.map(t => t.id);
    let files = [];
    
    if (transactionIds.length > 0) {
      const filesResult = await pool.query(
        'SELECT * FROM files WHERE owner_type = $1 AND owner_id = ANY($2)',
        ['transaction', transactionIds]
      );
      files = filesResult.rows;
    }

    // Attach files to transactions
    const transactions = result.rows.map(t => ({
      ...t,
      files: files.filter(f => f.owner_id === t.id)
    }));

    res.json(transactions);
  } catch (error) {
    console.error('Error fetching transactions:', error);
    res.status(500).json({ error: 'Fehler beim Laden der Transaktionen' });
  }
});

// POST /api/transactions
router.post('/',
  requireAuth,
  validateTransaction(),
  handleValidationErrors,
  checkAccountAccess,
  async (req, res) => {
    try {
      const {
        account_id,
        description,
        amount,
        payment_method,
        date,
        type,
        note,
        category,
        art,
        booked_on_giro,
        extra_data
      } = req.body;

      const result = await pool.query(
        `INSERT INTO transactions (
          account_id, description, amount, payment_method, date, type, note, 
          category, art, booked_on_giro, extra_data
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)
        RETURNING *`,
        [
          account_id,
          description,
          amount,
          payment_method,
          date,
          type || null,
          note || null,
          category || null,
          art,
          booked_on_giro !== undefined ? booked_on_giro : false,
          extra_data ? JSON.stringify(extra_data) : null
        ]
      );

      // Update account balance
      await pool.query(
        'UPDATE accounts SET current_balance = current_balance + $1 WHERE id = $2',
        [amount, account_id]
      );

      res.status(201).json(result.rows[0]);
    } catch (error) {
      console.error('Error creating transaction:', error);
      res.status(500).json({ error: 'Fehler beim Erstellen der Transaktion' });
    }
  }
);

// PUT /api/transactions/:id
router.put('/:id',
  requireAuth,
  validateUUID('id'),
  validateTransaction(),
  handleValidationErrors,
  checkAccountAccess,
  async (req, res) => {
    try {
      const { id } = req.params;
      const {
        account_id,
        description,
        amount,
        payment_method,
        date,
        type,
        note,
        category,
        art,
        booked_on_giro,
        extra_data
      } = req.body;

      // Get old transaction to calculate balance difference
      const oldResult = await pool.query('SELECT * FROM transactions WHERE id = $1', [id]);
      
      if (oldResult.rows.length === 0) {
        return res.status(404).json({ error: 'Transaktion nicht gefunden' });
      }

      const oldTransaction = oldResult.rows[0];

      // Update transaction
      const result = await pool.query(
        `UPDATE transactions SET
          account_id = $1, description = $2, amount = $3, payment_method = $4,
          date = $5, type = $6, note = $7, category = $8, art = $9,
          booked_on_giro = $10, extra_data = $11
        WHERE id = $12
        RETURNING *`,
        [
          account_id,
          description,
          amount,
          payment_method,
          date,
          type || null,
          note || null,
          category || null,
          art,
          booked_on_giro !== undefined ? booked_on_giro : false,
          extra_data ? JSON.stringify(extra_data) : null,
          id
        ]
      );

      // Update account balances
      if (oldTransaction.account_id === account_id) {
        // Same account, just update the difference
        const difference = parseFloat(amount) - parseFloat(oldTransaction.amount);
        await pool.query(
          'UPDATE accounts SET current_balance = current_balance + $1 WHERE id = $2',
          [difference, account_id]
        );
      } else {
        // Different accounts, reverse old and apply new
        await pool.query(
          'UPDATE accounts SET current_balance = current_balance - $1 WHERE id = $2',
          [oldTransaction.amount, oldTransaction.account_id]
        );
        await pool.query(
          'UPDATE accounts SET current_balance = current_balance + $1 WHERE id = $2',
          [amount, account_id]
        );
      }

      res.json(result.rows[0]);
    } catch (error) {
      console.error('Error updating transaction:', error);
      res.status(500).json({ error: 'Fehler beim Aktualisieren der Transaktion' });
    }
  }
);

// DELETE /api/transactions/:id
router.delete('/:id',
  requireAuth,
  validateUUID('id'),
  handleValidationErrors,
  async (req, res) => {
    try {
      const { id } = req.params;

      // Get transaction to reverse balance
      const result = await pool.query('SELECT * FROM transactions WHERE id = $1', [id]);
      
      if (result.rows.length === 0) {
        return res.status(404).json({ error: 'Transaktion nicht gefunden' });
      }

      const transaction = result.rows[0];

      // Delete associated files
      const filesResult = await pool.query(
        'SELECT * FROM files WHERE owner_type = $1 AND owner_id = $2',
        ['transaction', id]
      );

      for (const file of filesResult.rows) {
        try {
          await fs.unlink(path.join(process.env.UPLOAD_DIR || '/app/uploads', file.storage_key));
        } catch (err) {
          console.error('Error deleting file:', err);
        }
      }

      await pool.query('DELETE FROM files WHERE owner_type = $1 AND owner_id = $2', ['transaction', id]);

      // Delete transaction
      await pool.query('DELETE FROM transactions WHERE id = $1', [id]);

      // Update account balance
      await pool.query(
        'UPDATE accounts SET current_balance = current_balance - $1 WHERE id = $2',
        [transaction.amount, transaction.account_id]
      );

      res.json({ message: 'Transaktion gelöscht' });
    } catch (error) {
      console.error('Error deleting transaction:', error);
      res.status(500).json({ error: 'Fehler beim Löschen der Transaktion' });
    }
  }
);

// POST /api/transactions/:id/files
router.post('/:id/files',
  requireAuth,
  validateUUID('id'),
  handleValidationErrors,
  upload.single('file'),
  async (req, res) => {
    try {
      const { id } = req.params;
      const { kind } = req.body;

      if (!req.file) {
        return res.status(400).json({ error: 'Keine Datei hochgeladen' });
      }

      // Verify transaction exists
      const transactionResult = await pool.query(
        'SELECT id FROM transactions WHERE id = $1',
        [id]
      );

      if (transactionResult.rows.length === 0) {
        // Delete uploaded file
        await fs.unlink(req.file.path);
        return res.status(404).json({ error: 'Transaktion nicht gefunden' });
      }

      // Save file metadata
      const result = await pool.query(
        `INSERT INTO files (owner_type, owner_id, kind, mime, size, filename_original, storage_key)
         VALUES ($1, $2, $3, $4, $5, $6, $7)
         RETURNING *`,
        [
          'transaction',
          id,
          kind || 'receipt',
          req.file.mimetype,
          req.file.size,
          req.file.originalname,
          req.file.filename
        ]
      );

      res.status(201).json(result.rows[0]);
    } catch (error) {
      console.error('Error uploading file:', error);
      if (req.file) {
        await fs.unlink(req.file.path).catch(() => {});
      }
      res.status(500).json({ error: 'Fehler beim Hochladen der Datei' });
    }
  }
);

// DELETE /api/transactions/:id/files/:fileId
router.delete('/:id/files/:fileId',
  requireAuth,
  validateUUID('id'),
  validateUUID('fileId'),
  handleValidationErrors,
  async (req, res) => {
    try {
      const { id, fileId } = req.params;

      // Get file
      const result = await pool.query(
        'SELECT * FROM files WHERE id = $1 AND owner_type = $2 AND owner_id = $3',
        [fileId, 'transaction', id]
      );

      if (result.rows.length === 0) {
        return res.status(404).json({ error: 'Datei nicht gefunden' });
      }

      const file = result.rows[0];

      // Delete physical file
      try {
        await fs.unlink(path.join(process.env.UPLOAD_DIR || '/app/uploads', file.storage_key));
      } catch (err) {
        console.error('Error deleting physical file:', err);
      }

      // Delete database record
      await pool.query('DELETE FROM files WHERE id = $1', [fileId]);

      res.json({ message: 'Datei gelöscht' });
    } catch (error) {
      console.error('Error deleting file:', error);
      res.status(500).json({ error: 'Fehler beim Löschen der Datei' });
    }
  }
);

// GET /api/files/:fileId
router.get('/files/:fileId',
  requireAuth,
  validateUUID('fileId'),
  handleValidationErrors,
  async (req, res) => {
    try {
      const { fileId } = req.params;

      // Get file
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

module.exports = router;
