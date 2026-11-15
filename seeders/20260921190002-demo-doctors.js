'use strict';

const { seedTable } = require('../utils/seedHelpers');

const rows = [
  { id: 1, specialty_id: 1, last_name: 'Петрова', first_name: 'Анна', middle_name: 'Сергеевна', phone: '+375 29 111-11-01', email: 'a.petrova@clinic.by', is_active: true },
  { id: 2, specialty_id: 2, last_name: 'Кузнецов', first_name: 'Виктор', middle_name: 'Владимирович', phone: '+375 29 111-11-02', email: 'v.kuznetsov@clinic.by', is_active: true },
  { id: 3, specialty_id: 3, last_name: 'Лебедева', first_name: 'Ирина', middle_name: 'Павловна', phone: '+375 29 111-11-03', email: 'i.lebedeva@clinic.by', is_active: true },
  { id: 4, specialty_id: 4, last_name: 'Соколов', first_name: 'Дмитрий', middle_name: 'Андреевич', phone: '+375 29 111-11-04', email: 'd.sokolov@clinic.by', is_active: true },
  { id: 5, specialty_id: 5, last_name: 'Мороз', first_name: 'Елена', middle_name: 'Николаевна', phone: '+375 29 111-11-05', email: 'e.moroz@clinic.by', is_active: true },
  { id: 6, specialty_id: 6, last_name: 'Ковалёв', first_name: 'Александр', middle_name: 'Игоревич', phone: '+375 29 111-11-06', email: 'a.kovalev@clinic.by', is_active: true },
];

/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up(queryInterface) {
    await seedTable(queryInterface, 'doctors', rows);
  },

  async down(queryInterface) {
    await queryInterface.bulkDelete('doctors', { id: rows.map((row) => row.id) });
  },
};
