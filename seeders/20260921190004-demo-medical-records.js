'use strict';

const { seedTable } = require('../utils/seedHelpers');

const rows = [
  { id: 1, patient_id: 1, card_number: 'MK-2026-0001', blood_type: 'A+', allergies: null, chronic_diseases: null, notes: null },
  { id: 2, patient_id: 2, card_number: 'MK-2026-0002', blood_type: 'O+', allergies: 'Пенициллин', chronic_diseases: null, notes: 'Наблюдается у кардиолога' },
  { id: 3, patient_id: 3, card_number: 'MK-2026-0003', blood_type: 'B+', allergies: null, chronic_diseases: 'Хронический гастрит', notes: null },
  { id: 4, patient_id: 4, card_number: 'MK-2026-0004', blood_type: 'O-', allergies: null, chronic_diseases: null, notes: null },
  { id: 5, patient_id: 5, card_number: 'MK-2026-0005', blood_type: 'A-', allergies: 'Цитрусовые', chronic_diseases: null, notes: 'Детская карта' },
  { id: 6, patient_id: 6, card_number: 'MK-2026-0006', blood_type: 'AB+', allergies: 'Пыльца берёзы', chronic_diseases: 'Гипертоническая болезнь II ст.', notes: null },
  { id: 7, patient_id: 7, card_number: 'MK-2026-0007', blood_type: 'B-', allergies: null, chronic_diseases: null, notes: null },
  { id: 8, patient_id: 8, card_number: 'MK-2026-0008', blood_type: 'A+', allergies: 'Латекс', chronic_diseases: null, notes: null },
];

/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up(queryInterface) {
    await seedTable(queryInterface, 'medical_records', rows);
  },

  async down(queryInterface) {
    await queryInterface.bulkDelete('medical_records', { id: rows.map((row) => row.id) });
  },
};
