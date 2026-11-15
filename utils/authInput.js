const ApiError = require('./ApiError');

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

function requireString(value, field) {
  if (typeof value !== 'string' || !value.length) {
    throw new ApiError(400, `Поле "${field}" обязательно и должно быть непустой строкой`);
  }
  return value;
}

function normalizeEmail(value) {
  const email = requireString(value, 'email').trim().toLowerCase();
  if (email.length > 120 || !EMAIL_RE.test(email)) {
    throw new ApiError(400, 'Некорректный e-mail');
  }
  return email;
}

// Google Authenticator показывает код как «123 456» — пробелы убираем
function normalizeCode(value) {
  const code = requireString(typeof value === 'number' ? String(value) : value, 'code').replace(/\s+/g, '');
  if (!/^\d{6}$/.test(code)) {
    throw new ApiError(400, 'Код должен состоять из 6 цифр');
  }
  return code;
}

module.exports = { requireString, normalizeEmail, normalizeCode };
