'use strict';

/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.createTable('doctors', {
      id: { type: Sequelize.INTEGER, primaryKey: true, autoIncrement: true, allowNull: false },
      specialty_id: {
        type: Sequelize.INTEGER,
        allowNull: false,
        references: { model: 'specialties', key: 'id' },
        onUpdate: 'CASCADE',
        onDelete: 'RESTRICT',
      },
      last_name: { type: Sequelize.STRING(60), allowNull: false },
      first_name: { type: Sequelize.STRING(60), allowNull: false },
      middle_name: { type: Sequelize.STRING(60), allowNull: true },
      phone: { type: Sequelize.STRING(20), allowNull: false },
      email: { type: Sequelize.STRING(120), allowNull: false },
      is_active: { type: Sequelize.BOOLEAN, allowNull: false, defaultValue: true },
      created_at: { type: Sequelize.DATE, allowNull: false, defaultValue: Sequelize.literal('CURRENT_TIMESTAMP') },
      updated_at: { type: Sequelize.DATE, allowNull: false, defaultValue: Sequelize.literal('CURRENT_TIMESTAMP') },
      deleted_at: { type: Sequelize.DATE, allowNull: true },
    });

    await queryInterface.addIndex('doctors', ['specialty_id'], { name: 'doctors_specialty_id_idx' });
    // Уникальность e-mail только среди неудалённых врачей (мягкое удаление)
    await queryInterface.sequelize.query(
      'CREATE UNIQUE INDEX doctors_email_unique ON doctors (lower(email)) WHERE deleted_at IS NULL',
    );
  },

  async down(queryInterface) {
    await queryInterface.dropTable('doctors');
  },
};
