const pool = require('../config/database');

// Check if user is authenticated
const requireAuth = async (req, res, next) => {
  if (!req.session || !req.session.userId) {
    return res.status(401).json({ error: 'Nicht authentifiziert' });
  }

  try {
    const result = await pool.query(
      'SELECT id, username, role, pages, accounts, active FROM users WHERE id = $1',
      [req.session.userId]
    );

    if (result.rows.length === 0 || !result.rows[0].active) {
      req.session.destroy();
      return res.status(401).json({ error: 'Benutzer nicht gefunden oder inaktiv' });
    }

    req.user = result.rows[0];
    next();
  } catch (error) {
    console.error('Auth middleware error:', error);
    res.status(500).json({ error: 'Serverfehler bei Authentifizierung' });
  }
};

// Check if user has admin role
const requireAdmin = (req, res, next) => {
  if (!req.user || req.user.role !== 'ADMIN') {
    return res.status(403).json({ error: 'Admin-Rechte erforderlich' });
  }
  next();
};

// Check if user has access to specific page
const checkPageAccess = (pageName) => {
  return (req, res, next) => {
    if (!req.user || !req.user.pages.includes(pageName)) {
      return res.status(403).json({ error: 'Keine Berechtigung für diese Seite' });
    }
    next();
  };
};

// Check if user has access to specific account
const checkAccountAccess = async (req, res, next) => {
  const accountId = req.params.accountId || req.body.account_id || req.query.account_id;
  
  if (!accountId) {
    return next();
  }

  // If user.accounts is empty, they have access to all accounts
  if (!req.user.accounts || req.user.accounts.length === 0) {
    return next();
  }

  // Otherwise, check if account is in their list
  if (!req.user.accounts.includes(accountId)) {
    return res.status(403).json({ error: 'Keine Berechtigung für dieses Konto' });
  }

  next();
};

module.exports = {
  requireAuth,
  requireAdmin,
  checkPageAccess,
  checkAccountAccess
};
