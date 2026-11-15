'use strict';

/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up(queryInterface, Sequelize) {
    // Одноразовые коды из писем: подтверждение почты при регистрации и при её смене.
    // В БД хранится только хэш кода, не сам код.
    await queryInterface.createTable('email_verifications', {
      id: { type: Sequelize.INTEGER, primaryKey: true, autoIncrement: true, allowNull: false },
      email: { type: Sequelize.STRING(120), allowNull: false },
      purpose: { type: Sequelize.STRING(20), allowNull: false },
      user_id: {
        type: Sequelize.INTEGER,
        allowNull: true,
        references: { model: 'users', key: 'id' },
        onUpdate: 'CASCADE',
        onDelete: 'CASCADE',
      },
      code_hash: { type: Sequelize.STRING(64), allowNull: false },
      expires_at: { type: Sequelize.DATE, allowNull: false },
      attempts: { type: Sequelize.INTEGER, allowNull: false, defaultValue: 0 },
      sent_at: { type: Sequelize.DATE, allowNull: false },
      created_at: { type: Sequelize.DATE, allowNull: false, defaultValue: Sequelize.literal('CURRENT_TIMESTAMP') },
      updated_at: { type: Sequelize.DATE, allowNull: false, defaultValue: Sequelize.literal('CURRENT_TIMESTAMP') },
    });
    await queryInterface.addIndex('email_verifications', ['email', 'purpose'], {
      unique: true,
      name: 'email_verifications_email_purpose_unique',
    });
  },

  async down(queryInterface) {
    await queryInterface.dropTable('email_verifications');
  },
};
