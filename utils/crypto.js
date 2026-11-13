const crypto = require('crypto');
const { twoFactor } = require('../config/auth');

const sha256 = (value) => crypto.createHash('sha256').update(value).digest('hex');

// Пароль для демо-учёток: буквы разных регистров, цифра и спецсимвол, чтобы пройти правила пароля
const randomPassword = () => `${crypto.randomBytes(9).toString('base64').replace(/[+/=]/g, 'x')}Aa1!`;

const getKey = () => Buffer.from(twoFactor.encryptionKey, 'hex');

function encrypt(plainText) {
  const iv = crypto.randomBytes(12);
  const cipher = crypto.createCipheriv('aes-256-gcm', getKey(), iv);
  const encrypted = Buffer.concat([cipher.update(plainText, 'utf8'), cipher.final()]);
  return [iv, cipher.getAuthTag(), encrypted].map((part) => part.toString('base64')).join('.');
}

function decrypt(payload) {
  const [iv, tag, encrypted] = payload.split('.').map((part) => Buffer.from(part, 'base64'));
  const decipher = crypto.createDecipheriv('aes-256-gcm', getKey(), iv);
  decipher.setAuthTag(tag);
  return Buffer.concat([decipher.update(encrypted), decipher.final()]).toString('utf8');
}

module.exports = { sha256, randomPassword, encrypt, decrypt };
