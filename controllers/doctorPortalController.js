const { Op } = require('sequelize');
const { Patient, MedicalRecord, Appointment, Doctor, Specialty } = require('../models');
const ApiError = require('../utils/ApiError');
const { getBody } = require('../utils/request');
const { toDisplayDate, toDisplayTime } = require('../utils/dates');
const { todayIso } = require('../utils/schedule');
const MedicalCard = require('../mongo/models/MedicalCard');
const { isConnected } = require('../config/mongo');
const { snapshotFromPostgres } = require('../mongo/services/cardSnapshot');
const sendDocx = require('../utils/sendDocx');
const { applyVisitToRecord, applyVisitToCard } = require('../services/visitRecordSync');
const { mirror, syncRecordFromCard, syncPatientFromCard } = require('../services/cardSync');
const { buildMedicalCardDocx } = require('../services/documents/medicalCardDocx');
const { buildReferralDocx } = require('../services/documents/referralDocx');

// ---------- вспомогательное ----------

const doctorBrief = (doctor) => ({
  id: doctor.id,
  name: doctor.fullName,
  specialty: doctor.specialty?.name,
});

const avatarOf = (patient) => ({
  kind: patient.avatarKind ?? null,
  preset: patient.avatarPreset ?? null,
  version: patient.avatarUpdatedAt ? new Date(patient.avatarUpdatedAt).getTime() : null,
});

const patientBrief = (patient) => ({
  id: patient.id,
  lastName: patient.lastName,
  firstName: patient.firstName,
  middleName: patient.middleName,
  fullName: patient.fullName,
  birthDate: toDisplayDate(patient.birthDate),
  gender: patient.gender,
  phone: patient.phone,
  avatar: avatarOf(patient),
});

function requireMongo() {
  if (!isConnected()) throw new ApiError(503, 'Личные дела временно недоступны. Повторите попытку позже');
}

// Врач видит только своих пациентов: тех, кто записан (или был записан) именно к нему
// Администратор видит всех. У врача без карточки в справочнике записей нет, поэтому пациентов он тоже не видит.
async function assertOwnPatient(doctor, patientId) {
  if (doctor.isAdmin) return;
  const count = doctor.id ? await Appointment.count({ where: { doctorId: doctor.id, patientId } }) : 0;
  if (!count) throw new ApiError(403, 'Этот пациент не записан к вам на приём');
}

const patientIdOf = (req) => {
  const id = Number(req.params.patientId);
  if (!Number.isInteger(id) || id < 1) throw new ApiError(400, 'Некорректная ссылка на пациента');
  return id;
};

async function ownPatientId(req) {
  const patientId = patientIdOf(req);
  await assertOwnPatient(req.doctor, patientId);
  return patientId;
}

async function loadCard(patientId) {
  requireMongo();
  const card = await MedicalCard.findOne({ patientId });
  if (!card) throw new ApiError(404, 'Личное дело ещё не создано');
  return card;
}

const cardJson = (card) => card.toObject({ virtuals: true });

async function loadPhoto(patientId) {
  const patient = await Patient.unscoped().findByPk(patientId, { attributes: ['id', 'avatarKind', 'avatarPhoto'] });
  return patient?.avatarKind === 'photo' && patient.avatarPhoto ? patient.avatarPhoto : null;
}

// Следующий день в формате yyyy-mm-dd (по местному времени сервера, как и остальное расписание)
function addDaysIso(iso, days) {
  const [y, m, d] = iso.split('-').map(Number);
  const date = new Date(y, m - 1, d + days);
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
}

const cleanString = (value) => (typeof value === 'string' ? value.trim() : value);
const emptyToUndefined = (value) => (value === '' || value === null ? undefined : cleanString(value));

// ---------- профиль врача и список записей ----------

// Профиль врача: пока только чтение (редактирование появится позже). email нужен клиенту, чтобы подтянуть описание врача
exports.getMe = (req, res) => {
  const { doctor } = req;
  res.json({
    doctor: {
      ...doctorBrief(doctor),
      email: doctor.email ?? null,
      phone: doctor.phone ?? null,
      role: req.user.role,
      profileFilled: Boolean(doctor.id),
    },
  });
};

// GET /doctor/appointments?period=soon|today|upcoming|past|all&status=scheduled   (soon — сегодня и завтра)
exports.listAppointments = async (req, res) => {
  const { period = 'soon', status } = req.query;
  const today = todayIso();
  const tomorrow = addDaysIso(today, 1);
  // врач видит свои записи, администратор — записи всех врачей (можно сузить параметром doctorId)
  const where = {};
  if (req.doctor.isAdmin) {
    if (req.query.doctorId) where.doctorId = Number(req.query.doctorId) || 0;
  } else {
    where.doctorId = req.doctor.id ?? 0; // у врача без карточки записей нет
  }
  if (period === 'soon') where.date = { [Op.between]: [today, tomorrow] };
  else if (period === 'today') where.date = today;
  else if (period === 'upcoming') where.date = { [Op.gte]: today };
  else if (period === 'past') where.date = { [Op.lt]: today };
  else if (period !== 'all') throw new ApiError(400, 'Неизвестный период записей');
  if (status) where.status = status;

  const appointments = await Appointment.findAll({
    where,
    include: [{
      model: Patient,
      as: 'patient',
      attributes: ['id', 'lastName', 'firstName', 'middleName', 'birthDate', 'gender', 'phone', 'avatarKind', 'avatarPreset', 'avatarUpdatedAt'],
      paranoid: false,
    }, {
      model: Doctor,
      as: 'doctor',
      attributes: ['id', 'lastName', 'firstName', 'middleName'],
      paranoid: false,
      include: [{ model: Specialty, as: 'specialty', attributes: ['name'] }],
    }],
    order: period === 'past' ? [['date', 'DESC'], ['time', 'DESC']] : [['date', 'ASC'], ['time', 'ASC']],
  });

  // у каких пациентов уже есть личное дело в MongoDB
  let withCard = null;
  if (isConnected()) {
    const ids = [...new Set(appointments.map((item) => item.patientId))];
    withCard = new Set((await MedicalCard.find({ patientId: { $in: ids } }).select('patientId').lean()).map((item) => item.patientId));
  }

  res.json({
    today: toDisplayDate(today),
    tomorrow: toDisplayDate(tomorrow),
    mongoAvailable: isConnected(),
    data: appointments.map((item) => ({
      id: item.id,
      date: toDisplayDate(item.date),
      time: toDisplayTime(item.time),
      status: item.status,
      cabinet: item.cabinet,
      doctor: item.doctor ? { id: item.doctor.id, name: item.doctor.fullName, specialty: item.doctor.specialty?.name } : null,
      patient: item.patient ? patientBrief(item.patient) : null,
      hasCard: withCard ? withCard.has(item.patientId) : null,
    })),
  });
};

// ---------- пациент ----------

// GET /doctor/patients/:patientId — данные из профиля (PostgreSQL) и признак личного дела
exports.getPatient = async (req, res) => {
  const patientId = await ownPatientId(req);
  const patient = await Patient.findByPk(patientId, { include: [{ model: MedicalRecord, as: 'medicalRecord' }], paranoid: false });
  if (!patient) throw new ApiError(404, 'Пациент не найден');
  const record = patient.medicalRecord;

  const appointments = await Appointment.findAll({ where: req.doctor.isAdmin ? { patientId } : { doctorId: req.doctor.id, patientId }, order: [['date', 'DESC'], ['time', 'DESC']] });

  let card = null;
  if (isConnected()) {
    const found = await MedicalCard.findOne({ patientId }).select('cardNumber createdAt').lean();
    card = found ? { id: found._id, cardNumber: found.cardNumber } : null;
  }

  res.json({
    patient: { ...patient.toJSON(), medicalRecord: undefined },
    record: record ? {
      cardNumber: record.cardNumber,
      bloodType: record.bloodType,
      heightCm: record.heightCm,
      weightKg: record.weightKg,
      diseases: record.diseases,
      medications: record.medications,
      allergies: record.allergies,
    } : null,
    appointments: appointments.map((item) => ({ id: item.id, date: toDisplayDate(item.date), time: toDisplayTime(item.time), status: item.status })),
    mongoAvailable: isConnected(),
    card,
  });
};

// GET /doctor/patients/:patientId/avatar — своё фото пациента
exports.getPatientAvatar = async (req, res) => {
  const photo = await loadPhoto(await ownPatientId(req));
  if (!photo) throw new ApiError(404, 'Фото не загружено');
  res.set({ 'Content-Type': 'image/jpeg', 'Cache-Control': 'private, max-age=3600' }).send(photo);
};

// ---------- личное дело в MongoDB ----------

// POST /doctor/patients/:patientId/card — завести личное дело на основе профиля пациента
exports.createCard = async (req, res) => {
  const patientId = await ownPatientId(req);
  requireMongo();
  if (await MedicalCard.exists({ patientId })) throw new ApiError(409, 'Личное дело уже создано');
  const snapshot = await snapshotFromPostgres(patientId);
  const card = await MedicalCard.create({ ...snapshot, createdBy: { id: req.doctor.id ?? undefined, name: req.doctor.fullName } });
  res.status(201).json(cardJson(card));
};

exports.getCard = async (req, res) => {
  res.json(cardJson(await loadCard(await ownPatientId(req))));
};

const PATIENT_FIELDS = ['address', 'workplace', 'insuranceNumber', 'socialStatus', 'trustedPerson', 'phone', 'email'];
const ANAMNESIS_FIELDS = ['family', 'habits', 'surgeries', 'disability', 'notes'];
const asNamed = (item) => (typeof item === 'string' ? { name: item.trim() } : item);

// PATCH /doctor/patients/:patientId/card — врач дополняет данные: профиль, замеры, анамнез, списки
exports.updateCard = async (req, res) => {
  const card = await loadCard(await ownPatientId(req));
  const body = getBody(req);

  PATIENT_FIELDS.forEach((field) => {
    if (body.patient?.[field] !== undefined) card.set(`patient.${field}`, emptyToUndefined(body.patient[field]));
  });
  ANAMNESIS_FIELDS.forEach((field) => {
    if (body.anamnesis?.[field] !== undefined) card.set(`anamnesis.${field}`, emptyToUndefined(body.anamnesis[field]));
  });
  ['bloodType', 'heightCm', 'weightKg'].forEach((field) => {
    if (body[field] !== undefined) card.set(field, body[field] === '' || body[field] === null ? undefined : body[field]);
  });
  if (body.allergies !== undefined) card.set('allergies', Array.isArray(body.allergies) ? body.allergies.filter((item) => String(item).trim()) : []);
  if (body.diseases !== undefined) card.set('diseases', (Array.isArray(body.diseases) ? body.diseases : []).map(asNamed).filter((item) => item?.name));
  if (body.medications !== undefined) card.set('medications', (Array.isArray(body.medications) ? body.medications : []).map(asNamed).filter((item) => item?.name));

  await card.save();
  // правки врача видит и пациент: общие данные переносятся в его карту и профиль (PostgreSQL)
  await mirror('правка личного дела', async () => {
    await syncRecordFromCard(card, Object.keys(body));
    await syncPatientFromCard(card, Object.keys(body.patient ?? {}));
  });
  res.json(cardJson(card));
};

// POST /doctor/patients/:patientId/card/visits — запись о приёме (жалобы, осмотр, диагноз, назначения)
exports.addVisit = async (req, res) => {
  const patientId = await ownPatientId(req);
  const card = await loadCard(patientId);
  const body = getBody(req);
  const { doctor } = req;

  const visit = {
    doctor: doctorBrief(doctor),
    date: new Date(),
    complaints: body.complaints,
    examination: body.examination,
    diagnosis: body.diagnosis,
    icdCode: emptyToUndefined(body.icdCode),
    treatment: emptyToUndefined(body.treatment),
    recommendations: emptyToUndefined(body.recommendations),
    vitals: body.vitals,
    prescriptions: body.prescriptions,
  };

  // Приём привязывается к записи на этот день; после сохранения запись получает статус «проведён»
  let appointment = null;
  if (body.appointmentId !== undefined && body.appointmentId !== null && body.appointmentId !== '') {
    appointment = await Appointment.findOne({ where: { id: Number(body.appointmentId), patientId, ...(doctor.isAdmin ? {} : { doctorId: doctor.id }) } });
    if (!appointment) throw new ApiError(400, 'Запись на приём не найдена среди ваших записей этого пациента');
    if (card.visits.some((item) => item.appointmentId === appointment.id)) throw new ApiError(409, 'По этой записи приём уже оформлен');
    visit.appointmentId = appointment.id;
  }

  await card.addVisit(visit);

  // Диагноз и назначения попадают в карту пациента: в его кабинет и в личное дело (повторы не добавляются)
  const saved = card.visits[card.visits.length - 1].toObject();
  try {
    await applyVisitToRecord(patientId, saved);
    if (applyVisitToCard(card, saved)) await card.save();
  } catch (err) {
    console.error(`Не удалось перенести диагноз и назначения в карту пациента: ${err.message}`);
  }
  if (appointment && appointment.status === 'scheduled') await appointment.update({ status: 'completed' });

  res.status(201).json(cardJson(card));
};

// POST /doctor/patients/:patientId/card/referrals — направление (номер вида 2026-0007-02)
exports.addReferral = async (req, res) => {
  const patientId = await ownPatientId(req);
  const card = await loadCard(patientId);
  const body = getBody(req);

  const issuedAt = new Date();
  const validUntil = body.validUntil ? new Date(body.validUntil) : new Date(issuedAt.getTime() + 30 * 24 * 3600 * 1000);
  if (Number.isNaN(validUntil.getTime()) || validUntil < new Date(issuedAt.toDateString())) {
    throw new ApiError(400, 'Срок действия направления указан неверно');
  }

  // направление относится к приёму: либо указан явно, либо это последний приём этого врача сегодня
  const sameDay = (a, b) => new Date(a).toDateString() === new Date(b).toDateString();
  const own = (visit) => (req.doctor.isAdmin ? !visit.doctor?.id : visit.doctor?.id === req.doctor.id);
  const explicit = body.visitId && card.visits.id(body.visitId);
  const latest = [...card.visits].reverse().find((visit) => own(visit) && sameDay(visit.date, issuedAt));
  const visit = explicit || latest;

  card.referrals.push({
    visitId: visit?._id,
    number: `${issuedAt.getFullYear()}-${String(patientId).padStart(4, '0')}-${String(card.referrals.length + 1).padStart(2, '0')}`,
    issuedAt,
    validUntil,
    doctor: doctorBrief(req.doctor),
    urgency: body.urgency === 'urgent' ? 'urgent' : 'planned',
    toSpecialty: body.toSpecialty,
    toFacility: emptyToUndefined(body.toFacility),
    purpose: body.purpose,
    diagnosis: emptyToUndefined(body.diagnosis),
    icdCode: emptyToUndefined(body.icdCode),
    notes: emptyToUndefined(body.notes),
  });
  await card.save();
  res.status(201).json(cardJson(card));
};

// ---------- Word ----------

// GET /doctor/patients/:patientId/card.docx
exports.downloadCard = async (req, res) => {
  const patientId = await ownPatientId(req);
  const card = await loadCard(patientId);
  const buffer = await buildMedicalCardDocx(cardJson(card), await loadPhoto(patientId));
  sendDocx(res, buffer, `Медицинская карта ${card.cardNumber}.docx`);
};

// GET /doctor/patients/:patientId/referrals/:referralId.docx
exports.downloadReferral = async (req, res) => {
  const patientId = await ownPatientId(req);
  const card = await loadCard(patientId);
  const referral = card.referrals.id(req.params.referralId);
  if (!referral) throw new ApiError(404, 'Направление не найдено');
  const buffer = await buildReferralDocx(cardJson(card), referral.toObject());
  sendDocx(res, buffer, `Направление ${referral.number}.docx`);
};
