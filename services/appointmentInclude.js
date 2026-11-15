const { Patient, Doctor, Specialty } = require('../models');

// Какие связанные данные отдаём вместе с записью на приём.
// paranoid: false — в истории остаются данные удалённых (архивных) пациентов и врачей.
module.exports = () => [
  {
    model: Patient,
    as: 'patient',
    attributes: ['id', 'lastName', 'firstName', 'middleName'],
    paranoid: false,
  },
  {
    model: Doctor,
    as: 'doctor',
    attributes: ['id', 'lastName', 'firstName', 'middleName'],
    paranoid: false,
    include: [{ model: Specialty, as: 'specialty', attributes: ['id', 'name'] }],
  },
];
