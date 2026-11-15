'use strict';

/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.createTable('appointments', {
      id: { type: Sequelize.INTEGER, primaryKey: true, autoIncrement: true, allowNull: false },
      patient_id: {
        type: Sequelize.INTEGER,
        allowNull: false,
        references: { model: 'patients', key: 'id' },
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
      date: { type: Sequelize.DATEONLY, allowNull: false },
      time: { type: Sequelize.TIME, allowNull: false },
      duration_minutes: { type: Sequelize.INTEGER, allowNull: false, defaultValue: 30 },
      reason: { type: Sequelize.TEXT, allowNull: true },
      status: {
        type: Sequelize.ENUM('scheduled', 'completed', 'cancelled', 'no_show'),
        allowNull: false,
        defaultValue: 'scheduled',
      },
      created_at: { type: Sequelize.DATE, allowNull: false, defaultValue: Sequelize.literal('CURRENT_TIMESTAMP') },
      updated_at: { type: Sequelize.DATE, allowNull: false, defaultValue: Sequelize.literal('CURRENT_TIMESTAMP') },
    });

    await queryInterface.addIndex('appointments', ['patient_id'], { name: 'appointments_patient_id_idx' });
    await queryInterface.addIndex('appointments', ['doctor_id', 'date'], { name: 'appointments_doctor_date_idx' });
    // Врач не может быть записан дважды на одно время (отменённые записи слот не занимают)
    await queryInterface.sequelize.query(
      "CREATE UNIQUE INDEX appointments_doctor_slot_unique ON appointments (doctor_id, date, time) WHERE status <> 'cancelled'",
    );
    await queryInterface.sequelize.query(
      'ALTER TABLE appointments ADD CONSTRAINT appointments_duration_positive CHECK (duration_minutes > 0)',
    );
  },

  async down(queryInterface) {
    await queryInterface.dropTable('appointments');
    await queryInterface.sequelize.query('DROP TYPE IF EXISTS "enum_appointments_status"');
  },
};
