'use strict';

/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up(queryInterface, Sequelize) {
    // Подтверждение e-mail
    await queryInterface.addColumn('users', 'is_verified', {
      type: Sequelize.BOOLEAN,
      allowNull: false,
      defaultValue: false,
    });
    // В БД хранится только SHA-256 токена из письма, а не сам токен
    await queryInterface.addColumn('users', 'email_verification_token_hash', {
      type: Sequelize.STRING(64),
      allowNull: true,
    });
    await queryInterface.addColumn('users', 'email_verification_expires', {
      type: Sequelize.DATE,
      allowNull: true,
    });

    // Двухфакторная аутентификация (Google Authenticator, TOTP)
    await queryInterface.addColumn('users', 'two_factor_enabled', {
      type: Sequelize.BOOLEAN,
      allowNull: false,
      defaultValue: false,
    });
    await queryInterface.addColumn('users', 'two_factor_secret', {
      type: Sequelize.TEXT,
      allowNull: true,
    });
    await queryInterface.addColumn('users', 'two_factor_last_step', {
      type: Sequelize.INTEGER,
      allowNull: true,
    });

    // Версия токенов: увеличивается при смене пароля и отзывает ранее выданные JWT
    await queryInterface.addColumn('users', 'token_version', {
      type: Sequelize.INTEGER,
      allowNull: false,
      defaultValue: 0,
    });

    await queryInterface.addIndex('users', ['email_verification_token_hash'], {
      name: 'users_verification_token_idx',
    });
  },

  async down(queryInterface) {
    await queryInterface.removeIndex('users', 'users_verification_token_idx');
    await queryInterface.removeColumn('users', 'token_version');
    await queryInterface.removeColumn('users', 'two_factor_last_step');
    await queryInterface.removeColumn('users', 'two_factor_secret');
    await queryInterface.removeColumn('users', 'two_factor_enabled');
    await queryInterface.removeColumn('users', 'email_verification_expires');
    await queryInterface.removeColumn('users', 'email_verification_token_hash');
    await queryInterface.removeColumn('users', 'is_verified');
  },
};
