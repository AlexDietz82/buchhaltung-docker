const { body, param, query, validationResult } = require('express-validator');

// Validation error handler
const handleValidationErrors = (req, res, next) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({ errors: errors.array() });
  }
  next();
};

// Username validation
const validateUsername = () => [
  body('username')
    .trim()
    .isLength({ min: 3, max: 100 })
    .withMessage('Benutzername muss zwischen 3 und 100 Zeichen lang sein')
];

// Password validation
const validatePassword = () => [
  body('password')
    .isLength({ min: 12 })
    .withMessage('Passwort muss mindestens 12 Zeichen lang sein')
];

// UUID validation
const validateUUID = (field = 'id', location = 'param') => {
  const validator = location === 'param' ? param(field) : location === 'body' ? body(field) : query(field);
  return validator.isUUID().withMessage(`${field} muss eine gültige UUID sein`);
};

// Date validation
const validateDate = (field) => [
  body(field)
    .optional()
    .isISO8601()
    .withMessage(`${field} muss ein gültiges Datum im Format YYYY-MM-DD sein`)
];

// Amount validation
const validateAmount = (field = 'amount') => [
  body(field)
    .isDecimal({ decimal_digits: '0,2' })
    .withMessage(`${field} muss eine Zahl mit maximal 2 Nachkommastellen sein`)
];

// Hex color validation
const validateColor = () => [
  body('color')
    .matches(/^#([0-9a-fA-F]{6}|[0-9a-fA-F]{3})$/)
    .withMessage('Farbe muss im Hex-Format sein (#RGB oder #RRGGBB)')
];

// Transaction validation
const validateTransaction = () => [
  body('account_id').isUUID().withMessage('Konto-ID muss eine gültige UUID sein'),
  body('description').trim().isLength({ min: 1, max: 1000 }).withMessage('Beschreibung erforderlich (max. 1000 Zeichen)'),
  body('amount').isDecimal({ decimal_digits: '0,2' }).withMessage('Betrag muss eine gültige Zahl sein'),
  body('payment_method').isIn(['PayPal', 'SEPA', 'CASH', 'BANK']).withMessage('Ungültige Zahlungsmethode'),
  body('date').isISO8601().withMessage('Datum muss im Format YYYY-MM-DD sein'),
  body('type').optional().isLength({ max: 50 }).withMessage('Typ darf maximal 50 Zeichen lang sein'),
  body('note').optional().isLength({ max: 2000 }).withMessage('Notiz darf maximal 2000 Zeichen lang sein'),
  body('category').optional().isString(),
  body('art').isIn(['PP', 'EB', 'EK', 'WB']).withMessage('Ungültige Art'),
  body('booked_on_giro').optional().isBoolean()
];

// Recurring validation
const validateRecurring = () => [
  body('account_id').isUUID().withMessage('Konto-ID muss eine gültige UUID sein'),
  body('description').trim().isLength({ min: 1, max: 1000 }).withMessage('Beschreibung erforderlich'),
  body('interval').isIn(['daily', 'weekly', 'monthly', 'quarterly', 'semiannual', 'yearly']).withMessage('Ungültiges Intervall'),
  body('interval_count').optional().isInt({ min: 1 }).withMessage('Intervallanzahl muss mindestens 1 sein'),
  body('start_date').isISO8601().withMessage('Startdatum erforderlich'),
  body('end_date').optional().isISO8601().withMessage('Enddatum muss im Format YYYY-MM-DD sein'),
  body('occurrence_amount').isDecimal({ decimal_digits: '0,2' }).withMessage('Betrag erforderlich'),
  body('payment_method').isIn(['PayPal', 'SEPA', 'CASH', 'BANK']).withMessage('Ungültige Zahlungsmethode'),
  body('art').isIn(['PP', 'EB', 'EK', 'WB']).withMessage('Ungültige Art')
];

// Account validation
const validateAccount = () => [
  body('name').trim().isLength({ min: 1, max: 200 }).withMessage('Name erforderlich (max. 200 Zeichen)'),
  body('opening_balance').isDecimal({ decimal_digits: '0,2' }).withMessage('Eröffnungssaldo muss eine gültige Zahl sein'),
  body('currency').optional().isLength({ max: 3 }).withMessage('Währung max. 3 Zeichen')
];

// User validation
const validateUser = () => [
  body('username').trim().isLength({ min: 3, max: 100 }).withMessage('Benutzername erforderlich (3-100 Zeichen)'),
  body('password').optional().isLength({ min: 12 }).withMessage('Passwort muss mindestens 12 Zeichen lang sein'),
  body('role').isIn(['ADMIN', 'USER']).withMessage('Ungültige Rolle'),
  body('pages').isArray().withMessage('Pages muss ein Array sein'),
  body('accounts').optional().isArray().withMessage('Accounts muss ein Array sein'),
  body('active').optional().isBoolean()
];

// Category validation
const validateCategory = () => [
  body('key').isIn(['lebensmittel', 'hygiene', 'mobilitaet', 'kommunikation', 'gesundheit', 'haus', 'strom', 'gas', 'wasser', 'gemeinde', 'hobby', 'sonstiges']).withMessage('Ungültiger Kategorie-Key'),
  body('label').trim().isLength({ min: 1, max: 100 }).withMessage('Label erforderlich'),
  body('color').matches(/^#([0-9a-fA-F]{6}|[0-9a-fA-F]{3})$/).withMessage('Farbe muss im Hex-Format sein'),
  body('active').optional().isBoolean()
];

// Regular booking validation
const validateRegularBooking = () => [
  body('account_id').isUUID().withMessage('Konto-ID muss eine gültige UUID sein'),
  body('description').trim().isLength({ min: 1, max: 1000 }).withMessage('Beschreibung erforderlich'),
  body('art').isIn(['WB', 'EK']).withMessage('Art muss WB oder EK sein'),
  body('start_date').isISO8601().withMessage('Startdatum erforderlich'),
  body('end_date').optional().isISO8601().withMessage('Enddatum muss im Format YYYY-MM-DD sein'),
  body('interval').isIn(['daily', 'weekly', 'monthly', 'quarterly', 'semiannual', 'yearly']).withMessage('Ungültiges Intervall'),
  body('amount').isDecimal({ decimal_digits: '0,2' }).withMessage('Betrag erforderlich'),
  body('booked_on_giro').optional().isBoolean()
];

module.exports = {
  handleValidationErrors,
  validateUsername,
  validatePassword,
  validateUUID,
  validateDate,
  validateAmount,
  validateColor,
  validateTransaction,
  validateRecurring,
  validateAccount,
  validateUser,
  validateCategory,
  validateRegularBooking
};
