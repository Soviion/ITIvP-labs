const ApiError = require('../utils/ApiError');
const { isEnabled, isConnected } = require('../config/mongo');

// Пока MongoDB не подключена, маршруты /mongo/* отвечают 503, а остальной API работает как обычно
module.exports = (req, res, next) => {
  if (!isEnabled()) return next(new ApiError(503, 'Личные дела отключены в настройках сервера'));
  if (!isConnected()) return next(new ApiError(503, 'Личные дела временно недоступны. Повторите попытку позже'));
  return next();
};
