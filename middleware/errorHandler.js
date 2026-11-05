const {
  ValidationError,
  UniqueConstraintError,
  ForeignKeyConstraintError,
  ConnectionError,
} = require('sequelize');
const ApiError = require('../utils/ApiError');

const CONSTRAINT_MESSAGES = {
  appointments_doctor_slot_unique: 'Врач уже занят на это время',
  doctors_email_unique: 'Врач с таким e-mail уже существует',
  patients_insurance_number_unique: 'Пациент с таким номером полиса уже существует',
  queue_tickets_doctor_day_number_unique: 'Такой номер в очереди врача на эту дату уже занят',
  users_email_unique: 'Пользователь с таким e-mail уже зарегистрирован',
};

// Ошибки Mongoose приводим к тому же формату { error, details }, что и ошибки Sequelize
function mongooseToApiError(err) {
  if (err.name === 'ValidationError' && err.errors) {
    return new ApiError(400, 'Ошибка валидации данных', Object.values(err.errors).map((item) => ({ field: item.path, message: item.message })));
  }
  if (err.name === 'CastError') {
    return new ApiError(400, 'Некорректное значение в одном из полей');
  }
  if (err.code === 11000) {
    return new ApiError(409, 'Такая запись уже существует');
  }
  if (err.name === 'MongooseServerSelectionError' || err.name === 'MongoNetworkError') {
    return new ApiError(503, 'Личные дела временно недоступны. Повторите попытку позже');
  }
  return null;
}

function notFound(req, res, next) {
  next(new ApiError(404, 'Запрошенная страница или данные не найдены'));
}

function toApiError(err) {
  if (err instanceof ApiError) return err;

  const mongoError = mongooseToApiError(err);
  if (mongoError) return mongoError;

  if (err.type === 'entity.too.large') {
    return new ApiError(413, 'Файл или запрос слишком большой');
  }
  if (err.type === 'entity.parse.failed') {
    return new ApiError(400, 'Не удалось прочитать отправленные данные');
  }
  if (err instanceof UniqueConstraintError) {
    const message = CONSTRAINT_MESSAGES[err.parent?.constraint]
      || 'Такая запись уже существует';
    return new ApiError(409, message);
  }
  if (err instanceof ValidationError) {
    return new ApiError(
      400,
      'Ошибка валидации данных',
      err.errors.map((item) => ({ field: item.path, message: item.message })),
    );
  }
  if (err instanceof ForeignKeyConstraintError) {
    return new ApiError(409, 'Операция нарушает связи между данными: связанная запись не найдена или используется');
  }
  if (err instanceof ConnectionError) {
    return new ApiError(503, 'База данных недоступна');
  }
  return err;
}

function errorHandler(err, req, res, next) {
  const apiError = toApiError(err);
  const statusCode = apiError.statusCode || 500;

  if (statusCode >= 500) {
    console.error(err);
  }

  const body = { error: statusCode === 500 ? 'Внутренняя ошибка сервера' : apiError.message };
  if (apiError.details) body.details = apiError.details;
  res.status(statusCode).json(body);
}

module.exports = { notFound, errorHandler };
