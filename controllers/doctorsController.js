const { Doctor, Specialty } = require('../models');
const createCrudController = require('./createCrudController');
const { ensureExists } = require('../utils/validators');

module.exports = createCrudController({
  Model: Doctor,
  itemKey: 'doctor',
  messages: {
    notFound: (id) => `Врач с id=${id} не найден`,
    deleted: 'Врач удалён (перенесён в архив)',
  },
  fields: ['specialtyId', 'lastName', 'firstName', 'middleName', 'phone', 'email', 'isActive'],
  required: ['specialtyId', 'lastName', 'firstName', 'phone', 'email'],
  include: [{ model: Specialty, as: 'specialty', attributes: ['id', 'name'] }],
  async prepare(data) {
    if (data.specialtyId != null) {
      await ensureExists(Specialty, data.specialtyId, 'specialtyId', 'Специальность');
    }
    return data;
  },
});
