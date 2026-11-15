require('dotenv').config({ quiet: true });

const smtpPort = Number(process.env.SMTP_PORT || 465);
const smtpUser = process.env.SMTP_USER || '';

module.exports = {
  jwt: {
    secret: process.env.JWT_SECRET,
    expiresIn: process.env.JWT_EXPIRES_IN || '1h',
    // Временный токен между шагами пароль и код из Google Authenticator
    twoFactorExpiresIn: '5m',
    algorithm: 'HS256',
  },

  bcryptRounds: 10,

  // Адреса React-клиента: для CORS и для ссылки «Перейти ко входу» на странице подтверждения e-mail
  client: {
    origins: (process.env.CLIENT_ORIGIN || 'http://localhost:5173,http://127.0.0.1:5173')
      .split(',')
      .map((origin) => origin.trim().replace(/\/+$/, ''))
      .filter(Boolean),
  },

  verification: {
    ttlHours: 24,
    baseUrl: (process.env.APP_BASE_URL || `http://localhost:${process.env.PORT || 3000}`).replace(/\/+$/, ''),
  },

  twoFactor: {
    issuer: process.env.TOTP_ISSUER || 'Clinic API',
    encryptionKey: process.env.TOTP_ENCRYPTION_KEY,
    digits: 6,
    period: 30,
    // допускаем сдвиг часов на ±1 шаг (30 с)
    window: 1,
  },

  smtp: {
    host: process.env.SMTP_HOST || '',
    port: smtpPort,
    secure: process.env.SMTP_SECURE ? process.env.SMTP_SECURE === 'true' : smtpPort === 465,
    user: smtpUser,
    pass: (process.env.SMTP_PASS || '').replace(/\s+/g, ''),
    from: process.env.MAIL_FROM || (smtpUser ? `"Clinic API" <${smtpUser}>` : ''),
  },

  checkAuthConfig() {
    const errors = [];
    const warnings = [];

    if (!process.env.JWT_SECRET || process.env.JWT_SECRET.length < 32) {
      errors.push('JWT_SECRET не задан или короче 32 символов');
    }
    if (!/^[0-9a-fA-F]{64}$/.test(process.env.TOTP_ENCRYPTION_KEY || '')) {
      errors.push('TOTP_ENCRYPTION_KEY должен быть строкой из 64 hex-символов (32 байта)');
    }
    if (!smtpUser || !process.env.SMTP_PASS) {
      warnings.push('SMTP_USER/SMTP_PASS не заданы — письма с подтверждением e-mail отправляться не будут');
    }
    return { errors, warnings };
  },
};
