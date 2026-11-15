'use strict';

const { Model } = require('sequelize');
const { requiredText, optionalText, requiredId, integer } = require('../utils/validators');

module.exports = (sequelize, DataTypes) => {
  class MedicalEntry extends Model {
    static associate(models) {
      MedicalEntry.belongsTo(models.MedicalRecord, { foreignKey: 'medicalRecordId', as: 'medicalRecord' });
      MedicalEntry.belongsTo(models.Appointment, { foreignKey: 'appointmentId', as: 'appointment' });
      MedicalEntry.belongsTo(models.Doctor, { foreignKey: 'doctorId', as: 'doctor' });
      MedicalEntry.hasMany(models.Discharge, { foreignKey: 'entryId', as: 'discharges' });
    }
  }

  MedicalEntry.init({
    medicalRecordId: {
      type: DataTypes.INTEGER,
      allowNull: false,
      validate: requiredId('Медицинская карта'),
    },
    appointmentId: {
      type: DataTypes.INTEGER,
      unique: true,
      validate: integer('Запись на приём'),
    },
    doctorId: {
      type: DataTypes.INTEGER,
      allowNull: false,
      validate: requiredId('Врач'),
    },
    complaints: {
      type: DataTypes.TEXT,
      allowNull: false,
      validate: requiredText('Жалобы'),
    },
    diagnosis: {
      type: DataTypes.TEXT,
      allowNull: false,
      validate: requiredText('Диагноз'),
    },
    icdCode: {
      type: DataTypes.STRING(10),
      validate: {
        is: { args: [/^[A-Z]\d{2}(\.\d{1,2})?$/], msg: 'Код МКБ-10 должен быть вида J20.9' },
      },
    },
    treatment: DataTypes.TEXT,
    prescriptions: {
      type: DataTypes.TEXT,
      validate: optionalText('Назначения', 5000),
    },
  }, {
    sequelize,
    modelName: 'MedicalEntry',
    tableName: 'medical_entries',
    underscored: true,
  });

  return MedicalEntry;
};
