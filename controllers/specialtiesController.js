const { Specialty } = require('../models');
const createCrudController = require('./createCrudController');

// cправочник специальностей  отдаются только GET-маршруты
module.exports = createCrudController({
  Model: Specialty,
  itemKey: 'specialty',
  messages: {
    notFound: (id) => `Специальность с id=${id} не найдена`,
    deleted: 'Специальность удалена',
  },
  fields: ['name'],
  required: ['name'],
  order: [['name', 'ASC']],
});
