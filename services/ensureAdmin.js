const bcrypt = require('bcrypt');
const { User } = require('../models');
const { bcryptRounds } = require('../config/auth');

// При старте сервера гарантирует, что учётка администратора существует: логин admin, пароль admin
// (или значения из ADMIN_EMAIL / ADMIN_PASSWORD в .env). Существующего администратора не трогает.
// Отключается переменной ADMIN_AUTOCREATE=false. Пароль admin подходит только для разработки.
async function ensureAdmin() {
  if (process.env.ADMIN_AUTOCREATE === 'false') return;
  try {
    if (await User.findOne({ where: { role: 'admin' }, attributes: ['id'] })) return;

    const email = (process.env.ADMIN_EMAIL || 'admin@talon.local').trim().toLowerCase();
    const password = process.env.ADMIN_PASSWORD || 'admin';
    await User.create({ email, passwordHash: await bcrypt.hash(password, bcryptRounds), role: 'admin', isVerified: true });
    console.warn(`Создана учётка администратора: логин admin${process.env.ADMIN_PASSWORD ? '' : ', пароль admin (только для разработки, смените через ADMIN_PASSWORD)'}`);
  } catch (err) {
    // чаще всего не применены миграции: npm run db:migrate
    console.error(`Не удалось проверить учётку администратора: ${err.message}. Выполните npm run db:migrate`);
  }
}

module.exports = ensureAdmin;
