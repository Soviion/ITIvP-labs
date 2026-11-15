'use strict';

const { Model } = require('sequelize');
const { requiredId, integer, isDate } = require('../utils/validators');

const PRIORITIES = ['normal', 'urgent'];
const STATUSES = ['waiting', 'called', 'in_progress', 'done', 'skipped'];

module.exports = (sequelize, DataTypes) => {
  class QueueTicket extends Model {
    static associate(models) {
      QueueTicket.belongsTo(models.Doctor, { foreignKey: 'doctorId', as: 'doctor' });
      QueueTicket.belongsTo(models.Patient, { foreignKey: 'patientId', as: 'patient' });
      QueueTicket.belongsTo(models.Appointment, { foreignKey: 'appointmentId', as: 'appointment' });
    }
  }

  QueueTicket.init({
    doctorId: {
      type: DataTypes.INTEGER,
      allowNull: false,
      validate: requiredId('Врач'),
    },
    patientId: {
      type: DataTypes.INTEGER,
      allowNull: false,
      validate: requiredId('Пациент'),
    },
    appointmentId: {
      type: DataTypes.INTEGER,
      validate: integer('Запись на приём'),
    },
    queueDate: {
      type: DataTypes.DATEONLY,
      allowNull: false,
      validate: {
        notNull: { msg: 'Поле «Дата очереди» обязательно' },
        ...isDate('Дата очереди'),
      },
    },
    number: {
      type: DataTypes.INTEGER,
      allowNull: false,
      validate: {
        notNull: { msg: 'Поле «Номер в очереди» обязательно' },
        ...integer('Номер в очереди'),
      },
    },
    priority: {
      type: DataTypes.ENUM(...PRIORITIES),
      allowNull: false,
      defaultValue: 'normal',
      validate: { isIn: { args: [PRIORITIES], msg: `Поле «Приоритет» должно быть одним из: ${PRIORITIES.join(', ')}` } },
    },
    status: {
      type: DataTypes.ENUM(...STATUSES),
      allowNull: false,
      defaultValue: 'waiting',
      validate: { isIn: { args: [STATUSES], msg: `Поле «Статус» должно быть одним из: ${STATUSES.join(', ')}` } },
    },
    calledAt: DataTypes.DATE,
    finishedAt: DataTypes.DATE,
  }, {
    sequelize,
    modelName: 'QueueTicket',
    tableName: 'queue_tickets',
    underscored: true,
  });

  return QueueTicket;
};
