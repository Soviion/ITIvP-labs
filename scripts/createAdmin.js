// Создаёт (или обновляет пароль) учётку администратора с доступом ко всему:  npm run admin:create
// Вход: логин admin. Почта и пароль берутся из .env (ADMIN_EMAIL, ADMIN_PASSWORD); чтобы сменить пароль, измените его в .env и запустите команду снова.
require('dotenv').config({ quiet: true });

const bcrypt = require('bcrypt');
const { sequelize, User } = require('../models');
const { bcryptRounds } = require('../config/auth');

const email = (process.env.ADMIN_EMAIL || '').trim().toLowerCase();
const password = process.env.ADMIN_PASSWORD || '';

async function main() {
  if (!email || !password) throw new Error('Задайте ADMIN_EMAIL и ADMIN_PASSWORD в .env');
  const passwordHash = await bcrypt.hash(password, bcryptRounds);
  const existing = await User.findOne({ where: { role: 'admin' } });
  if (existing) {
    await existing.update({ passwordHash, tokenVersion: existing.tokenVersion + 1, isVerified: true });
    console.log(`Пароль администратора обновлён (почта ${existing.email}). Логин для входа: admin`);
  } else {
    await User.create({ email, passwordHash, role: 'admin', isVerified: true });
    console.log(`Администратор создан (почта ${email}). Логин для входа: admin`);
  }
}

main()
  .catch((err) => { console.error(`Ошибка: ${err.message}`); process.exitCode = 1; })
  .finally(() => sequelize.close());
