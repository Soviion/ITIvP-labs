const { Patient, MedicalRecord } = require('../models');
const createCrudController = require('./createCrudController');
const { fromDisplayDate } = require('../utils/dates');

module.exports = createCrudController({
  Model: Patient,
  itemKey: 'patient',
  messages: {
    notFound: (id) => `Пациент с id=${id} не найден`,
    deleted: 'Пациент удалён (перенесён в архив)',
  },
  fields: [
    'lastName', 'firstName', 'middleName', 'birthDate', 'gender',
    'phone', 'email', 'address', 'insuranceNumber', 'socialStatus', 'workplace', 'trustedPerson',
  ],
  required: ['lastName', 'firstName', 'birthDate', 'gender', 'phone'],
  include: [{ model: MedicalRecord, as: 'medicalRecord', attributes: ['id', 'cardNumber'] }],
  async prepare(data) {
    if (data.birthDate != null) data.birthDate = fromDisplayDate(data.birthDate, 'birthDate');
    return data;
  },
});
