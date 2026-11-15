'use strict';

/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.createTable('queue_tickets', {
      id: { type: Sequelize.INTEGER, primaryKey: true, autoIncrement: true, allowNull: false },
      doctor_id: {
        type: Sequelize.INTEGER,
        allowNull: false,
        references: { model: 'doctors', key: 'id' },
        onUpdate: 'CASCADE',
        onDelete: 'RESTRICT',
      },
      patient_id: {
        type: Sequelize.INTEGER,
        allowNull: false,
        references: { model: 'patients', key: 'id' },
        onUpdate: 'CASCADE',
        onDelete: 'RESTRICT',
      },
      appointment_id: {
        type: Sequelize.INTEGER,
        allowNull: true,
        references: { model: 'appointments', key: 'id' },
        onUpdate: 'CASCADE',
        onDelete: 'SET NULL',
      },
      queue_date: { type: Sequelize.DATEONLY, allowNull: false },
      number: { type: Sequelize.INTEGER, allowNull: false },
      priority: { type: Sequelize.ENUM('normal', 'urgent'), allowNull: false, defaultValue: 'normal' },
      status: {
        type: Sequelize.ENUM('waiting', 'called', 'in_progress', 'done', 'skipped'),
        allowNull: false,
        defaultValue: 'waiting',
      },
      called_at: { type: Sequelize.DATE, allowNull: true },
      finished_at: { type: Sequelize.DATE, allowNull: true },
      created_at: { type: Sequelize.DATE, allowNull: false, defaultValue: Sequelize.literal('CURRENT_TIMESTAMP') },
      updated_at: { type: Sequelize.DATE, allowNull: false, defaultValue: Sequelize.literal('CURRENT_TIMESTAMP') },
    });

    await queryInterface.addIndex('queue_tickets', ['doctor_id', 'queue_date', 'number'], {
      name: 'queue_tickets_doctor_day_number_unique',
      unique: true,
    });
    await queryInterface.addIndex('queue_tickets', ['patient_id'], { name: 'queue_tickets_patient_id_idx' });
    await queryInterface.addIndex('queue_tickets', ['appointment_id'], { name: 'queue_tickets_appointment_id_idx' });
    await queryInterface.sequelize.query(
      'ALTER TABLE queue_tickets ADD CONSTRAINT queue_tickets_number_positive CHECK (number > 0)',
    );
  },

  async down(queryInterface) {
    await queryInterface.dropTable('queue_tickets');
    await queryInterface.sequelize.query('DROP TYPE IF EXISTS "enum_queue_tickets_priority"');
    await queryInterface.sequelize.query('DROP TYPE IF EXISTS "enum_queue_tickets_status"');
  },
};
