const jwt = require('jsonwebtoken');
const config = require('../config/auth');
const ApiError = require('../utils/ApiError');

const baseOptions = { algorithm: config.jwt.algorithm };

// tv (tokenVersion) позволяет отозвать все выданные токены  при смене пароля
function signAccessToken(user) {
  return jwt.sign(
    { id: user.id, email: user.email, tv: user.tokenVersion, scope: 'access' },
    config.jwt.secret,
    { ...baseOptions, expiresIn: config.jwt.expiresIn },
  );
}

// portal — для какого входа выдан временный токен: 'site' («Твой талон») или 'doctor' («Моя клиника»).
// Токен одного входа не подходит для подтверждения кода в другом.
function signTwoFactorToken(user, portal) {
  return jwt.sign(
    { id: user.id, scope: '2fa', portal },
    config.jwt.secret,
    { ...baseOptions, expiresIn: config.jwt.twoFactorExpiresIn },
  );
}

// Выдаётся после подтверждения почты кодом и позволяет завершить регистрацию (30 минут)
function signRegistrationToken(email) {
  return jwt.sign({ email, scope: 'register' }, config.jwt.secret, { ...baseOptions, expiresIn: '30m' });
}

// scope не даёт использовать временный токен 2FA как обычный access-токен и наоборот
function verifyToken(token, expectedScope) {
  let decoded;
  try {
    decoded = jwt.verify(token, config.jwt.secret, { algorithms: [config.jwt.algorithm] });
  } catch (err) {
    if (err instanceof jwt.TokenExpiredError) {
      throw new ApiError(401, 'Срок действия токена истёк. Выполните вход заново');
    }
    throw new ApiError(401, 'Недействительный токен');
  }
  if (decoded.scope !== expectedScope) {
    throw new ApiError(401, 'Недействительный токен');
  }
  return decoded;
}

module.exports = { signAccessToken, signTwoFactorToken, signRegistrationToken, verifyToken };
