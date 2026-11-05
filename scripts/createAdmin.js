// Создаёт (или обновляет пароль) учётку администратора с доступом ко всему:  npm run admin:create
// Вход: логин admin (или почта ниже), пароль по умолчанию admin. Для боевого сервера задайте свои значения:
//   ADMIN_PASSWORD=... ADMIN_EMAIL=... npm run admin:create
require('dotenv').config({ quiet: true });

const bcrypt = require('bcrypt');
const { sequelize, User } = require('../models');
const { bcryptRounds } = require('../config/auth');

const email = (process.env.ADMIN_EMAIL || 'admin@talon.local').trim().toLowerCase();
const password = process.env.ADMIN_PASSWORD || 'admin';

async function main() {
  const passwordHash = await bcrypt.hash(password, bcryptRounds);
  const existing = await User.findOne({ where: { role: 'admin' } });
  if (existing) {
    await existing.update({ passwordHash, tokenVersion: existing.tokenVersion + 1, isVerified: true });
    console.log(`Пароль администратора обновлён (почта ${existing.email}). Логин для входа: admin`);
  } else {
    await User.create({ email, passwordHash, role: 'admin', isVerified: true });
    console.log(`Администратор создан (почта ${email}). Логин для входа: admin`);
  }
  if (password === 'admin') console.warn('Внимание: пароль «admin» подходит только для разработки. На сервере задайте ADMIN_PASSWORD.');
}

main()
  .catch((err) => { console.error(`Ошибка: ${err.message}`); process.exitCode = 1; })
  .finally(() => sequelize.close());
