'use strict';

const { seedTable } = require('../utils/seedHelpers');

const rows = [
  { id: 1, name: 'Терапевт' },
  { id: 2, name: 'Хирург' },
  { id: 3, name: 'Кардиолог' },
  { id: 4, name: 'Невролог' },
  { id: 5, name: 'Офтальмолог' },
  { id: 6, name: 'Педиатр' },
];

/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up(queryInterface) {
    await seedTable(queryInterface, 'specialties', rows);
  },

  async down(queryInterface) {
    await queryInterface.bulkDelete('specialties', { id: rows.map((row) => row.id) });
  },
};
