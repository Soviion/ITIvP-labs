const bcrypt = require('bcrypt');
const { Op } = require('sequelize');
const { User, Patient } = require('../models');
const { normalizePhone } = require('../utils/phone');
const ApiError = require('../utils/ApiError');
const { getBody } = require('../utils/request');
const { normalizeEmail, normalizeCode, requireString } = require('../utils/authInput');
const { assertStrongPassword } = require('../utils/passwordPolicy');
const { encrypt, decrypt } = require('../utils/crypto');
const { jwt: jwtConfig, bcryptRounds } = require('../config/auth');
const { signAccessToken, signTwoFactorToken, verifyToken } = require('../services/tokens');
const twoFactor = require('../services/twoFactor');

const DUMMY_HASH = bcrypt.hashSync('dummy-password-for-timing', bcryptRounds);

const sessionResponse = (user) => ({
  token: signAccessToken(user),
  tokenType: 'Bearer',
  expiresIn: jwtConfig.expiresIn,
  user,
});

function assertCodeResult(result, failStatus) {
  if (result === 'replay') {
    throw new ApiError(
      failStatus,
      'Этот код уже использован. Дождитесь следующего кода в приложении (он обновляется каждые 30 секунд)',
    );
  }
  if (result !== 'ok') {
    throw new ApiError(failStatus, 'Неверный код подтверждения');
  }
}

//  Вход 

// Вход по почте или по номеру телефона: поле login (для совместимости принимается и email)
async function findUserByLogin(login) {
  // учётка администратора входит по короткому логину admin
  if (login.toLowerCase() === 'admin') return User.findOne({ where: { role: 'admin' } });
  if (login.includes('@')) return User.findOne({ where: { email: normalizeEmail(login) } });

  const phone = normalizePhone(login);
  if (!phone) throw new ApiError(400, 'Введите почту или телефон в формате +375(44)4444444');
  const patient = await Patient.findOne({ where: { phone, userId: { [Op.ne]: null } }, include: [{ model: User, as: 'user' }] });
  return patient?.user ?? null;
}

// Два отдельных входа. Учётки не пересекаются: на сайт пациентов («Твой талон») входят пациенты и сотрудники регистратуры,
// в кабинет врача («Моя клиника») – врачи и администратор. Чужая роль получает такой же ответ, как при неверном пароле.
const PORTALS = {
  site: { roles: ['patient', 'staff'], failure: 'Неверная почта, телефон или пароль', twoFactorPath: '/auth/login/2fa' },
  doctor: { roles: ['doctor', 'admin'], failure: 'Неверный логин или пароль', twoFactorPath: '/auth/doctor/login/2fa' },
};

const makeLogin = (portal) => async (req, res) => {
  const { roles, failure, twoFactorPath } = PORTALS[portal];
  const body = getBody(req);
  const login = requireString(body.login ?? body.email, 'login').trim();
  const password = requireString(body.password, 'password');

  const user = await findUserByLogin(login);
  const passwordOk = await bcrypt.compare(password, user ? user.passwordHash : DUMMY_HASH);
  // роль проверяется после пароля и даёт тот же ответ: так нельзя выяснить, какие аккаунты существуют
  if (!user || !passwordOk || !roles.includes(user.role)) {
    throw new ApiError(401, failure);
  }

  if (!user.isVerified) {
    throw new ApiError(403, 'E-mail не подтверждён');
  }

  if (user.twoFactorEnabled) {
    return res.json({
      twoFactorRequired: true,
      tempToken: signTwoFactorToken(user, portal),
      message: `Введите 6-значный код из Google Authenticator: POST ${twoFactorPath}`,
    });
  }

  return res.json(sessionResponse(user));
};

const makeLoginTwoFactor = (portal) => async (req, res) => {
  const body = getBody(req);
  const decoded = verifyToken(requireString(body.tempToken, 'tempToken'), '2fa');
  const code = normalizeCode(body.code);

  const user = await User.findByPk(decoded.id);
  // токен должен быть выдан именно этим входом, а роль пользователя – подходить ему
  if (decoded.portal !== portal || !user || !user.isVerified || !user.twoFactorEnabled || !PORTALS[portal].roles.includes(user.role)) {
    throw new ApiError(401, 'Недействительный токен');
  }

  assertCodeResult(await twoFactor.verifyUserCode(user, code), 401);
  res.json(sessionResponse(user));
};

exports.login = makeLogin('site');
exports.doctorLogin = makeLogin('doctor');
exports.loginTwoFactor = makeLoginTwoFactor('site');
exports.doctorLoginTwoFactor = makeLoginTwoFactor('doctor');

//  Смена пароля 

exports.changePassword = async (req, res) => {
  const body = getBody(req);
  const currentPassword = requireString(body.currentPassword, 'currentPassword');
  const newPassword = requireString(body.newPassword, 'newPassword');

  const user = await User.findByPk(req.user.id);
  assertStrongPassword(newPassword, { email: user.email });

  if (!(await bcrypt.compare(currentPassword, user.passwordHash))) {
    throw new ApiError(403, 'Текущий пароль указан неверно');
  }
  if (await bcrypt.compare(newPassword, user.passwordHash)) {
    throw new ApiError(400, 'Новый пароль должен отличаться от текущего');
  }

  await user.update({
    passwordHash: await bcrypt.hash(newPassword, bcryptRounds),
    tokenVersion: user.tokenVersion + 1,
  });

  res.json({
    message: 'Пароль изменён. Все ранее выданные токены отозваны, используйте новый',
    ...sessionResponse(user),
  });
};

// ---------- Двухфакторная аутентификация (Google Authenticator) ----------

exports.twoFactorSetup = async (req, res) => {
  const user = await User.findByPk(req.user.id);
  if (user.twoFactorEnabled) {
    throw new ApiError(409, 'Двухфакторная аутентификация уже включена');
  }

  const secret = twoFactor.generateSecret();
  await user.update({ twoFactorSecret: encrypt(secret), twoFactorLastStep: null });

  const otpauthUrl = twoFactor.buildOtpauthUri(secret, user.email);
  res.json({
    message: 'Отсканируйте QR-код в Google Authenticator (или введите ключ вручную), затем подтвердите: POST /auth/2fa/enable',
    secret,
    otpauthUrl,
    qrCode: await twoFactor.toQrDataUrl(otpauthUrl),
  });
};

// QR-код в виде картинки (удобно открыть в Postman или браузере и отсканировать с экрана)
exports.twoFactorQr = async (req, res) => {
  const user = await User.findByPk(req.user.id);
  if (user.twoFactorEnabled) {
    throw new ApiError(409, 'Двухфакторная аутентификация уже включена');
  }
  if (!user.twoFactorSecret) {
    throw new ApiError(400, 'Сначала начните настройку двухфакторной защиты');
  }

  const secret = decrypt(user.twoFactorSecret);
  res.type('image/png').send(await twoFactor.toQrPng(twoFactor.buildOtpauthUri(secret, user.email)));
};

exports.twoFactorEnable = async (req, res) => {
  const code = normalizeCode(getBody(req).code);

  const user = await User.findByPk(req.user.id);
  if (user.twoFactorEnabled) {
    throw new ApiError(409, 'Двухфакторная аутентификация уже включена');
  }
  if (!user.twoFactorSecret) {
    throw new ApiError(400, 'Сначала начните настройку двухфакторной защиты');
  }

  assertCodeResult(await twoFactor.verifyUserCode(user, code), 400);
  await user.update({ twoFactorEnabled: true });

  res.json({ message: 'Двухфакторная аутентификация включена. При входе потребуется код из Google Authenticator', user });
};

exports.twoFactorDisable = async (req, res) => {
  const body = getBody(req);
  const password = requireString(body.password, 'password');
  const code = normalizeCode(body.code);

  const user = await User.findByPk(req.user.id);
  if (!user.twoFactorEnabled) {
    throw new ApiError(409, 'Двухфакторная аутентификация не включена');
  }
  if (!(await bcrypt.compare(password, user.passwordHash))) {
    throw new ApiError(403, 'Пароль указан неверно');
  }

  assertCodeResult(await twoFactor.verifyUserCode(user, code), 400);
  await user.update({ twoFactorEnabled: false, twoFactorSecret: null, twoFactorLastStep: null });

  res.json({ message: 'Двухфакторная аутентификация отключена', user });
};
