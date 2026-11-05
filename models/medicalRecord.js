'use strict';

const { Model } = require('sequelize');
const { requiredText, optionalText, requiredId } = require('../utils/validators');

const BLOOD_TYPES = ['O+', 'O-', 'A+', 'A-', 'B+', 'B-', 'AB+', 'AB-'];

module.exports = (sequelize, DataTypes) => {
  class MedicalRecord extends Model {
    static associate(models) {
      MedicalRecord.belongsTo(models.Patient, { foreignKey: 'patientId', as: 'patient' });
      MedicalRecord.hasMany(models.MedicalEntry, { foreignKey: 'medicalRecordId', as: 'entries' });
      MedicalRecord.hasMany(models.Discharge, { foreignKey: 'medicalRecordId', as: 'discharges' });
    }
  }

  MedicalRecord.init({
    patientId: {
      type: DataTypes.INTEGER,
      allowNull: false,
      unique: true,
      validate: requiredId('Пациент'),
    },
    cardNumber: {
      type: DataTypes.STRING(20),
      allowNull: false,
      unique: true,
      validate: requiredText('Номер карты', 20),
    },
    bloodType: {
      type: DataTypes.STRING(3),
      validate: { isIn: { args: [BLOOD_TYPES], msg: `Группа крови должна быть одной из: ${BLOOD_TYPES.join(', ')}` } },
    },
    bloodTypeChangedAt: DataTypes.DATE,
    heightCm: {
      type: DataTypes.SMALLINT,
      validate: { min: { args: [30], msg: 'Рост — от 30 до 250 см' }, max: { args: [250], msg: 'Рост — от 30 до 250 см' } },
    },
    weightKg: {
      type: DataTypes.DECIMAL(5, 1),
      get() {
        const value = this.getDataValue('weightKg');
        return value === null || value === undefined ? value : Number(value);
      },
      validate: { min: { args: [2], msg: 'Вес — от 2 до 400 кг' }, max: { args: [400], msg: 'Вес — от 2 до 400 кг' } },
    },
    diseases: { type: DataTypes.JSONB, allowNull: false, defaultValue: [] },
    medications: { type: DataTypes.JSONB, allowNull: false, defaultValue: [] },
    allergies: DataTypes.TEXT,
    chronicDiseases: DataTypes.TEXT,
    notes: {
      type: DataTypes.TEXT,
      validate: optionalText('Заметки', 5000),
    },
  }, {
    sequelize,
    modelName: 'MedicalRecord',
    tableName: 'medical_records',
    underscored: true,
  });

  return MedicalRecord;
};
