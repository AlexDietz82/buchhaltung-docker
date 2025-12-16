// API Base URL
const API_BASE = '/api';

// Format amount to German format
function formatAmount(amount) {
  const num = parseFloat(amount);
  return new Intl.NumberFormat('de-DE', {
    style: 'currency',
    currency: 'EUR'
  }).format(num);
}

// Format date to ISO (YYYY-MM-DD)
function formatDateISO(date) {
  if (!date) return '';
  const d = new Date(date);
  return d.toISOString().split('T')[0];
}

// Format date to German format (dd.MM.yyyy)
function formatDateGerman(dateStr) {
  if (!dateStr) return '';
  const [year, month, day] = dateStr.split('-');
  return `${day}.${month}.${year}`;
}

// Format date to PayPal format (dd.MM.yy)
function formatDatePayPal(dateStr) {
  if (!dateStr) return '';
  const [year, month, day] = dateStr.split('-');
  const shortYear = year.slice(-2);
  return `${day}.${month}.${shortYear}`;
}

// Format date for display (just day number)
function formatDateDay(dateStr) {
  if (!dateStr) return '';
  const [, , day] = dateStr.split('-');
  return parseInt(day, 10).toString();
}

// Show error message
function showError(message) {
  const alertDiv = document.createElement('div');
  alertDiv.className = 'alert alert-error';
  alertDiv.textContent = message;
  
  const container = document.querySelector('.container') || document.body;
  container.insertBefore(alertDiv, container.firstChild);
  
  setTimeout(() => {
    alertDiv.remove();
  }, 5000);
}

// Show success message
function showSuccess(message) {
  const alertDiv = document.createElement('div');
  alertDiv.className = 'alert alert-success';
  alertDiv.textContent = message;
  
  const container = document.querySelector('.container') || document.body;
  container.insertBefore(alertDiv, container.firstChild);
  
  setTimeout(() => {
    alertDiv.remove();
  }, 3000);
}

// API request helper
async function apiRequest(endpoint, options = {}) {
  try {
    const response = await fetch(`${API_BASE}${endpoint}`, {
      ...options,
      headers: {
        'Content-Type': 'application/json',
        ...options.headers
      },
      credentials: 'include'
    });

    const data = await response.json().catch(() => ({}));

    if (!response.ok) {
      throw new Error(data.error || 'Ein Fehler ist aufgetreten');
    }

    return data;
  } catch (error) {
    console.error('API request failed:', error);
    throw error;
  }
}

// Get current month (YYYY-MM)
function getCurrentMonth() {
  const now = new Date();
  const year = now.getFullYear();
  const month = String(now.getMonth() + 1).padStart(2, '0');
  return `${year}-${month}`;
}

// Get month name
function getMonthName(monthStr) {
  const months = [
    'Januar', 'Februar', 'März', 'April', 'Mai', 'Juni',
    'Juli', 'August', 'September', 'Oktober', 'November', 'Dezember'
  ];
  const [year, month] = monthStr.split('-');
  return `${months[parseInt(month, 10) - 1]} ${year}`;
}

// Debounce function
function debounce(func, wait) {
  let timeout;
  return function executedFunction(...args) {
    const later = () => {
      clearTimeout(timeout);
      func(...args);
    };
    clearTimeout(timeout);
    timeout = setTimeout(later, wait);
  };
}

// Confirm dialog
function confirm(message) {
  return window.confirm(message);
}

// Calculate normalized monthly amount
function calculateNormalizedMonthlyAmount(amount, interval) {
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
}
