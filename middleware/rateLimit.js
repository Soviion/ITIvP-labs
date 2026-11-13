const rateLimit = require('express-rate-limit');
const ApiError = require('../utils/ApiError');

const create = ({ windowMs, limit, message, skipSuccessfulRequests = false, keyGenerator }) => rateLimit({
  windowMs,
  limit,
  skipSuccessfulRequests,
  ...(keyGenerator ? { keyGenerator } : {}),
  standardHeaders: 'draft-7',
  legacyHeaders: false,
  skip: () => process.env.RATE_LIMIT_DISABLED === 'true',
  handler: (req, res, next) => next(new ApiError(429, message)),
});

module.exports = {
  // ИИ-помощник для пациентов (без входа): ограничения по IP, чтобы не выжигали лимит бесплатной модели
  assistantBurst: create({ windowMs: 60 * 1000, limit: 6, message: 'Слишком много вопросов. Подождите минуту' }),
  assistantHourly: create({ windowMs: 60 * 60 * 1000, limit: 40, message: 'Вы задали много вопросов за час. Попробуйте позже или загляните в раздел «Контакты и FAQ»' }),
  // подсказка врачу: по врачу, а не по IP
  assistantDoctor: create({
    windowMs: 60 * 60 * 1000, limit: 20, message: 'Слишком много подсказок за час. Попробуйте позже', keyGenerator: (req) => `doctor:${req.user?.id ?? 'unknown'}`,
  }),
  // общий лимит на все маршруты /auth
  general: create({
    windowMs: 15 * 60 * 1000,
    limit: 100,
    message: 'Слишком много запросов. Повторите попытку через несколько минут',
  }),
  // подбор пароля и кода из приложения: считаются только неудачные попытки
  credentials: create({
    windowMs: 15 * 60 * 1000,
    limit: 10,
    skipSuccessfulRequests: true,
    message: 'Слишком много неудачных попыток. Повторите через 15 минут',
  }),
  // регистрация и повторная отправка писем
  mail: create({
    windowMs: 60 * 60 * 1000,
    limit: 10,
    message: 'Слишком много писем запрошено. Повторите через час',
  }),
};
