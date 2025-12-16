// Calculate normalized monthly amount based on interval
const calculateNormalizedMonthlyAmount = (amount, interval) => {
  const multipliers = {
    daily: 30.437,
    weekly: 4.345,
    monthly: 1,
    quarterly: 1 / 3,
    semiannual: 1 / 6,
    yearly: 1 / 12
  };

  const multiplier = multipliers[interval] || 1;
  return parseFloat((amount * multiplier).toFixed(2));
};

// Format amount to German format (1.234,56 €)
const formatAmount = (amount) => {
  const num = parseFloat(amount);
  return new Intl.NumberFormat('de-DE', {
    style: 'currency',
    currency: 'EUR'
  }).format(num);
};

// Format date to German format (dd.MM.yyyy)
const formatDateGerman = (dateStr) => {
  if (!dateStr) return '';
  const date = new Date(dateStr);
  return date.toLocaleDateString('de-DE');
};

// Format date to PayPal format (dd.MM.yy)
const formatDatePayPal = (dateStr) => {
  if (!dateStr) return '';
  const date = new Date(dateStr);
  const day = String(date.getDate()).padStart(2, '0');
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const year = String(date.getFullYear()).slice(-2);
  return `${day}.${month}.${year}`;
};

// Format date to ISO format (YYYY-MM-DD)
const formatDateISO = (date) => {
  if (!date) return '';
  const d = new Date(date);
  return d.toISOString().split('T')[0];
};

// Sanitize filename
const sanitizeFilename = (filename) => {
  return filename.replace(/[^a-zA-Z0-9.-]/g, '_');
};

module.exports = {
  calculateNormalizedMonthlyAmount,
  formatAmount,
  formatDateGerman,
  formatDatePayPal,
  formatDateISO,
  sanitizeFilename
};
