'use strict';

const { Model } = require('sequelize');

module.exports = (sequelize, DataTypes) => {
  class EmailVerification extends Model {}

  EmailVerification.init({
    email: { type: DataTypes.STRING(120), allowNull: false },
    purpose: { type: DataTypes.STRING(20), allowNull: false }, // register | change_email
    userId: DataTypes.INTEGER,
    codeHash: { type: DataTypes.STRING(64), allowNull: false },
    expiresAt: { type: DataTypes.DATE, allowNull: false },
    attempts: { type: DataTypes.INTEGER, allowNull: false, defaultValue: 0 },
    sentAt: { type: DataTypes.DATE, allowNull: false },
  }, {
    sequelize,
    modelName: 'EmailVerification',
    tableName: 'email_verifications',
    underscored: true,
  });

  return EmailVerification;
};
