'use strict';

/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up(queryInterface, Sequelize) {
    // Когда пациент последний раз менял группу крови: менять её можно не чаще раза в неделю
    await queryInterface.addColumn('medical_records', 'blood_type_changed_at', { type: Sequelize.DATE, allowNull: true });
  },

  async down(queryInterface) {
    await queryInterface.removeColumn('medical_records', 'blood_type_changed_at');
  },
};
