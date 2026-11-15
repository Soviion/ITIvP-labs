'use strict';

const { seedTable } = require('../utils/seedHelpers');

const rows = [
  { id: 1, medical_record_id: 1, appointment_id: 1, doctor_id: 1, complaints: 'Жалоб нет, плановый осмотр', diagnosis: 'Практически здоров', icd_code: 'Z00.0', treatment: 'Рекомендации по режиму дня и питанию', prescriptions: null },
  { id: 2, medical_record_id: 2, appointment_id: 2, doctor_id: 3, complaints: 'Периодические боли в груди при физической нагрузке', diagnosis: 'Стенокардия напряжения', icd_code: 'I20.8', treatment: 'Диета, ограничение физических нагрузок', prescriptions: 'Нитроглицерин 0,5 мг под язык при болях' },
  { id: 3, medical_record_id: 3, appointment_id: 3, doctor_id: 1, complaints: 'Кашель, температура 37,5 в течение трёх дней', diagnosis: 'Острый бронхит', icd_code: 'J20.9', treatment: 'Обильное питьё, постельный режим 5 дней', prescriptions: 'Амброксол 30 мг 3 раза в сутки, 7 дней' },
  { id: 4, medical_record_id: 4, appointment_id: 4, doctor_id: 5, complaints: 'Снижение остроты зрения вдаль', diagnosis: 'Миопия слабой степени', icd_code: 'H52.1', treatment: 'Подбор очков', prescriptions: null },
];

/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up(queryInterface) {
    await seedTable(queryInterface, 'medical_entries', rows);
  },

  async down(queryInterface) {
    await queryInterface.bulkDelete('medical_entries', { id: rows.map((row) => row.id) });
  },
};
