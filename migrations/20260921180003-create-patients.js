'use strict';

/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.createTable('patients', {
      id: { type: Sequelize.INTEGER, primaryKey: true, autoIncrement: true, allowNull: false },
      last_name: { type: Sequelize.STRING(60), allowNull: false },
      first_name: { type: Sequelize.STRING(60), allowNull: false },
      middle_name: { type: Sequelize.STRING(60), allowNull: true },
      birth_date: { type: Sequelize.DATEONLY, allowNull: false },
      gender: { type: Sequelize.ENUM('male', 'female'), allowNull: false },
      phone: { type: Sequelize.STRING(20), allowNull: false },
      email: { type: Sequelize.STRING(120), allowNull: true },
      address: { type: Sequelize.STRING(255), allowNull: true },
      insurance_number: { type: Sequelize.STRING(30), allowNull: true },
      created_at: { type: Sequelize.DATE, allowNull: false, defaultValue: Sequelize.literal('CURRENT_TIMESTAMP') },
      updated_at: { type: Sequelize.DATE, allowNull: false, defaultValue: Sequelize.literal('CURRENT_TIMESTAMP') },
      deleted_at: { type: Sequelize.DATE, allowNull: true },
    });

    // Номер полиса уникален среди неудалённых пациентов (NULL-значения не конфликтуют)
    await queryInterface.sequelize.query(
      'CREATE UNIQUE INDEX patients_insurance_number_unique ON patients (insurance_number) WHERE deleted_at IS NULL',
    );
    await queryInterface.addIndex('patients', ['last_name', 'first_name'], { name: 'patients_full_name_idx' });
  },

  async down(queryInterface) {
    await queryInterface.dropTable('patients');
    await queryInterface.sequelize.query('DROP TYPE IF EXISTS "enum_patients_gender"');
  },
};
