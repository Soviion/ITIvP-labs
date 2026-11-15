const bcrypt = require('bcrypt');
const { Op } = require('sequelize');
const { User, Patient, sequelize } = require('../models');
const ApiError = require('../utils/ApiError');
const { getBody } = require('../utils/request');
const { normalizeEmail, normalizeCode, requireString } = require('../utils/authInput');
const { assertStrongPassword } = require('../utils/passwordPolicy');
const { validatePatientProfile } = require('../utils/patientProfile');
const { bcryptRounds } = require('../config/auth');
const { signRegistrationToken, verifyToken } = require('../services/tokens');
const { sendCodeEmail } = require('../services/mailer');
const { issueCode, discardCode, checkCode, CODE_TTL_MINUTES, RESEND_SECONDS } = require('../services/emailCodes');

// Регистрация пациента в три шага: 1) код из письма, 2) анкета, 3) пароль

// Шаг 1а: отправить код на почту
exports.start = async (req, res) => {
  const email = normalizeEmail(getBody(req).email);
  if (await User.count({ where: { email } })) {
    throw new ApiError(409, 'Пользователь с таким e-mail уже зарегистрирован. Войдите в личный кабинет');
  }

  const code = await issueCode({ email, purpose: 'register' });
  try {
    await sendCodeEmail(email, code, 'register', CODE_TTL_MINUTES);
  } catch (err) {
    console.error(`Не удалось отправить код на ${email}: ${err.message}`);
    await discardCode({ email, purpose: 'register' });
    throw new ApiError(502, 'Не удалось отправить письмо. Проверьте адрес или повторите позже');
  }
  res.json({ message: `Код отправлен на ${email}`, resendAfterSeconds: RESEND_SECONDS, expiresInMinutes: CODE_TTL_MINUTES });
};

// Шаг 1б: проверить код. Если верный — выдаём короткоживущий токен, с которым можно завершить регистрацию
exports.verify = async (req, res) => {
  const body = getBody(req);
  const email = normalizeEmail(body.email);
  const code = normalizeCode(body.code);
  await checkCode({ email, purpose: 'register', code });
  res.json({ message: 'Почта подтверждена', registrationToken: signRegistrationToken(email) });
};

// Шаги 2–3: анкета и пароль. Создаёт аккаунт и карточку пациента с медицинской картой.
exports.complete = async (req, res) => {
  const body = getBody(req);
  const { email } = verifyToken(requireString(body.registrationToken, 'registrationToken'), 'register');

  // собираем ошибки анкеты и пароля вместе, чтобы показать их одним списком
  const errors = [];
  let profile;
  try {
    profile = validatePatientProfile(body);
  } catch (err) {
    if (err instanceof ApiError && err.details) errors.push(...err.details);
    else throw err;
  }
  const password = requireString(body.password, 'password');
  try {
    assertStrongPassword(password, { email });
  } catch (err) {
    if (err instanceof ApiError && err.details) errors.push(...err.details);
    else throw err;
  }
  if (profile && await Patient.count({ where: { phone: profile.phone, userId: { [Op.ne]: null } } })) {
    errors.push({ field: 'phone', message: 'Этот номер уже привязан к другому аккаунту' });
  }
  if (errors.length) throw new ApiError(400, 'Проверьте введённые данные', errors);

  if (await User.count({ where: { email } })) {
    throw new ApiError(409, 'Пользователь с таким e-mail уже зарегистрирован');
  }

  const passwordHash = await bcrypt.hash(password, bcryptRounds);
  const user = await sequelize.transaction(async (transaction) => {
    const created = await User.create({ email, passwordHash, isVerified: true, role: 'patient' }, { transaction });
    // медицинская карта создаётся автоматически хуком модели Patient
    await Patient.create({ ...profile, email, userId: created.id }, { transaction });
    return created;
  });

  res.status(201).json({ message: 'Аккаунт создан. Теперь войдите в личный кабинет', user });
};
