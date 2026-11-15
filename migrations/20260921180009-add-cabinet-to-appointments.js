'use strict';

/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.addColumn('appointments', 'cabinet', {
      type: Sequelize.STRING(10),
      allowNull: true,
    });
  },

  async down(queryInterface) {
    await queryInterface.removeColumn('appointments', 'cabinet');
  },
};
