import { api } from './api';
import { toApiProfile } from './utils/patient';

// Запросы без токена (вход, регистрация): старый токен в localStorage не подставляем.
// Повторы отключаем: неверный пароль или код повторять бессмысленно, а письма нельзя дублировать.
const anonymous = { skipAuth: true, retry: false };
const once = { retry: false };

// ---------- Регистрация пациента: код из письма → анкета и пароль ----------

export const registerStart = (email) => api
  .post('/auth/register/start', { email }, anonymous)
  .then(({ data }) => data);

// Верный код возвращает registrationToken — с ним можно завершить регистрацию
export const registerVerify = (email, code) => api
  .post('/auth/register/verify', { email, code }, anonymous)
  .then(({ data }) => data);

export const registerComplete = (registrationToken, profile, password) => api
  .post('/auth/register/complete', { registrationToken, ...toApiProfile(profile), password }, anonymous)
  .then(({ data }) => data);

// ---------- Вход ----------

// Ответ: либо { token, user }, либо { twoFactorRequired: true, tempToken }
// login — почта или телефон в формате +375(44)4444444
export const login = (login, password) => api
  .post('/auth/login', { login, password }, anonymous)
  .then(({ data }) => data);

export const loginTwoFactor = (tempToken, code) => api
  .post('/auth/login/2fa', { tempToken, code }, anonymous)
  .then(({ data }) => data);

// ---------- Настройки ----------

export const changePassword = (currentPassword, newPassword) => api
  .post('/auth/change-password', { currentPassword, newPassword }, once)
  .then(({ data }) => data);

export const emailChangeStart = (newEmail, password) => api
  .post('/me/email/start', { newEmail, password }, once)
  .then(({ data }) => data);

export const emailChangeConfirm = (newEmail, code) => api
  .post('/me/email/confirm', { newEmail, code }, once)
  .then(({ data }) => data);

// Google Authenticator: setup → { secret, otpauthUrl, qrCode }, затем enable с кодом из приложения
export const setupTwoFactor = () => api.post('/auth/2fa/setup', null, once).then(({ data }) => data);

export const enableTwoFactor = (code) => api.post('/auth/2fa/enable', { code }, once).then(({ data }) => data);

export const disableTwoFactor = (password, code) => api
  .post('/auth/2fa/disable', { password, code }, once)
  .then(({ data }) => data);
