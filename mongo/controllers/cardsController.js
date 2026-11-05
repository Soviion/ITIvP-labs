const mongoose = require('mongoose');
const ApiError = require('../../utils/ApiError');
const { getBody } = require('../../utils/request');
const MedicalCard = require('../models/MedicalCard');
const LabResult = require('../models/LabResult');
const { snapshotFromPostgres } = require('../services/cardSnapshot');
const { mirror, syncRecordFromCard, syncRecordListChange, syncPatientFromCard, PROFILE_FIELDS } = require('../../services/cardSync');

const CARD_FIELDS = ['patientId', 'cardNumber', 'patient', 'bloodType', 'heightCm', 'weightKg', 'anamnesis', 'allergies', 'tags', 'diseases', 'medications', 'visits'];
const pick = (source, keys) => Object.fromEntries(keys.filter((key) => source[key] !== undefined).map((key) => [key, source[key]]));
const escapeRegExp = (text) => text.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

const notFound = (id) => new ApiError(404, `Карта с id=${id} не найдена`);
const updateOptions = { new: true, runValidators: true }; 

// CRUD'ы

// GET Запрос строится цепочкой методов query: find().where().sort().skip().limit()
exports.list = async (req, res) => {
  const { q, tag, disease, bloodType, sort = 'name' } = req.query;
  const limit = Math.min(Math.max(Number.parseInt(req.query.limit, 10) || 10, 1), 50);
  const page = Math.max(Number.parseInt(req.query.page, 10) || 1, 1);

  const filter = MedicalCard.find();
  if (q) {
    const pattern = new RegExp(escapeRegExp(String(q)), 'i');
    filter.or([{ 'patient.lastName': pattern }, { 'patient.firstName': pattern }, { cardNumber: pattern }]);
  }
  if (tag) filter.where('tags').equals(String(tag).toLowerCase()); // массив содержит значение
  if (disease) filter.where('diseases.name', new RegExp(escapeRegExp(String(disease)), 'i')); // поле во вложенных документах
  if (bloodType) filter.where('bloodType').equals(bloodType);
  if (Number.isInteger(Number(req.query.patientId)) && req.query.patientId) filter.where('patientId').equals(Number(req.query.patientId)); // карта конкретного пациента

  const sortBy = { name: { 'patient.lastName': 1, 'patient.firstName': 1 }, '-name': { 'patient.lastName': -1 }, updated: { updatedAt: -1 } }[sort] ?? { 'patient.lastName': 1 };
  const total = await MedicalCard.countDocuments(filter.getFilter());
  const data = await filter
    .select('-visits') // проекция: в списке приёмы не нужны
    .sort(sortBy)
    .skip((page - 1) * limit)
    .limit(limit);

  res.json({ page, limit, total, pages: Math.ceil(total / limit), data });
};

// GET получение карты по id
exports.getById = async (req, res) => {
  const card = await MedicalCard.findById(req.params.id).populate('labResults');
  if (!card) throw notFound(req.params.id);
  res.json(card);
};

// POST создание карты
exports.create = async (req, res) => {
  const data = pick(getBody(req), CARD_FIELDS);
  if (data.patientId !== undefined && !data.patient) {
    Object.assign(data, { ...(await snapshotFromPostgres(Number(data.patientId))), ...data });
  }
  const card = await MedicalCard.create(data);
  // если карта заведена для настоящего пациента, общие данные попадают и в его кабинет (PostgreSQL)
  await mirror('создание карты', () => syncRecordFromCard(card, Object.keys(data)));
  res.status(201).json(card);
};

// PUT обновление мед карты
exports.update = async (req, res) => {
  const changes = pick(getBody(req), CARD_FIELDS);
  const card = await MedicalCard.findByIdAndUpdate(req.params.id, changes, updateOptions);
  if (!card) throw notFound(req.params.id);
  // то, что изменили в личном деле, обновляется и в кабинете пациента
  await mirror('изменение карты', async () => {
    await syncRecordFromCard(card, Object.keys(changes));
    await syncPatientFromCard(card, Object.keys(changes.patient ?? {}).filter((field) => PROFILE_FIELDS.includes(field)));
  });
  res.json(card);
};

// DELETE удаление карты 
exports.remove = async (req, res) => {
  const card = await MedicalCard.findByIdAndDelete(req.params.id);
  if (!card) throw notFound(req.params.id);
  res.json({ message: 'Карта удалена вместе с анализами', card });
};


// POST создание приема врача
exports.addVisit = async (req, res) => {
  const card = await MedicalCard.findById(req.params.id);
  if (!card) throw notFound(req.params.id);
  await card.addVisit(getBody(req));
  res.status(201).json(card.visits[card.visits.length - 1]);
};

// POST добавление болезни в массив
exports.addDisease = async (req, res) => {
  const card = await MedicalCard.findByIdAndUpdate(req.params.id, { $push: { diseases: getBody(req) } }, updateOptions);
  if (!card) throw notFound(req.params.id);
  await mirror('добавление заболевания', () => syncRecordListChange(card.patientId, 'diseases', { added: card.diseases[card.diseases.length - 1] }));
  res.status(201).json(card.diseases);
};

// DELETE удаление элемента из массива
exports.removeDisease = async (req, res) => {
  const before = await MedicalCard.findById(req.params.id);
  const removed = before?.diseases.id(req.params.diseaseId);
  const card = await MedicalCard.findByIdAndUpdate(req.params.id, { $pull: { diseases: { _id: req.params.diseaseId } } }, { new: true });
  if (!card) throw notFound(req.params.id);
  if (removed) await mirror('удаление заболевания', () => syncRecordListChange(card.patientId, 'diseases', { removed }));
  res.json(card.diseases);
};

// POST добавление препарата
exports.addMedication = async (req, res) => {
  const card = await MedicalCard.findByIdAndUpdate(req.params.id, { $push: { medications: getBody(req) } }, updateOptions);
  if (!card) throw notFound(req.params.id);
  await mirror('добавление препарата', () => syncRecordListChange(card.patientId, 'medications', { added: card.medications[card.medications.length - 1] }));
  res.status(201).json(card.medications);
};

// PATCH изменение элементов массива по параметрам
exports.updateMedication = async (req, res) => {
  const body = getBody(req);
  const set = {};
  ['name', 'dose', 'schedule', 'active'].forEach((field) => {
    if (body[field] !== undefined) set[`medications.$.${field}`] = body[field];
  });
  if (!Object.keys(set).length) throw new ApiError(400, 'Не переданы поля для обновления: name, dose, schedule, active');

  const before = await MedicalCard.findOne({ _id: req.params.id, 'medications._id': req.params.medId });
  const oldMedication = before?.medications.id(req.params.medId)?.toObject();
  const card = await MedicalCard.findOneAndUpdate({ _id: req.params.id, 'medications._id': req.params.medId }, { $set: set }, updateOptions);
  if (!card) throw new ApiError(404, 'Карта или препарат не найдены');
  await mirror('изменение препарата', () => syncRecordListChange(card.patientId, 'medications', { replaced: [oldMedication, card.medications.id(req.params.medId)] }));
  res.json(card.medications.id(req.params.medId));
};

// POST продление курса препаратов пациента
exports.extendPrescription = async (req, res) => {
  const { drug, days } = getBody(req);
  const extra = Number(days);
  if (typeof drug !== 'string' || !drug.trim() || !Number.isInteger(extra) || extra < 1) {
    throw new ApiError(400, 'Нужны drug (название препарата) и days (целое число дней, больше нуля)');
  }

  const card = await MedicalCard.findOne({ _id: req.params.id, 'visits._id': req.params.visitId });
  const prescription = card?.visits.id(req.params.visitId)?.prescriptions.find((item) => item.drug === drug.trim());
  if (!prescription) throw new ApiError(404, 'Карта, приём или назначение не найдены');
  if (prescription.days + extra > 365) throw new ApiError(400, `Курс не может быть длиннее 365 дней (сейчас ${prescription.days})`);

  const updated = await MedicalCard.findOneAndUpdate(
    { _id: req.params.id },
    { $inc: { 'visits.$[visit].prescriptions.$[drug].days': extra } },
    {
      new: true,
      arrayFilters: [{ 'visit._id': new mongoose.Types.ObjectId(req.params.visitId) }, { 'drug.drug': drug.trim() }],
    },
  );
  res.json(updated.visits.id(req.params.visitId));
};


// вспомогательные
exports.addTags = async (req, res) => {
  const { tags } = getBody(req);
  if (!Array.isArray(tags) || !tags.length) throw new ApiError(400, 'Передайте tags — непустой массив строк');
  const card = await MedicalCard.findByIdAndUpdate(req.params.id, { $addToSet: { tags: { $each: tags } } }, updateOptions);
  if (!card) throw notFound(req.params.id);
  res.json(card.tags);
};

exports.removeTag = async (req, res) => {
  const card = await MedicalCard.findByIdAndUpdate(req.params.id, { $pull: { tags: req.params.tag.toLowerCase() } }, { new: true });
  if (!card) throw notFound(req.params.id);
  res.json(card.tags);
};

exports.addLab = async (req, res) => {
  if (!(await MedicalCard.exists({ _id: req.params.id }))) throw notFound(req.params.id);
  const lab = await LabResult.create({ ...getBody(req), card: req.params.id });
  res.status(201).json(lab);
};

exports.listLabs = async (req, res) => {
  if (!(await MedicalCard.exists({ _id: req.params.id }))) throw notFound(req.params.id);
  res.json(await LabResult.find({ card: req.params.id }).sort('-takenAt'));
};

exports.statsByDoctor = async (req, res) => {
  const stats = await MedicalCard.aggregate([
    { $unwind: '$visits' }, 
    { $group: { _id: '$visits.doctor.name', specialty: { $first: '$visits.doctor.specialty' }, visits: { $sum: 1 }, patients: { $addToSet: '$_id' } } },
    { $project: { _id: 0, doctor: '$_id', specialty: 1, visits: 1, uniquePatients: { $size: '$patients' } } },
    { $sort: { visits: -1, doctor: 1 } },
  ]);
  res.json(stats);
};

exports.statsByDiagnosis = async (req, res) => {
  const limit = Math.min(Math.max(Number.parseInt(req.query.limit, 10) || 5, 1), 50);
  const stats = await MedicalCard.aggregate([
    { $unwind: '$visits' },
    { $group: { _id: '$visits.diagnosis', icdCode: { $first: '$visits.icdCode' }, count: { $sum: 1 }, lastVisit: { $max: '$visits.date' } } },
    { $sort: { count: -1, _id: 1 } },
    { $limit: limit },
    { $project: { _id: 0, diagnosis: '$_id', icdCode: 1, count: 1, lastVisit: 1 } },
  ]);
  res.json(stats);
};
