'use strict';

const { seedTable } = require('../utils/seedHelpers');

const rows = [
  { id: 1, last_name: 'Иванов', first_name: 'Иван', middle_name: 'Иванович', birth_date: '1985-03-14', gender: 'male', phone: '+375 29 200-00-01', email: 'ivanov@example.by', address: 'г. Минск, ул. Ленина, 10-25', insurance_number: 'BY-100001' },
  { id: 2, last_name: 'Сидорова', first_name: 'Мария', middle_name: 'Александровна', birth_date: '1992-07-22', gender: 'female', phone: '+375 29 200-00-02', email: 'sidorova@example.by', address: 'г. Минск, пр. Независимости, 45-12', insurance_number: 'BY-100002' },
  { id: 3, last_name: 'Смирнов', first_name: 'Пётр', middle_name: 'Николаевич', birth_date: '1978-11-05', gender: 'male', phone: '+375 33 200-00-03', email: null, address: 'г. Минск, ул. Притыцкого, 78-3', insurance_number: 'BY-100003' },
  { id: 4, last_name: 'Козлова', first_name: 'Анна', middle_name: 'Викторовна', birth_date: '1999-01-30', gender: 'female', phone: '+375 44 200-00-04', email: 'kozlova@example.by', address: 'г. Минск, ул. Одинцова, 15-90', insurance_number: null },
  { id: 5, last_name: 'Волков', first_name: 'Артём', middle_name: 'Сергеевич', birth_date: '2015-09-12', gender: 'male', phone: '+375 29 200-00-05', email: null, address: 'г. Минск, ул. Мележа, 5-14', insurance_number: 'BY-100005' },
  { id: 6, last_name: 'Новикова', first_name: 'Ольга', middle_name: 'Петровна', birth_date: '1965-05-18', gender: 'female', phone: '+375 25 200-00-06', email: 'novikova@example.by', address: 'г. Минск, ул. Кальварийская, 22-7', insurance_number: 'BY-100006' },
  { id: 7, last_name: 'Захаров', first_name: 'Максим', middle_name: 'Дмитриевич', birth_date: '1990-12-02', gender: 'male', phone: '+375 29 200-00-07', email: 'zaharov@example.by', address: 'г. Минск, ул. Тимирязева, 67-31', insurance_number: 'BY-100007' },
  { id: 8, last_name: 'Белова', first_name: 'Екатерина', middle_name: 'Игоревна', birth_date: '2001-04-27', gender: 'female', phone: '+375 44 200-00-08', email: 'belova@example.by', address: 'г. Минск, ул. Байкальская, 9-48', insurance_number: null },
];

/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up(queryInterface) {
    await seedTable(queryInterface, 'patients', rows);
  },

  async down(queryInterface) {
    await queryInterface.bulkDelete('patients', { id: rows.map((row) => row.id) });
  },
};
