const crypto = require('crypto');
const { EmailVerification } = require('../models');
const ApiError = require('../utils/ApiError');
const { jwt: jwtConfig } = require('../config/auth');

const CODE_TTL_MINUTES = 10;
const RESEND_SECONDS = 60;
const MAX_ATTEMPTS = 5;

// хэш привязан к почте и секрету сервера, поэтому подобрать код по базе нельзя
const hashCode = (email, code) => crypto.createHmac('sha256', jwtConfig.secret).update(`${email}:${code}`).digest('hex');

const randomCode = () => String(crypto.randomInt(0, 1_000_000)).padStart(6, '0');

/** Создаёт новый код для почты и возвращает его (отправка письма — на вызывающем коде). */
async function issueCode({ email, purpose, userId = null }) {
  const existing = await EmailVerification.findOne({ where: { email, purpose } });
  if (existing) {
    const wait = Math.ceil((existing.sentAt.getTime() + RESEND_SECONDS * 1000 - Date.now()) / 1000);
    if (wait > 0) throw new ApiError(429, `Новый код можно запросить через ${wait} с`);
  }

  const code = randomCode();
  const values = {
    email, purpose, userId,
    codeHash: hashCode(email, code),
    expiresAt: new Date(Date.now() + CODE_TTL_MINUTES * 60 * 1000),
    attempts: 0,
    sentAt: new Date(),
  };
  if (existing) await existing.update(values);
  else await EmailVerification.create(values);
  return code;
}

async function discardCode({ email, purpose }) {
  await EmailVerification.destroy({ where: { email, purpose } });
}

/** Проверяет код. При успехе удаляет запись (код одноразовый), иначе бросает ApiError. */
async function checkCode({ email, purpose, code }) {
  const row = await EmailVerification.findOne({ where: { email, purpose } });
  if (!row || row.expiresAt.getTime() < Date.now()) {
    throw new ApiError(400, 'Код устарел или не запрашивался. Запросите новый');
  }
  if (row.attempts >= MAX_ATTEMPTS) {
    throw new ApiError(429, 'Слишком много неверных попыток. Запросите новый код');
  }

  const expected = Buffer.from(row.codeHash, 'hex');
  const actual = Buffer.from(hashCode(email, code), 'hex');
  if (!crypto.timingSafeEqual(expected, actual)) {
    await row.update({ attempts: row.attempts + 1 });
    const left = MAX_ATTEMPTS - row.attempts;
    throw new ApiError(400, left > 0 ? `Неверный код. Осталось попыток: ${left}` : 'Неверный код. Запросите новый код');
  }
  await row.destroy();
  return row;
}

module.exports = { issueCode, discardCode, checkCode, CODE_TTL_MINUTES, RESEND_SECONDS };
