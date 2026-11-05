// Диагностика входа:  npm run auth:check            — состояние базы и учёток
//                     npm run auth:check -- admin admin   — ещё и проверка конкретной пары логин и пароль
// Пароли нигде не печатаются.
require('dotenv').config({ quiet: true });

const bcrypt = require('bcrypt');
const { sequelize, User, Doctor } = require('../models');

async function main() {
  await sequelize.authenticate();
  console.log('База данных: подключение есть');

  const columns = await sequelize.getQueryInterface().describeTable('users');
  console.log(`Миграции: колонка doctor_id в users ${columns.doctor_id ? 'есть' : 'ОТСУТСТВУЕТ, выполните npm run db:migrate'}`);
  if (!columns.doctor_id) return;

  const users = await User.findAll({ attributes: ['id', 'email', 'role', 'isVerified', 'doctorId', 'twoFactorEnabled'] });
  const byRole = users.reduce((acc, user) => ({ ...acc, [user.role]: (acc[user.role] ?? 0) + 1 }), {});
  console.log('Аккаунтов по ролям:', JSON.stringify(byRole));

  const admin = users.find((user) => user.role === 'admin');
  console.log(admin ? `Администратор: есть (почта ${admin.email}), вход по логину admin` : 'Администратор: НЕТ. Он создастся при старте сервера или командой npm run admin:create');

  const doctors = await Doctor.findAll({ where: { isActive: true }, attributes: ['id', 'email'] });
  const withAccount = doctors.filter((doctor) => users.some((user) => user.doctorId === doctor.id)).length;
  console.log(`Врачей в справочнике: ${doctors.length}, с аккаунтом для входа: ${withAccount}${withAccount < doctors.length ? ' (npm run doctors:accounts)' : ''}`);

  const [login, password] = process.argv.slice(2);
  if (login && password) {
    const found = login.toLowerCase() === 'admin'
      ? users.find((user) => user.role === 'admin')
      : users.find((user) => user.email === login.trim().toLowerCase());
    if (!found) {
      console.log(`Проверка «${login}»: такого аккаунта нет`);
      return;
    }
    const full = await User.findByPk(found.id);
    const match = await bcrypt.compare(password, full.passwordHash);
    console.log(`Проверка «${login}»: роль ${full.role}, пароль ${match ? 'ПОДХОДИТ' : 'НЕ подходит'}, почта подтверждена: ${full.isVerified ? 'да' : 'нет'}, 2FA: ${full.twoFactorEnabled ? 'включена' : 'нет'}`);
    if (!match) console.log('Если пароль врача потерян: npm run doctors:accounts -- --reset');
  }
  console.log('Если вход отвечает «Слишком много неудачных попыток»: лимит хранится в памяти сервера, перезапустите сервер.');
}

main()
  .catch((err) => { console.error(`Ошибка: ${err.message}`); process.exitCode = 1; })
  .finally(() => sequelize.close());
