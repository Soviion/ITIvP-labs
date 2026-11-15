'use strict';

/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.createTable('users', {
      id: { type: Sequelize.INTEGER, primaryKey: true, autoIncrement: true, allowNull: false },
      email: { type: Sequelize.STRING(120), allowNull: false },
      // хеш bcrypt — всегда 60 символов; сам пароль нигде не хранится
      password_hash: { type: Sequelize.STRING(100), allowNull: false },
      created_at: { type: Sequelize.DATE, allowNull: false, defaultValue: Sequelize.literal('CURRENT_TIMESTAMP') },
      updated_at: { type: Sequelize.DATE, allowNull: false, defaultValue: Sequelize.literal('CURRENT_TIMESTAMP') },
    });

    await queryInterface.addIndex('users', ['email'], { name: 'users_email_unique', unique: true });
  },

  async down(queryInterface) {
    await queryInterface.dropTable('users');
  },
};
