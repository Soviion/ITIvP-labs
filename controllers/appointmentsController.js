const { Appointment, Patient, Doctor } = require('../models');
const appointmentInclude = require('../services/appointmentInclude');
const createCrudController = require('./createCrudController');
const ApiError = require('../utils/ApiError');
const { fromDisplayDate, fromDisplayTime } = require('../utils/dates');
const { ensureExists } = require('../utils/validators');
const { getBody } = require('../utils/request');
const { publishAppointmentChange } = require('../realtime/bus');

const STATUSES = Appointment.getAttributes().status.values;

const include = appointmentInclude();

const order = [['date', 'ASC'], ['time', 'ASC'], ['id', 'ASC']];

// Что именно сделала регистратура с записью: от этого зависит, какой тост увидит пациент
function updateAction(row, before) {
  const sameTime = (a, b) => String(a).slice(0, 5) === String(b).slice(0, 5);
  const moved = before.doctorId !== row.doctorId || before.date !== row.date || !sameTime(before.time, row.time);
  if (row.status === 'cancelled' && before.status !== 'cancelled') return 'cancelled';
  if (moved) return 'rescheduled';
  if (row.status === 'completed' && before.status !== 'completed') return 'completed';
  return 'updated';
}

function announceChange(action, row, before) {
  if (action === 'created') publishAppointmentChange('booked', 'staff', row);
  else if (action === 'deleted') publishAppointmentChange('deleted', 'staff', row);
  else publishAppointmentChange(updateAction(row, before), 'staff', row, before);
}

const crud = createCrudController({
  Model: Appointment,
  itemKey: 'appointment',
  messages: {
    notFound: (id) => `Запись с id=${id} не найдена`,
    deleted: 'Запись удалена',
  },
  fields: ['patientId', 'doctorId', 'date', 'time', 'durationMinutes', 'reason', 'status', 'cabinet'],
  required: ['patientId', 'doctorId', 'date', 'time'],
  include,
  order,
  onChange: announceChange,
  async prepare(data) {
    if (data.date != null) data.date = fromDisplayDate(data.date);
    if (data.time != null) data.time = fromDisplayTime(data.time);
    if (data.patientId != null) {
      await ensureExists(Patient, data.patientId, 'patientId', 'Пациент');
    }
    if (data.doctorId != null) {
      await ensureExists(Doctor, data.doctorId, 'doctorId', 'Врач');
      if (!(await Doctor.count({ where: { id: data.doctorId, isActive: true } }))) {
        throw new ApiError(400, 'Врач сейчас не ведёт приём');
      }
    }
    return data;
  },
});

async function query(req, res) {
  const filters = getBody(req);
  const where = {};

  if (filters.status !== undefined) {
    if (!STATUSES.includes(filters.status)) {
      throw new ApiError(400, `Поле "status" должно быть одним из: ${STATUSES.join(', ')}`);
    }
    where.status = filters.status;
  }
  ['doctorId', 'patientId'].forEach((field) => {
    if (filters[field] !== undefined) {
      if (!Number.isInteger(filters[field])) {
        throw new ApiError(400, `Поле "${field}" должно быть целым числом`);
      }
      where[field] = filters[field];
    }
  });
  if (filters.date !== undefined) {
    where.date = fromDisplayDate(filters.date);
  }

  res.json(await Appointment.findAll({ where, include, order }));
}

module.exports = { ...crud, query };
