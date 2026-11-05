'use strict';

const { Model } = require('sequelize');
const { requiredText, optionalText, isDate } = require('../utils/validators');
const { toDisplayDate } = require('../utils/dates');

module.exports = (sequelize, DataTypes) => {
  class Patient extends Model {
    static associate(models) {
      Patient.belongsTo(models.User, { foreignKey: 'userId', as: 'user' });
      Patient.hasOne(models.MedicalRecord, { foreignKey: 'patientId', as: 'medicalRecord' });
      Patient.hasMany(models.Appointment, { foreignKey: 'patientId', as: 'appointments' });
      Patient.hasMany(models.QueueTicket, { foreignKey: 'patientId', as: 'queueTickets' });
    }

    toJSON() {
      const values = super.toJSON();
      values.birthDate = toDisplayDate(values.birthDate);
      // само фото в JSON не отдаём (оно скачивается отдельным запросом), только признак и версию для кэша
      values.avatar = {
        kind: values.avatarKind ?? null,
        preset: values.avatarPreset ?? null,
        version: values.avatarUpdatedAt ? new Date(values.avatarUpdatedAt).getTime() : null,
      };
      delete values.avatarKind;
      delete values.avatarPreset;
      delete values.avatarPhoto;
      delete values.avatarUpdatedAt;
      return values;
    }
  }

  Patient.init({
    userId: { type: DataTypes.INTEGER, unique: true },
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
    birthDate: {
      type: DataTypes.DATEONLY,
      allowNull: false,
      validate: {
        notNull: { msg: 'Поле «Дата рождения» обязательно' },
        ...isDate('Дата рождения'),
        realisticBirthDate(value) {
          const today = new Date().toISOString().slice(0, 10);
          if (value > today || value < '1900-01-01') {
            throw new Error('Дата рождения должна быть в диапазоне от 01-01-1900 до сегодняшнего дня');
          }
        },
      },
    },
    gender: {
      type: DataTypes.ENUM('male', 'female'),
      allowNull: false,
      validate: {
        notNull: { msg: 'Поле «Пол» обязательно' },
        isIn: { args: [['male', 'female']], msg: 'Поле «Пол» должно быть male или female' },
      },
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
      validate: {
        isEmail: { msg: 'Некорректный e-mail' },
        ...optionalText('E-mail', 120),
      },
    },
    address: {
      type: DataTypes.STRING(255),
      validate: optionalText('Адрес', 255),
    },
    insuranceNumber: {
      type: DataTypes.STRING(30),
      validate: optionalText('Номер полиса', 30),
    },
    socialStatus: {
      type: DataTypes.STRING(20),
      validate: { isIn: { args: [['student', 'schoolchild', 'child', 'adult']], msg: 'Неизвестный социальный статус' } },
    },
    workplace: {
      type: DataTypes.STRING(150),
      validate: optionalText('Место работы', 150),
    },
    trustedPerson: {
      type: DataTypes.STRING(300),
      validate: optionalText('Доверенное лицо', 300),
    },
    avatarKind: { type: DataTypes.STRING(10), validate: { isIn: { args: [['preset', 'photo']], msg: 'Неизвестный тип аватара' } } },
    avatarPreset: { type: DataTypes.SMALLINT, validate: { min: 1, max: 9 } },
    avatarPhoto: DataTypes.BLOB,
    avatarUpdatedAt: DataTypes.DATE,
    fullName: {
      type: DataTypes.VIRTUAL,
      get() {
        return [this.lastName, this.firstName, this.middleName].filter(Boolean).join(' ');
      },
    },
  }, {
    sequelize,
    modelName: 'Patient',
    tableName: 'patients',
    underscored: true,
    paranoid: true,
    // тяжёлое поле с фото по умолчанию не читаем: оно нужно только для аватара и Word-документа
    defaultScope: { attributes: { exclude: ['avatarPhoto'] } },
    hooks: {
      // Каждому новому пациенту автоматически заводится медицинская карта (связь 1:1)
      async afterCreate(patient, options) {
        await sequelize.models.MedicalRecord.create({
          patientId: patient.id,
          cardNumber: `MK-${new Date().getFullYear()}-${String(patient.id).padStart(4, '0')}`,
        }, { transaction: options.transaction });
      },
    },
  });

  return Patient;
};
