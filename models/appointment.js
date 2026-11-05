'use strict';

const { Model } = require('sequelize');
const { optionalText, requiredId, integer, isDate } = require('../utils/validators');
const { toDisplayDate, toDisplayTime } = require('../utils/dates');

const STATUSES = ['scheduled', 'completed', 'cancelled', 'no_show'];

module.exports = (sequelize, DataTypes) => {
  class Appointment extends Model {
    static associate(models) {
      Appointment.belongsTo(models.Patient, { foreignKey: 'patientId', as: 'patient' });
      Appointment.belongsTo(models.Doctor, { foreignKey: 'doctorId', as: 'doctor' });
      Appointment.hasOne(models.QueueTicket, { foreignKey: 'appointmentId', as: 'queueTicket' });
      Appointment.hasOne(models.MedicalEntry, { foreignKey: 'appointmentId', as: 'medicalEntry' });
    }

    toJSON() {
      const values = super.toJSON();
      values.date = toDisplayDate(values.date);
      values.time = toDisplayTime(values.time);
      return values;
    }
  }

  Appointment.init({
    patientId: {
      type: DataTypes.INTEGER,
      allowNull: false,
      validate: requiredId('Пациент'),
    },
    doctorId: {
      type: DataTypes.INTEGER,
      allowNull: false,
      validate: requiredId('Врач'),
    },
    date: {
      type: DataTypes.DATEONLY,
      allowNull: false,
      validate: {
        notNull: { msg: 'Поле «Дата» обязательно' },
        ...isDate('Дата'),
      },
    },
    time: {
      type: DataTypes.TIME,
      allowNull: false,
      validate: {
        notNull: { msg: 'Поле «Время» обязательно' },
        is: { args: [/^([01]\d|2[0-3]):[0-5]\d(:[0-5]\d)?$/], msg: 'Поле «Время» должно быть в формате HH:MM' },
      },
    },
    durationMinutes: {
      type: DataTypes.INTEGER,
      allowNull: false,
      defaultValue: 30,
      validate: {
        ...integer('Длительность (мин)', 5),
        max: { args: [480], msg: 'Поле «Длительность (мин)» должно быть не больше 480' },
      },
    },
    reason: {
      type: DataTypes.TEXT,
      validate: optionalText('Причина обращения', 1000),
    },
    status: {
      type: DataTypes.ENUM(...STATUSES),
      allowNull: false,
      defaultValue: 'scheduled',
      validate: {
        isIn: { args: [STATUSES], msg: `Поле «Статус» должно быть одним из: ${STATUSES.join(', ')}` },
      },
    },
    // пациент удалил талон из своего списка (в клинике запись остаётся)
    patientHidden: {
      type: DataTypes.BOOLEAN,
      allowNull: false,
      defaultValue: false,
    },
    cabinet: {
      type: DataTypes.STRING(10),
      validate: optionalText('Кабинет', 10),
    },
  }, {
    sequelize,
    modelName: 'Appointment',
    tableName: 'appointments',
    underscored: true,
  });

  return Appointment;
};
