const bcrypt = require('bcrypt');
const { User } = require('../models');
const { bcryptRounds } = require('../config/auth');

// При старте сервера гарантирует, что учётка администратора существует (вход по логину admin).
// Почта и пароль берутся из .env: ADMIN_EMAIL и ADMIN_PASSWORD, в коде их нет. Существующего администратора не трогает.
// Отключается переменной ADMIN_AUTOCREATE=false.
async function ensureAdmin() {
  if (process.env.ADMIN_AUTOCREATE === 'false') return;
  try {
    if (await User.findOne({ where: { role: 'admin' }, attributes: ['id'] })) return;

    const email = (process.env.ADMIN_EMAIL || '').trim().toLowerCase();
    const password = process.env.ADMIN_PASSWORD || '';
    if (!email || !password) {
      console.warn('Учётка администратора не создана: задайте ADMIN_EMAIL и ADMIN_PASSWORD в .env');
      return;
    }
    await User.create({ email, passwordHash: await bcrypt.hash(password, bcryptRounds), role: 'admin', isVerified: true });
    console.warn('Создана учётка администратора (логин admin, пароль из ADMIN_PASSWORD в .env)');
  } catch (err) {
    // чаще всего не применены миграции: npm run db:migrate
    console.error(`Не удалось проверить учётку администратора: ${err.message}. Выполните npm run db:migrate`);
  }
}

module.exports = ensureAdmin;
