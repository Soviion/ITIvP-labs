'use strict';

const { seedTable } = require('../utils/seedHelpers');

const rows = [
  { id: 1, patient_id: 1, doctor_id: 1, date: '2026-09-17', time: '09:30', duration_minutes: 30, reason: 'Плановый осмотр', status: 'completed', cabinet: '204' },
  { id: 2, patient_id: 2, doctor_id: 3, date: '2026-09-17', time: '10:00', duration_minutes: 30, reason: 'Боли в области сердца при нагрузке', status: 'completed', cabinet: '312' },
  { id: 3, patient_id: 3, doctor_id: 1, date: '2026-09-18', time: '14:15', duration_minutes: 30, reason: 'Кашель, повышенная температура', status: 'completed', cabinet: '204' },
  { id: 4, patient_id: 4, doctor_id: 5, date: '2026-09-18', time: '11:00', duration_minutes: 20, reason: 'Снижение остроты зрения', status: 'completed', cabinet: '118' },
  { id: 5, patient_id: 1, doctor_id: 1, date: '2026-09-22', time: '09:30', duration_minutes: 30, reason: 'Контрольный осмотр', status: 'scheduled', cabinet: '204' },
  { id: 6, patient_id: 2, doctor_id: 4, date: '2026-09-22', time: '10:30', duration_minutes: 45, reason: 'Головные боли', status: 'scheduled', cabinet: '215' },
  { id: 7, patient_id: 5, doctor_id: 6, date: '2026-09-22', time: '12:00', duration_minutes: 30, reason: 'Профилактический осмотр ребёнка', status: 'scheduled', cabinet: '105' },
  { id: 8, patient_id: 6, doctor_id: 3, date: '2026-09-23', time: '15:00', duration_minutes: 30, reason: 'Консультация кардиолога', status: 'scheduled', cabinet: '312' },
  { id: 9, patient_id: 7, doctor_id: 2, date: '2026-09-23', time: '16:30', duration_minutes: 60, reason: 'Осмотр перед операцией', status: 'scheduled', cabinet: '301' },
  { id: 10, patient_id: 8, doctor_id: 1, date: '2026-09-24', time: '09:00', duration_minutes: 30, reason: 'Справка', status: 'cancelled', cabinet: '204' },
  { id: 11, patient_id: 3, doctor_id: 2, date: '2026-09-19', time: '13:00', duration_minutes: 30, reason: 'Боль в колене', status: 'no_show', cabinet: '301' },
];

/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up(queryInterface) {
    await seedTable(queryInterface, 'appointments', rows);
  },

  async down(queryInterface) {
    await queryInterface.bulkDelete('appointments', { id: rows.map((row) => row.id) });
  },
};
