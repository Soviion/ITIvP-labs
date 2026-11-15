'use strict';

const { Model } = require('sequelize');
const { requiredText, optionalText, requiredId } = require('../utils/validators');

module.exports = (sequelize, DataTypes) => {
  class Doctor extends Model {
    static associate(models) {
      Doctor.belongsTo(models.Specialty, { foreignKey: 'specialtyId', as: 'specialty' });
      Doctor.hasMany(models.Appointment, { foreignKey: 'doctorId', as: 'appointments' });
      Doctor.hasMany(models.QueueTicket, { foreignKey: 'doctorId', as: 'queueTickets' });
      Doctor.hasMany(models.MedicalEntry, { foreignKey: 'doctorId', as: 'medicalEntries' });
      Doctor.hasMany(models.Discharge, { foreignKey: 'doctorId', as: 'discharges' });
    }
  }

  Doctor.init({
    specialtyId: {
      type: DataTypes.INTEGER,
      allowNull: false,
      validate: requiredId('Специальность'),
    },
    lastName: {
      type: DataTypes.STRING(60),
      allowNull: false,
      validate: requiredText('Фамилия', 60),
    },
    firstName: {
      type: DataTypes.STRING(60),
      allowNull: false,
      validate: requiredText('Имя', 60),
    },
    middleName: {
      type: DataTypes.STRING(60),
      validate: optionalText('Отчество', 60),
    },
    phone: {
      type: DataTypes.STRING(20),
      allowNull: false,
      validate: {
        ...requiredText('Телефон', 20),
        is: { args: [/^\+?[\d\s()-]{7,20}$/], msg: 'Некорректный номер телефона' },
      },
    },
    email: {
      type: DataTypes.STRING(120),
      allowNull: false,
      validate: {
        ...requiredText('E-mail', 120),
        isEmail: { msg: 'Некорректный e-mail' },
      },
    },
    isActive: {
      type: DataTypes.BOOLEAN,
      allowNull: false,
      defaultValue: true,
    },
    fullName: {
      type: DataTypes.VIRTUAL,
      get() {
        return [this.lastName, this.firstName, this.middleName].filter(Boolean).join(' ');
      },
    },
  }, {
    sequelize,
    modelName: 'Doctor',
    tableName: 'doctors',
    underscored: true,
    paranoid: true,
  });

  return Doctor;
};
