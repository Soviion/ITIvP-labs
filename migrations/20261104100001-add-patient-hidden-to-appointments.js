'use strict';

/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up(queryInterface, Sequelize) {
    // Пациент «удаляет» отменённые и прошедшие талоны из своего списка. Сама запись остаётся в клинике:
    // она нужна врачу (доступ к пациенту, история приёмов) и для отчётности, поэтому только скрывается от пациента.
    await queryInterface.addColumn('appointments', 'patient_hidden', {
      type: Sequelize.BOOLEAN,
      allowNull: false,
      defaultValue: false,
    });
  },

  async down(queryInterface) {
    await queryInterface.removeColumn('appointments', 'patient_hidden');
  },
};
