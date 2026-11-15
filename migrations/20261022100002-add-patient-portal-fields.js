'use strict';

/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up(queryInterface, Sequelize) {
    // Роль пользователя. Все уже существующие аккаунты (созданные до личного кабинета) становятся сотрудниками,
    // а новые, зарегистрированные пациентами, получают роль patient.
    await queryInterface.addColumn('users', 'role', {
      type: Sequelize.STRING(20),
      allowNull: false,
      defaultValue: 'staff',
    });
    await queryInterface.sequelize.query("ALTER TABLE users ALTER COLUMN role SET DEFAULT 'patient'");

    // Анкета пациента, которую он заполняет при регистрации
    await queryInterface.addColumn('patients', 'user_id', {
      type: Sequelize.INTEGER,
      allowNull: true,
      unique: true,
      references: { model: 'users', key: 'id' },
      onUpdate: 'CASCADE',
      onDelete: 'SET NULL',
    });
    await queryInterface.addColumn('patients', 'social_status', { type: Sequelize.STRING(20), allowNull: true });
    await queryInterface.addColumn('patients', 'workplace', { type: Sequelize.STRING(150), allowNull: true });
    await queryInterface.addColumn('patients', 'trusted_person', { type: Sequelize.STRING(300), allowNull: true });

    // Списки в медицинской карте: заболевания и принимаемые препараты
    await queryInterface.addColumn('medical_records', 'diseases', {
      type: Sequelize.JSONB,
      allowNull: false,
      defaultValue: Sequelize.literal("'[]'::jsonb"),
    });
    await queryInterface.addColumn('medical_records', 'medications', {
      type: Sequelize.JSONB,
      allowNull: false,
      defaultValue: Sequelize.literal("'[]'::jsonb"),
    });
  },

  async down(queryInterface) {
    await queryInterface.removeColumn('medical_records', 'medications');
    await queryInterface.removeColumn('medical_records', 'diseases');
    await queryInterface.removeColumn('patients', 'trusted_person');
    await queryInterface.removeColumn('patients', 'workplace');
    await queryInterface.removeColumn('patients', 'social_status');
    await queryInterface.removeColumn('patients', 'user_id');
    await queryInterface.removeColumn('users', 'role');
  },
};
