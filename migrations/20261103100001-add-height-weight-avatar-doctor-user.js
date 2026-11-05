'use strict';

/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up(queryInterface, Sequelize) {
    // Рост и вес в медицинской карте
    await queryInterface.addColumn('medical_records', 'height_cm', { type: Sequelize.SMALLINT, allowNull: true });
    await queryInterface.addColumn('medical_records', 'weight_kg', { type: Sequelize.DECIMAL(5, 1), allowNull: true });

    // Аватар пациента: либо один из 7 готовых (avatar_preset 1..7), либо своё фото (уже уменьшенное на сервере)
    await queryInterface.addColumn('patients', 'avatar_kind', { type: Sequelize.STRING(10), allowNull: true });
    await queryInterface.addColumn('patients', 'avatar_preset', { type: Sequelize.SMALLINT, allowNull: true });
    await queryInterface.addColumn('patients', 'avatar_photo', { type: Sequelize.BLOB, allowNull: true });
    await queryInterface.addColumn('patients', 'avatar_updated_at', { type: Sequelize.DATE, allowNull: true });

    // Аккаунт врача: пользователь с ролью doctor привязан к строке таблицы doctors
    await queryInterface.addColumn('users', 'doctor_id', {
      type: Sequelize.INTEGER,
      allowNull: true,
      unique: true,
      references: { model: 'doctors', key: 'id' },
      onUpdate: 'CASCADE',
      onDelete: 'SET NULL',
    });
  },

  async down(queryInterface) {
    await queryInterface.removeColumn('users', 'doctor_id');
    await queryInterface.removeColumn('patients', 'avatar_updated_at');
    await queryInterface.removeColumn('patients', 'avatar_photo');
    await queryInterface.removeColumn('patients', 'avatar_preset');
    await queryInterface.removeColumn('patients', 'avatar_kind');
    await queryInterface.removeColumn('medical_records', 'weight_kg');
    await queryInterface.removeColumn('medical_records', 'height_cm');
  },
};
