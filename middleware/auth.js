const { User } = require('../models');
const ApiError = require('../utils/ApiError');
const { verifyToken } = require('../services/tokens');

module.exports = async function auth(req, res, next) {
  try {
    const match = /^Bearer\s+(\S+)$/i.exec(req.headers.authorization || '');
    if (!match) {
      throw new ApiError(401, 'Войдите в аккаунт, чтобы продолжить');
    }
    // вызов проверки токена и расшифровки payload
    const decoded = verifyToken(match[1], 'access');

    const user = await User.findByPk(decoded.id, { attributes: ['id', 'isVerified', 'tokenVersion', 'role'] }); 
    if (!user || !user.isVerified || user.tokenVersion !== decoded.tv) {
      throw new ApiError(401, 'Токен больше не действителен. Выполните вход заново');
    }

    req.user = { ...decoded, role: user.role };
    next(); 
  } catch (err) {
    if (err instanceof ApiError && err.statusCode === 401) {
      res.set('WWW-Authenticate', 'Bearer');
    }
    next(err);
  }
};
