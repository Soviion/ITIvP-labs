'use strict';

const { Model } = require('sequelize');
const { requiredText } = require('../utils/validators');

module.exports = (sequelize, DataTypes) => {
  class Specialty extends Model {
    static associate(models) {
      Specialty.hasMany(models.Doctor, { foreignKey: 'specialtyId', as: 'doctors' });
    }
  }

  Specialty.init({
    name: {
      type: DataTypes.STRING(100),
      allowNull: false,
      unique: true,
      validate: requiredText('Название специальности', 100),
    },
  }, {
    sequelize,
    modelName: 'Specialty',
    tableName: 'specialties',
    underscored: true,
  });

  return Specialty;
};
