const { MedicalRecord, Patient } = require('../models');
const MedicalCard = require('../mongo/models/MedicalCard');
const { isConnected } = require('../config/mongo');

// Медицинская карта живёт в двух базах: личное дело врача в MongoDB и карта пациента в PostgreSQL (кабинет пациента).
// Общие данные (группа крови, рост, вес, аллергии, заболевания, препараты, часть профиля) при любом изменении
// в одной базе переносятся в другую, чтобы пациент и врач всегда видели одно и то же.
// Если у пациента нет личного дела (или записи в PostgreSQL), перенос просто ничего не делает.

const MAX_ITEMS = 30;
const MAX_LENGTH = 120;

const normalize = (text) => String(text ?? '').trim().replace(/\s+/g, ' ').toLowerCase();
const CODE_TAIL = /\s*\(([A-Za-z]\d{2}(?:\.\d{1,2})?)\)$/;
const stripCode = (text) => normalize(String(text ?? '').replace(CODE_TAIL, ''));
const unique = (list) => list.filter((item, index) => item && list.findIndex((other) => normalize(other) === normalize(item)) === index);

// Строка списка в кабинете пациента ↔ вложенный документ в личном деле
const diseaseLine = (disease) => {
  const code = /МКБ-10:\s*([A-Za-z]\d{2}(?:\.\d{1,2})?)/.exec(disease.note ?? '')?.[1];
  return code ? `${disease.name} (${code})` : disease.name;
};
const medicationLine = (medication) => {
  const main = [medication.name, medication.dose].filter(Boolean).join(' ');
  return medication.schedule ? `${main}, ${medication.schedule}` : main;
};
const diseaseFromLine = (line) => {
  const match = CODE_TAIL.exec(line);
  return match
    ? { name: line.replace(CODE_TAIL, '').slice(0, MAX_LENGTH), note: `МКБ-10: ${match[1].toUpperCase()}`, since: new Date() }
    : { name: line.slice(0, MAX_LENGTH), since: new Date() };
};

// Приводит массив вложенных документов к списку строк: лишние убирает, недостающие добавляет, совпавшие не трогает
function reconcile(list, lines, keyOfDoc, keyOfLine, fromLine) {
  const wanted = new Set(lines.map(keyOfLine));
  [...list].forEach((doc) => { if (!wanted.has(keyOfDoc(doc))) list.pull(doc._id); });
  const have = new Set(list.map(keyOfDoc));
  lines.forEach((line) => {
    if (!have.has(keyOfLine(line))) { list.push(fromLine(line)); have.add(keyOfLine(line)); }
  });
}

// Любая ошибка синхронизации записывается в консоль и не ломает основную операцию
async function mirror(label, action) {
  try {
    return await action();
  } catch (err) {
    console.error(`Синхронизация карты (${label}): ${err.message}`);
    return false;
  }
}

// ---------- MongoDB → PostgreSQL ----------

const RECORD_FIELDS = ['bloodType', 'heightCm', 'weightKg', 'allergies', 'diseases', 'medications'];
const PROFILE_FIELDS = ['address', 'workplace', 'insuranceNumber', 'trustedPerson', 'socialStatus'];

// fields — какие данные перенести (только затронутые операцией, остальное в PostgreSQL не трогаем)
async function syncRecordFromCard(card, fields) {
  const wanted = fields.filter((field) => RECORD_FIELDS.includes(field));
  if (!wanted.length) return false;
  const record = await MedicalRecord.findOne({ where: { patientId: card.patientId } });
  if (!record) return false;

  const changes = {};
  if (wanted.includes('bloodType')) changes.bloodType = card.bloodType ?? null; // правка врача не блокирует пациента на неделю
  if (wanted.includes('heightCm')) changes.heightCm = card.heightCm ?? null;
  if (wanted.includes('weightKg')) changes.weightKg = card.weightKg ?? null;
  if (wanted.includes('allergies')) changes.allergies = card.allergies?.length ? card.allergies.join(', ') : null;
  if (wanted.includes('diseases')) changes.diseases = unique(card.diseases.map((item) => diseaseLine(item).slice(0, MAX_LENGTH))).slice(0, MAX_ITEMS);
  if (wanted.includes('medications')) changes.medications = unique(card.medications.map((item) => medicationLine(item).slice(0, MAX_LENGTH))).slice(0, MAX_ITEMS);
  await record.update(changes);
  return true;
}

// Данные профиля, которые врач дополнил в личном деле (адрес, работа, полис и т.д.), попадают и в профиль пациента
async function syncPatientFromCard(card, fields) {
  const wanted = fields.filter((field) => PROFILE_FIELDS.includes(field));
  if (!wanted.length) return false;
  const patient = await Patient.findByPk(card.patientId);
  if (!patient) return false;
  const changes = {};
  wanted.forEach((field) => { changes[field] = card.patient?.[field] ?? null; });
  await patient.update(changes);
  return true;
}

// Точечная правка списка в кабинете пациента: добавить, убрать или заменить одну строку, остальное не трогаем.
// Так добавление одного препарата в личном деле не затирает то, что пациент вносил сам.
async function editRecordList(patientId, field, edit) {
  const record = await MedicalRecord.findOne({ where: { patientId } });
  if (!record) return false;
  const current = Array.isArray(record[field]) ? [...record[field]] : [];
  const next = edit(current);
  await record.update({ [field]: unique(next).slice(0, MAX_ITEMS) });
  return true;
}

const sameLine = (field) => (a, b) => (field === 'diseases' ? stripCode(a) === stripCode(b) : normalize(a) === normalize(b));
const lineOf = (field, doc) => (field === 'diseases' ? diseaseLine(doc) : medicationLine(doc)).slice(0, MAX_LENGTH);

// field: 'diseases' | 'medications'; added, removed – вложенные документы личного дела; replaced: [старый, новый]
async function syncRecordListChange(patientId, field, { added, removed, replaced }) {
  const same = sameLine(field);
  return editRecordList(patientId, field, (list) => {
    let result = list;
    if (removed) result = result.filter((line) => !same(line, lineOf(field, removed)));
    if (replaced) {
      const [before, after] = replaced.map((doc) => lineOf(field, doc));
      result = result.some((line) => same(line, before)) ? result.map((line) => (same(line, before) ? after : line)) : [...result, after];
    }
    if (added) result = [...result, lineOf(field, added)];
    return result;
  });
}

// ---------- PostgreSQL → MongoDB ----------

// Изменения пациента в кабинете (группа крови, рост, вес, списки) переносятся в личное дело
async function syncCardFromRecord(patientId, fields) {
  const wanted = fields.filter((field) => RECORD_FIELDS.includes(field));
  if (!wanted.length || !isConnected()) return false;
  const [card, record] = await Promise.all([MedicalCard.findOne({ patientId }), MedicalRecord.findOne({ where: { patientId } })]);
  if (!card || !record) return false;

  if (wanted.includes('bloodType')) card.bloodType = record.bloodType ?? undefined;
  if (wanted.includes('heightCm')) card.heightCm = record.heightCm ?? undefined;
  if (wanted.includes('weightKg')) card.weightKg = record.weightKg ?? undefined;
  if (wanted.includes('diseases')) {
    reconcile(card.diseases, record.diseases ?? [], (doc) => stripCode(diseaseLine(doc)), stripCode, diseaseFromLine);
  }
  if (wanted.includes('medications')) {
    reconcile(card.medications, record.medications ?? [], (doc) => normalize(medicationLine(doc)), normalize, (line) => ({ name: line.slice(0, MAX_LENGTH) }));
  }
  await card.save();
  return true;
}

// Изменения анкеты пациента (ФИО, телефон, адрес, место работы и т.д.) обновляют данные пациента в личном деле
async function refreshCardPatient(patientId) {
  if (!isConnected()) return false;
  const [card, patient] = await Promise.all([MedicalCard.findOne({ patientId }), Patient.findByPk(patientId)]);
  if (!card || !patient) return false;
  const next = {
    lastName: patient.lastName,
    firstName: patient.firstName,
    middleName: patient.middleName ?? undefined,
    birthDate: patient.birthDate ? new Date(patient.birthDate) : undefined,
    gender: patient.gender,
    phone: patient.phone,
    email: patient.email ?? undefined,
    address: patient.address ?? undefined,
    insuranceNumber: patient.insuranceNumber ?? undefined,
    socialStatus: patient.socialStatus ?? undefined,
    workplace: patient.workplace ?? undefined,
    trustedPerson: patient.trustedPerson ?? undefined,
  };
  Object.entries(next).forEach(([key, value]) => card.set(`patient.${key}`, value));
  await card.save({ validateModifiedOnly: true });
  return true;
}

module.exports = { mirror, syncRecordListChange, syncRecordFromCard, syncPatientFromCard, syncCardFromRecord, refreshCardPatient, RECORD_FIELDS, PROFILE_FIELDS };
