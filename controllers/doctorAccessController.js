const crypto = require('crypto');
const bcrypt = require('bcrypt');
const { User, Doctor } = require('../models');
const ApiError = require('../utils/ApiError');
const { getBody } = require('../utils/request');
const { normalizeEmail } = require('../utils/authInput');
const { checkPasswordStrength } = require('../utils/passwordPolicy');
const { bcryptRounds, client } = require('../config/auth');
const { sendAccessEmail } = require('../services/mailer');
const clinic = require('../services/documents/clinic');

// Пароль без похожих символов (0/O, 1/l/I), чтобы его можно было спокойно переписать из письма
const ALPHABET = 'ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnpqrstuvwxyz23456789';
const SPECIALS = '!@#$%&*?';

function generatePassword() {
  for (let attempt = 0; attempt < 50; attempt += 1) {
    const body = Array.from(crypto.randomBytes(11), (byte) => ALPHABET[byte % ALPHABET.length]).join('');
    const password = `${body}${SPECIALS[crypto.randomInt(SPECIALS.length)]}${crypto.randomInt(2, 10)}`;
    // подходит под ту же политику, что и пароли пациентов (заглавная, строчная, цифра, спецсимвол)
    if (!checkPasswordStrength(password, {}).length) return password;
  }
  throw new ApiError(500, 'Не удалось создать пароль');
}

// POST /doctor/access { email } — открыть доступ новому врачу.
// Пароль создаётся на сервере, сразу записывается в базу вместе с учёткой и уходит на почту в письме.
exports.grantAccess = async (req, res) => {
  if (req.user.role !== 'admin') throw new ApiError(403, 'Открывать доступ новым врачам может только администратор');
  const email = normalizeEmail(getBody(req).email);

  if (await User.findOne({ where: { email } })) {
    throw new ApiError(409, 'Для этой почты доступ уже открыт');
  }

  // если врач с такой почтой уже есть в справочнике и ещё без аккаунта — привязываем учётку к его карточке
  const doctor = await Doctor.findOne({ where: { email } });
  const taken = doctor ? await User.count({ where: { doctorId: doctor.id } }) : 1;

  const password = generatePassword();
  const user = await User.create({
    email,
    passwordHash: await bcrypt.hash(password, bcryptRounds),
    role: 'doctor',
    doctorId: doctor && !taken ? doctor.id : null,
    isVerified: true,
  });

  try {
    await sendAccessEmail(email, password, `${client.origins[0]}/doctor/login`, clinic.name);
  } catch (err) {
    // письмо не ушло — учётку не оставляем, иначе пароль никто не узнает
    await user.destroy();
    console.error(`Письмо о доступе не отправлено: ${err.message}`);
    throw new ApiError(502, 'Не удалось отправить письмо. Проверьте адрес или повторите позже');
  }

  res.status(201).json({ message: `Доступ открыт. Письмо отправлено на ${email}`, email });
};
