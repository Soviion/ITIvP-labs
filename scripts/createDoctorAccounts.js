// Создаёт аккаунты врачей для входа на /doctor/login:  npm run doctors:accounts
// Логин — e-mail врача из таблицы doctors. Уже существующие аккаунты не трогаются.
//   npm run doctors:accounts                       — каждому врачу случайный пароль, список сохраняется в doctor-passwords.local.txt
//   npm run doctors:accounts -- --password=Qwerty1!  — один общий пароль для всех (удобно для разработки)
//   npm run doctors:accounts -- --reset              — заново выдать пароли и уже существующим аккаунтам (если пароль потерян)
require('dotenv').config({ quiet: true });

const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const bcrypt = require('bcrypt');
const { sequelize, User, Doctor } = require('../models');
const { bcryptRounds } = require('../config/auth');
const { assertStrongPassword } = require('../utils/passwordPolicy');

const OUT_FILE = path.join(__dirname, '..', 'doctor-passwords.local.txt');

function randomPassword() {
  // буквы разных регистров, цифра и спецсимвол — чтобы пройти правила пароля
  const base = crypto.randomBytes(9).toString('base64').replace(/[+/=]/g, 'x');
  return `${base}Aa1!`;
}

async function main() {
  const arg = process.argv.find((item) => item.startsWith('--password='));
  const common = arg ? arg.slice('--password='.length) : null;
  if (common) assertStrongPassword(common, {});

  const reset = process.argv.includes('--reset'); // заново выдать пароли всем врачам (в том числе уже имеющим аккаунт)
  const doctors = await Doctor.findAll({ where: { isActive: true }, order: [['id', 'ASC']] });
  const lines = [];
  let created = 0;

  for (const doctor of doctors) {
    const email = doctor.email.trim().toLowerCase();
    const existing = await User.findOne({ where: { doctorId: doctor.id } });
    if (existing && reset) {
      const newPassword = common ?? randomPassword();
      await existing.update({ passwordHash: await bcrypt.hash(newPassword, bcryptRounds), tokenVersion: existing.tokenVersion + 1, isVerified: true });
      lines.push(`${doctor.fullName}	${existing.email}	${newPassword}`);
      created += 1;
      continue;
    }
    if (existing) continue;
    if (await User.findOne({ where: { email } })) {
      console.warn(`Пропуск: e-mail ${email} уже занят другим аккаунтом (врач id=${doctor.id})`);
      continue;
    }
    const password = common ?? randomPassword();
    await User.create({
      email,
      passwordHash: await bcrypt.hash(password, bcryptRounds),
      role: 'doctor',
      doctorId: doctor.id,
      isVerified: true, // врачей заводит администратор, подтверждение почты кодом не нужно
    });
    lines.push(`${doctor.fullName}\t${email}\t${password}`);
    created += 1;
  }

  if (lines.length && !common) {
    fs.writeFileSync(OUT_FILE, `ФИО\tлогин\tпароль\n${lines.join('\n')}\n`, 'utf8');
    console.log(`Пароли сохранены в ${path.basename(OUT_FILE)} (файл в .gitignore, после раздачи паролей удалите его).`);
  }
  console.log(`Готово. Создано или обновлено аккаунтов врачей: ${created}, всего активных врачей: ${doctors.length}`);
  if (common) console.log('У всех созданных аккаунтов общий пароль из --password.');
}

main()
  .catch((err) => {
    console.error(`Ошибка: ${err.message}`);
    process.exitCode = 1;
  })
  .finally(() => sequelize.close());
