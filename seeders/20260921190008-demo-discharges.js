'use strict';

const { seedTable } = require('../utils/seedHelpers');

const rows = [
  { id: 1, medical_record_id: 3, doctor_id: 1, entry_id: 3, issued_on: '2026-09-18', final_diagnosis: 'Острый бронхит, лёгкое течение', recommendations: 'Избегать переохлаждения, при ухудшении состояния повторно обратиться к врачу', sick_leave_from: '2026-09-18', sick_leave_to: '2026-09-23' },
  { id: 2, medical_record_id: 2, doctor_id: 3, entry_id: 2, issued_on: '2026-09-17', final_diagnosis: 'Стенокардия напряжения, стабильное течение', recommendations: 'Наблюдение кардиолога, контрольная ЭКГ через месяц', sick_leave_from: null, sick_leave_to: null },
];

/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up(queryInterface) {
    await seedTable(queryInterface, 'discharges', rows);
  },

  async down(queryInterface) {
    await queryInterface.bulkDelete('discharges', { id: rows.map((row) => row.id) });
  },
};
