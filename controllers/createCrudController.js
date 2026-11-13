const ApiError = require('../utils/ApiError');
const { parseId, getBody, pick } = require('../utils/request');

function assertRequired(data, required) {
  const missing = required.filter((field) => data[field] === undefined || data[field] === null || data[field] === '');
  if (missing.length) {
    throw new ApiError(
      400,
      'Не заполнены обязательные поля',
      missing.map((field) => ({ field, message: 'Поле обязательно' })),
    );
  }
}
 // cобирает стандартные CRUD обработчики поверх модели Sequelize.
 // fields поля, которые клиент может передавать - разрешенные
 // required  обязательные поля для POST и PUT иначе 400 
 // prepare проверка входных данных даты, вторичных ключей
 
module.exports = function createCrudController({
  Model,
  itemKey,
  messages,
  fields,
  required,
  include = [],
  order = [['id', 'ASC']],
  prepare = async (data) => data,
  // вызывается после успешного изменения: action — created | updated | deleted, before — значения до изменения.
  // Нужен, чтобы сообщить об изменении другим частям системы (например, живым спискам), не усложняя сам контроллер
  onChange = () => {},
}) {
  const findOrFail = async (id) => {
    const row = await Model.findByPk(id, { include });
    if (!row) throw new ApiError(404, messages.notFound(id));
    return row;
  };

  // PUT - необязательные поля которых нет в теле запроса - устанавливаются по умолчанию из модели или null
  const withDefaults = (data) => {
    const attributes = Model.getAttributes();
    const result = { ...data };
    fields.forEach((field) => {
      if (result[field] === undefined) {
        const { defaultValue } = attributes[field];
        result[field] = defaultValue === undefined ? null : defaultValue;
      }
    });
    return result;
  };

  return {
    getAll: async (req, res) => {
      res.json(await Model.findAll({ include, order }));
    },

    getById: async (req, res) => {
      res.json(await findOrFail(parseId(req)));
    },

    create: async (req, res) => {
      const picked = pick(getBody(req), fields);
      assertRequired(picked, required);
      const data = await prepare(picked);

      const created = await Model.sequelize.transaction((transaction) => Model.create(data, { transaction }));
      const row = await findOrFail(created.id);
      onChange('created', row);
      res.status(201).json(row);
    },

    update: async (req, res) => {
      const id = parseId(req);
      const row = await findOrFail(id);
      const picked = pick(getBody(req), fields);
      assertRequired(picked, required);
      const data = await prepare(withDefaults(picked));

      const before = row.get({ plain: true });
      await row.update(data);
      const fresh = await findOrFail(id);
      onChange('updated', fresh, before);
      res.json(fresh);
    },

    patch: async (req, res) => {
      const id = parseId(req);
      const row = await findOrFail(id);
      const picked = pick(getBody(req), fields);
      if (!Object.keys(picked).length) {
        throw new ApiError(400, `Не переданы поля для обновления. Допустимые поля: ${fields.join(', ')}`);
      }
      const data = await prepare(picked);

      const before = row.get({ plain: true });
      await row.update(data);
      const fresh = await findOrFail(id);
      onChange('updated', fresh, before);
      res.json(fresh);
    },

    remove: async (req, res) => {
      const row = await findOrFail(parseId(req));
      await row.destroy();
      onChange('deleted', row);
      res.json({ message: messages.deleted, [itemKey]: row });
    },
  };
};
