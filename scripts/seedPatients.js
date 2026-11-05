// Демонстрационные пациенты с аккаунтами для входа на сайт «Твой талон».
//   npm run patients:seed                          – создаёт 10 пациентов (уже созданных пропускает), пароли пишет в patient-passwords.local.txt
//   npm run patients:seed -- --password=Qwerty1!   – один общий пароль для всех
//   npm run patients:seed -- --passwords           – только выдать новые пароли уже созданным демо-пациентам
//   npm run patients:reset                         – удалить демо-пациентов со всеми данными (записи, карты, личные дела в MongoDB) и создать заново
// Демо-пациенты узнаются по почте на домене @talon.example, остальных пациентов скрипт не трогает.
require('dotenv').config({ quiet: true });

const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const bcrypt = require('bcrypt');
const { Op } = require('sequelize');
const {
  sequelize, User, Patient, MedicalRecord, MedicalEntry, Discharge, QueueTicket, Appointment, Doctor,
} = require('../models');
const { bcryptRounds } = require('../config/auth');
const { assertStrongPassword } = require('../utils/passwordPolicy');
const { bookableDates, slotsFor, loadBusy, SLOT_TIMES, SLOT_MINUTES } = require('../utils/schedule');

const DOMAIN = '@talon.example';
const OUT_FILE = process.env.PATIENT_PASSWORDS_FILE || path.join(__dirname, '..', 'patient-passwords.local.txt');

// ---------- 10 демонстрационных пациентов ----------
const DEMO = [
  { last: 'Козлов', first: 'Андрей', middle: 'Игоревич', birth: '1988-02-14', gender: 'male', login: 'kozlov', phone: '+375(29)7000001', address: 'г. Минск, ул. Притыцкого, 78-12', status: 'adult', work: 'ООО «Белтех»', blood: 'A+', height: 182, weight: 84.5, allergies: 'пыльца', diseases: ['Гастрит'], medications: ['Омез 20 мг, утром'] },
  { last: 'Новикова', first: 'Мария', middle: 'Сергеевна', birth: '1995-07-23', gender: 'female', login: 'novikova', phone: '+375(29)7000002', address: 'г. Минск, пр. Независимости, 45-30', status: 'adult', work: 'ЗАО «Мегасофт»', blood: 'O+', height: 168, weight: 58, allergies: null, diseases: [], medications: [] },
  { last: 'Лукашевич', first: 'Павел', middle: 'Олегович', birth: '1976-11-05', gender: 'male', login: 'lukashevich', phone: '+375(33)7000003', address: 'г. Минск, ул. Одинцова, 15-90', status: 'adult', work: 'СТО «Автодом»', blood: 'B+', height: 177, weight: 92, allergies: 'пенициллин', diseases: ['Артериальная гипертензия (I10)'], medications: ['Эналаприл 10 мг, утром'] },
  { last: 'Ковалёва', first: 'Ольга', middle: 'Петровна', birth: '1969-03-30', gender: 'female', login: 'kovaleva', phone: '+375(44)7000004', address: 'г. Минск, ул. Кальварийская, 22-7', status: 'adult', work: 'Городская библиотека', blood: 'AB+', height: 164, weight: 71.5, allergies: 'мёд, орехи', diseases: ['Сахарный диабет 2 типа (E11)', 'Артериальная гипертензия (I10)'], medications: ['Метформин 850 мг, 2 раза в день', 'Лозартан 50 мг, вечером'] },
  { last: 'Жуков', first: 'Дмитрий', middle: 'Андреевич', birth: '2003-09-12', gender: 'male', login: 'zhukov', phone: '+375(29)7000005', address: 'г. Минск, ул. Платонова, 39-45', status: 'student', work: 'БГУИР, 4 курс', blood: 'O-', height: 185, weight: 77, allergies: null, diseases: [], medications: [] },
  { last: 'Мороз', first: 'Анастасия', middle: 'Викторовна', birth: '2001-05-19', gender: 'female', login: 'moroz', phone: '+375(25)7000006', address: 'г. Минск, ул. Байкальская, 9-48', status: 'student', work: 'БГУ, 5 курс', blood: 'A-', height: 171, weight: 60, allergies: 'пыльца берёзы', diseases: ['Бронхиальная астма (J45)'], medications: ['Сальбутамол 100 мкг, по требованию'] },
  { last: 'Сидоров', first: 'Николай', middle: 'Фёдорович', birth: '1954-12-02', gender: 'male', login: 'sidorov', phone: '+375(29)7000007', address: 'г. Минск, ул. Тимирязева, 67-31', status: 'adult', work: 'пенсионер', blood: 'B-', height: 173, weight: 88, allergies: null, diseases: ['Ишемическая болезнь сердца (I25)', 'Артериальная гипертензия (I10)'], medications: ['Аспирин кардио 100 мг, вечером', 'Бисопролол 5 мг, утром'] },
  { last: 'Шевченко', first: 'Елена', middle: 'Александровна', birth: '1983-06-27', gender: 'female', login: 'shevchenko', phone: '+375(33)7000008', address: 'г. Минск, ул. Мележа, 5-14', status: 'adult', work: 'Клиника «Здоровье»', blood: 'A+', height: 166, weight: 63, allergies: null, diseases: ['Хронический гастрит (K29)'], medications: [] },
  { last: 'Рябцев', first: 'Артём', middle: 'Максимович', birth: '2012-04-08', gender: 'male', login: 'ryabtsev', phone: '+375(29)7000009', address: 'г. Минск, ул. Ленина, 10-25', status: 'schoolchild', work: 'Гимназия №12, 6 класс', blood: 'O+', height: 152, weight: 42, allergies: 'цитрусовые', diseases: [], medications: [], trusted: 'Рябцева Ирина Петровна, мама, +375(29)7100009' },
  { last: 'Белова', first: 'Алиса', middle: 'Денисовна', birth: '2018-10-21', gender: 'female', login: 'belova', phone: '+375(44)7000010', address: 'г. Минск, ул. Одинцова, 77-6', status: 'child', work: null, blood: 'A+', height: 118, weight: 21, allergies: null, diseases: [], medications: [], trusted: 'Белов Денис Игоревич, папа, +375(44)7100010' },
];

const REASONS = ['Консультация', 'Боли в спине', 'Контроль давления', 'Профилактический осмотр', 'Справка для работы', 'Кашель и температура', 'Повторный приём'];

// ---------- помощники ----------
function randomPassword() {
  // буквы разных регистров, цифра и спецсимвол – чтобы пройти правила пароля
  const base = crypto.randomBytes(9).toString('base64').replace(/[+/=]/g, 'x');
  return `${base}Aa1!`;
}

const pad = (n) => String(n).padStart(2, '0');
const iso = (date) => `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;
const isWeekday = (date) => date.getDay() >= 1 && date.getDay() <= 5;
const fullName = (item) => `${item.last} ${item.first} ${item.middle}`;
const emailOf = (item) => `${item.login}${DOMAIN}`;

// Запись на приём: ближайшая свободная дата и время у врача (или в прошлом для «проведённых»)
async function createAppointment(patientId, doctor, index, past) {
  const dates = [];
  if (past) {
    for (let back = 3 + index; dates.length < 6; back += 1) {
      const day = new Date(); day.setDate(day.getDate() - back);
      if (isWeekday(day)) dates.push(iso(day));
    }
  } else {
    dates.push(...bookableDates().slice(index % 4, (index % 4) + 6));
  }
  const busy = await loadBusy(Appointment, doctor.id, dates);
  for (const date of dates) {
    const slots = past ? SLOT_TIMES.map((time) => ({ time, free: !(busy.get(date) ?? []).some(([from, to]) => from < toMin(time) + SLOT_MINUTES && toMin(time) < to) })) : slotsFor(date, busy.get(date));
    const free = slots.filter((slot) => slot.free);
    if (!free.length) continue;
    const slot = free[(index * 3) % free.length];
    await Appointment.create({
      patientId, doctorId: doctor.id, date, time: slot.time, durationMinutes: SLOT_MINUTES,
      reason: REASONS[index % REASONS.length], status: past ? 'completed' : 'scheduled', cabinet: String(200 + doctor.id),
    });
    return true;
  }
  return false;
}
const toMin = (time) => Number(time.slice(0, 2)) * 60 + Number(time.slice(3, 5));

async function createDemoPatient(item, index, password, doctors) {
  const user = await User.create({ email: emailOf(item), passwordHash: await bcrypt.hash(password, bcryptRounds), role: 'patient', isVerified: true });
  const patient = await Patient.create({
    userId: user.id, lastName: item.last, firstName: item.first, middleName: item.middle, birthDate: item.birth, gender: item.gender,
    phone: item.phone, email: emailOf(item), address: item.address, socialStatus: item.status, workplace: item.work,
    trustedPerson: item.trusted ?? null, insuranceNumber: `BY-7${pad(index + 1)}${String(1000 + index * 37).slice(-4)}`,
  });
  // медицинская карта создаётся хуком модели Patient, заполняем её данными
  const record = await MedicalRecord.findOne({ where: { patientId: patient.id } });
  await record.update({
    bloodType: item.blood, heightCm: item.height, weightKg: item.weight, allergies: item.allergies, diseases: item.diseases, medications: item.medications,
  });
  if (doctors.length) {
    if (index < 7) await createAppointment(patient.id, doctors[index % doctors.length], index, false);
    if (index % 2 === 0) await createAppointment(patient.id, doctors[(index + 2) % doctors.length], index, true);
  }
  return { user, patient };
}

// ---------- удаление демо-пациентов со всеми данными ----------
async function wipeDemoPatients() {
  const users = await User.findAll({ where: { email: { [Op.like]: `%${DOMAIN}` }, role: 'patient' }, attributes: ['id'] });
  const patients = await Patient.unscoped().findAll({ where: { userId: users.map((u) => u.id) }, attributes: ['id'], paranoid: false });
  const patientIds = patients.map((p) => p.id);
  if (!patientIds.length) {
    await User.destroy({ where: { id: users.map((u) => u.id) } });
    return { patients: 0, cards: 0 };
  }

  // личные дела в MongoDB (если она подключена)
  let cards = 0;
  if (process.env.MONGO_URI) {
    const { connectMongo, isConnected } = require('../config/mongo');
    if ((await connectMongo()) && isConnected()) {
      const MedicalCard = require('../mongo/models/MedicalCard');
      const LabResult = require('../mongo/models/LabResult');
      const found = await MedicalCard.find({ patientId: { $in: patientIds } }, '_id');
      await LabResult.deleteMany({ card: { $in: found.map((c) => c._id) } });
      cards = (await MedicalCard.deleteMany({ patientId: { $in: patientIds } })).deletedCount;
    } else {
      console.warn('MongoDB недоступна: личные дела демо-пациентов не удалены');
    }
  }

  await sequelize.transaction(async (transaction) => {
    const records = await MedicalRecord.findAll({ where: { patientId: patientIds }, attributes: ['id'], transaction });
    const recordIds = records.map((r) => r.id);
    await Discharge.destroy({ where: { medicalRecordId: recordIds }, transaction });
    await MedicalEntry.destroy({ where: { medicalRecordId: recordIds }, transaction });
    await QueueTicket.destroy({ where: { patientId: patientIds }, transaction });
    await Appointment.destroy({ where: { patientId: patientIds }, transaction });
    await MedicalRecord.destroy({ where: { patientId: patientIds }, transaction });
    await Patient.destroy({ where: { id: patientIds }, force: true, transaction });
    await User.destroy({ where: { id: users.map((u) => u.id) }, transaction });
  });
  return { patients: patientIds.length, cards };
}

function writeFile(lines) {
  fs.writeFileSync(OUT_FILE, `ФИО\tлогин\tтелефон\tпароль\n${lines.join('\n')}\n`, 'utf8');
  console.log(`Логины и пароли сохранены в ${path.basename(OUT_FILE)} (файл в .gitignore, после раздачи паролей удалите его).`);
}

async function main() {
  const args = process.argv.slice(2);
  const arg = args.find((item) => item.startsWith('--password='));
  const common = arg ? arg.slice('--password='.length) : null;
  if (common) assertStrongPassword(common, {});
  const reset = args.includes('--reset');
  const onlyPasswords = args.includes('--passwords');

  if (reset) {
    const removed = await wipeDemoPatients();
    console.log(`Удалено демо-пациентов: ${removed.patients}, личных дел в MongoDB: ${removed.cards}`);
  }

  if (onlyPasswords) {
    const lines = [];
    for (const item of DEMO) {
      const user = await User.findOne({ where: { email: emailOf(item) } });
      if (!user) continue;
      const password = common ?? randomPassword();
      await user.update({ passwordHash: await bcrypt.hash(password, bcryptRounds), tokenVersion: user.tokenVersion + 1 });
      lines.push(`${fullName(item)}\t${emailOf(item)}\t${item.phone}\t${password}`);
    }
    if (lines.length && !common) writeFile(lines);
    console.log(`Новые пароли выданы пациентам: ${lines.length}${common ? ' (общий пароль из --password)' : ''}`);
    return;
  }

  const doctors = await Doctor.findAll({ where: { isActive: true }, order: [['id', 'ASC']] });
  const lines = [];
  let skipped = 0;
  for (const [index, item] of DEMO.entries()) {
    if (await User.findOne({ where: { email: emailOf(item) } })) { skipped += 1; continue; }
    const password = common ?? randomPassword();
    await createDemoPatient(item, index, password, doctors);
    lines.push(`${fullName(item)}\t${emailOf(item)}\t${item.phone}\t${password}`);
  }
  if (lines.length && !common) writeFile(lines);
  console.log(`Готово. Создано демо-пациентов: ${lines.length}${skipped ? `, уже были: ${skipped} (новые пароли – npm run patients:seed -- --passwords)` : ''}`);
  if (common && lines.length) console.log('У созданных пациентов общий пароль из --password. Логин – почта вида фамилия@talon.example.');
  if (!doctors.length) console.warn('В справочнике нет врачей: записи на приём не созданы (npm run db:seed).');
}

main()
  .catch((err) => { console.error(`Ошибка: ${err.message}`); process.exitCode = 1; })
  .finally(async () => {
    if (process.env.MONGO_URI) { try { await require('mongoose').disconnect(); } catch { /* не подключались */ } }
    await sequelize.close();
  });
