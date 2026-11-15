'use strict';

const { Model } = require('sequelize');
const { requiredText, requiredId, integer, isDate } = require('../utils/validators');

module.exports = (sequelize, DataTypes) => {
  class Discharge extends Model {
    static associate(models) {
      Discharge.belongsTo(models.MedicalRecord, { foreignKey: 'medicalRecordId', as: 'medicalRecord' });
      Discharge.belongsTo(models.Doctor, { foreignKey: 'doctorId', as: 'doctor' });
      Discharge.belongsTo(models.MedicalEntry, { foreignKey: 'entryId', as: 'entry' });
    }
  }

  Discharge.init({
    medicalRecordId: {
      type: DataTypes.INTEGER,
      allowNull: false,
      validate: requiredId('Медицинская карта'),
    },
    doctorId: {
      type: DataTypes.INTEGER,
      allowNull: false,
      validate: requiredId('Врач'),
    },
    entryId: {
      type: DataTypes.INTEGER,
      validate: integer('Запись в карте'),
    },
    issuedOn: {
      type: DataTypes.DATEONLY,
      allowNull: false,
      validate: {
        notNull: { msg: 'Поле «Дата выписки» обязательно' },
        ...isDate('Дата выписки'),
      },
    },
    finalDiagnosis: {
      type: DataTypes.TEXT,
      allowNull: false,
      validate: requiredText('Заключительный диагноз'),
    },
    recommendations: DataTypes.TEXT,
    sickLeaveFrom: {
      type: DataTypes.DATEONLY,
      validate: isDate('Начало больничного'),
    },
    sickLeaveTo: {
      type: DataTypes.DATEONLY,
      validate: isDate('Окончание больничного'),
    },
  }, {
    sequelize,
    modelName: 'Discharge',
    tableName: 'discharges',
    underscored: true,
    validate: {
      sickLeaveRange() {
        if (this.sickLeaveFrom && this.sickLeaveTo && this.sickLeaveTo < this.sickLeaveFrom) {
          throw new Error('Окончание больничного не может быть раньше его начала');
        }
      },
    },
  });

  return Discharge;
};
