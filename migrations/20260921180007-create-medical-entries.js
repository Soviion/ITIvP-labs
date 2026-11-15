'use strict';

/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.createTable('medical_entries', {
      id: { type: Sequelize.INTEGER, primaryKey: true, autoIncrement: true, allowNull: false },
      medical_record_id: {
        type: Sequelize.INTEGER,
        allowNull: false,
        references: { model: 'medical_records', key: 'id' },
        onUpdate: 'CASCADE',
        onDelete: 'RESTRICT',
      },
      appointment_id: {
        type: Sequelize.INTEGER,
        allowNull: true,
        unique: true,
        references: { model: 'appointments', key: 'id' },
        onUpdate: 'CASCADE',
        onDelete: 'SET NULL',
      },
      doctor_id: {
        type: Sequelize.INTEGER,
        allowNull: false,
        references: { model: 'doctors', key: 'id' },
        onUpdate: 'CASCADE',
        onDelete: 'RESTRICT',
      },
      complaints: { type: Sequelize.TEXT, allowNull: false },
      diagnosis: { type: Sequelize.TEXT, allowNull: false },
      icd_code: { type: Sequelize.STRING(10), allowNull: true },
      treatment: { type: Sequelize.TEXT, allowNull: true },
      prescriptions: { type: Sequelize.TEXT, allowNull: true },
      created_at: { type: Sequelize.DATE, allowNull: false, defaultValue: Sequelize.literal('CURRENT_TIMESTAMP') },
      updated_at: { type: Sequelize.DATE, allowNull: false, defaultValue: Sequelize.literal('CURRENT_TIMESTAMP') },
    });

    await queryInterface.addIndex('medical_entries', ['medical_record_id'], { name: 'medical_entries_record_id_idx' });
    await queryInterface.addIndex('medical_entries', ['doctor_id'], { name: 'medical_entries_doctor_id_idx' });
  },

  async down(queryInterface) {
    await queryInterface.dropTable('medical_entries');
  },
};
