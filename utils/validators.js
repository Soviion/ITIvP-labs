const ApiError = require('./ApiError');

// Готовые наборы валидаторов Sequelize 
const requiredText = (label, max) => ({
  notNull: { msg: `Поле «${label}» обязательно` },
  notEmpty: { msg: `Поле «${label}» не может быть пустым` },
  ...(max && { len: { args: [1, max], msg: `Поле «${label}» должно содержать не более ${max} символов` } }),
});

const optionalText = (label, max) => ({
  len: { args: [0, max], msg: `Поле «${label}» должно содержать не более ${max} символов` },
});

const integer = (label, min = 1) => ({
  isInt: { msg: `Поле «${label}» должно быть целым числом` },
  min: { args: [min], msg: `Поле «${label}» должно быть не меньше ${min}` },
});

const requiredId = (label) => ({
  notNull: { msg: `Поле «${label}» обязательно` },
  ...integer(label),
});

const isDate = (label) => ({
  isDate: { msg: `Поле «${label}» должно быть корректной датой` },
});

async function ensureExists(Model, id, field, label) {
  if (!Number.isInteger(id) || id < 1) {
    throw new ApiError(400, `Поле "${field}" должно быть положительным целым числом`);
  }
  if (!(await Model.count({ where: { id } }))) {
    throw new ApiError(400, `${label} с id=${id} не найден`);
  }
}

module.exports = { requiredText, optionalText, integer, requiredId, isDate, ensureExists };
