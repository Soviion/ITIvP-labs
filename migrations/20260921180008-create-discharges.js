'use strict';

/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.createTable('discharges', {
      id: { type: Sequelize.INTEGER, primaryKey: true, autoIncrement: true, allowNull: false },
      medical_record_id: {
        type: Sequelize.INTEGER,
        allowNull: false,
        references: { model: 'medical_records', key: 'id' },
        onUpdate: 'CASCADE',
        onDelete: 'RESTRICT',
      },
      doctor_id: {
        type: Sequelize.INTEGER,
        allowNull: false,
        references: { model: 'doctors', key: 'id' },
        onUpdate: 'CASCADE',
        onDelete: 'RESTRICT',
      },
      entry_id: {
        type: Sequelize.INTEGER,
        allowNull: true,
        references: { model: 'medical_entries', key: 'id' },
        onUpdate: 'CASCADE',
        onDelete: 'SET NULL',
      },
      issued_on: { type: Sequelize.DATEONLY, allowNull: false },
      final_diagnosis: { type: Sequelize.TEXT, allowNull: false },
      recommendations: { type: Sequelize.TEXT, allowNull: true },
      sick_leave_from: { type: Sequelize.DATEONLY, allowNull: true },
      sick_leave_to: { type: Sequelize.DATEONLY, allowNull: true },
      created_at: { type: Sequelize.DATE, allowNull: false, defaultValue: Sequelize.literal('CURRENT_TIMESTAMP') },
      updated_at: { type: Sequelize.DATE, allowNull: false, defaultValue: Sequelize.literal('CURRENT_TIMESTAMP') },
    });

    await queryInterface.addIndex('discharges', ['medical_record_id'], { name: 'discharges_record_id_idx' });
    await queryInterface.addIndex('discharges', ['doctor_id'], { name: 'discharges_doctor_id_idx' });
    await queryInterface.sequelize.query(
      'ALTER TABLE discharges ADD CONSTRAINT discharges_sick_leave_range CHECK '
      + '(sick_leave_from IS NULL OR sick_leave_to IS NULL OR sick_leave_to >= sick_leave_from)',
    );
  },

  async down(queryInterface) {
    await queryInterface.dropTable('discharges');
  },
};
