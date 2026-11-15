'use strict';

const { seedTable } = require('../utils/seedHelpers');

const rows = [
  { id: 1, doctor_id: 1, patient_id: 1, appointment_id: 1, queue_date: '2026-09-17', number: 1, priority: 'normal', status: 'done', called_at: new Date('2026-09-17T06:28:00Z'), finished_at: new Date('2026-09-17T06:52:00Z') },
  { id: 2, doctor_id: 1, patient_id: 1, appointment_id: 5, queue_date: '2026-09-22', number: 1, priority: 'normal', status: 'waiting', called_at: null, finished_at: null },
  { id: 3, doctor_id: 4, patient_id: 2, appointment_id: 6, queue_date: '2026-09-22', number: 1, priority: 'normal', status: 'waiting', called_at: null, finished_at: null },
  { id: 4, doctor_id: 6, patient_id: 5, appointment_id: 7, queue_date: '2026-09-22', number: 1, priority: 'normal', status: 'called', called_at: new Date('2026-09-22T08:58:00Z'), finished_at: null },
  { id: 5, doctor_id: 1, patient_id: 7, appointment_id: null, queue_date: '2026-09-22', number: 2, priority: 'urgent', status: 'waiting', called_at: null, finished_at: null },
];

/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up(queryInterface) {
    await seedTable(queryInterface, 'queue_tickets', rows);
  },

  async down(queryInterface) {
    await queryInterface.bulkDelete('queue_tickets', { id: rows.map((row) => row.id) });
  },
};
