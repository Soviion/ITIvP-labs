const { Patient, MedicalRecord, MedicalEntry } = require('../models');
const ApiError = require('../utils/ApiError');
const { getBody } = require('../utils/request');
const ai = require('../config/ai');
const llm = require('../services/ai/llm');
const { createDailyBudget, createTtlCache } = require('../services/ai/guard');
const { SYSTEM: PATIENT_SYSTEM, staticAnswer } = require('../services/ai/patientKnowledge');
const { SYSTEM: HINT_SYSTEM, DISCLAIMER, parseHint } = require('../services/ai/doctorHint');
const { buildPayload } = require('../services/ai/deidentify');
const { assertPatientAccess } = require('./doctorPortalController');
const MedicalCard = require('../mongo/models/MedicalCard');
const LabResult = require('../mongo/models/LabResult');
const { isConnected } = require('../config/mongo');

const patientBudget = createDailyBudget(() => ai.limits().patientDaily);
const doctorBudget = createDailyBudget(() => ai.limits().doctorDaily);
const answers = createTtlCache();

const normalize = (text) => text.toLowerCase().replace(/[^\p{L}\p{N}\s]/gu, '').replace(/\s+/g, ' ').trim();

// ---------- чат для пациентов (без входа) ----------

function cleanHistory(history, { historyTurns, messageLength }) {
  if (!Array.isArray(history)) return [];
  return history
    .filter((item) => item && (item.role === 'user' || item.role === 'assistant') && typeof item.content === 'string' && item.content.trim())
    .slice(-historyTurns)
    .map((item) => ({ role: item.role, content: item.content.trim().slice(0, messageLength * 2) }));
}

// POST /assistant/chat { message, history? } → { answer, source: 'model' | 'cache' | 'static' }
exports.chat = async (req, res) => {
  const limits = ai.limits();
  const body = getBody(req);
  const message = typeof body.message === 'string' ? body.message.trim() : '';
  if (!message) throw new ApiError(400, 'Напишите вопрос');
  if (message.length > limits.messageLength) throw new ApiError(400, `Вопрос не длиннее ${limits.messageLength} символов`);
  const history = cleanHistory(body.history, limits);

  // одинаковые вопросы без контекста не тратят лимит модели
  const key = history.length ? null : normalize(message);
  const cached = key && answers.get(key);
  if (cached) return res.json({ answer: cached, source: 'cache' });

  // нет ключей или исчерпан суточный бюджет: отвечаем справочным текстом, к модели не обращаемся
  if (!ai.isEnabled() || !patientBudget.take()) return res.json({ answer: staticAnswer(message), source: 'static' });

  try {
    const { text } = await llm.chat({ system: PATIENT_SYSTEM, messages: [...history, { role: 'user', content: message }], maxTokens: 600, temperature: 0.3 });
    const answer = text.replace(/\*\*|__|^#+\s*/gm, '').slice(0, 1500);
    if (key) answers.set(key, answer);
    return res.json({ answer, source: 'model' });
  } catch {
    return res.json({ answer: staticAnswer(message), source: 'static' });
  }
};

// ---------- подсказка врачу ----------

// личное дело пациента (MongoDB), если оно есть: из него берутся анамнез и история приёмов
async function loadCard(patientId) {
  if (!isConnected()) return null;
  return MedicalCard.findOne({ patientId }).lean();
}

// история болезни: приёмы из личного дела, а если дела нет – записи о приёмах в PostgreSQL
async function loadVisits(patientId, card, record) {
  if (card?.visits?.length) return card.visits;
  if (!record) return [];
  const entries = await MedicalEntry.findAll({ where: { medicalRecordId: record.id }, order: [['createdAt', 'DESC']], limit: 6 });
  return entries.map((entry) => entry.get({ plain: true }));
}

// последние анализы пациента из личного дела (если оно есть)
async function loadLabs(card) {
  if (!card) return [];
  const results = await LabResult.find({ card: card._id }).sort('-takenAt').limit(3).lean();
  return results.flatMap((result) => result.indicators.map((indicator) => ({
    name: `${result.title}: ${indicator.name}`, value: indicator.value, unit: indicator.unit, refMin: indicator.refMin, refMax: indicator.refMax,
  })));
}

// POST /doctor/assistant/hint { patientId, complaints?, diagnosis, icdCode?, vitals?, notes? }
exports.doctorHint = async (req, res) => {
  const body = getBody(req);
  const patientId = Number(body.patientId);
  if (!Number.isInteger(patientId) || patientId < 1) throw new ApiError(400, 'Не указан пациент');
  await assertPatientAccess(req, patientId);

  const diagnosis = typeof body.diagnosis === 'string' ? body.diagnosis.trim() : '';
  if (!diagnosis) throw new ApiError(400, 'Сначала укажите диагноз: подсказка строится по нему');

  if (!ai.isEnabled()) throw new ApiError(503, 'Помощник сейчас недоступен');
  if (!doctorBudget.take()) throw new ApiError(429, 'На сегодня лимит подсказок исчерпан. Попробуйте завтра');

  const patient = await Patient.findByPk(patientId);
  if (!patient) throw new ApiError(404, 'Пациент не найден');
  const record = await MedicalRecord.findOne({ where: { patientId } });
  // сбой чтения личного дела или истории не должен лишать врача подсказки: тогда она строится по остальным данным
  const card = await loadCard(patientId).catch(() => null);
  const [labs, visits] = await Promise.all([
    loadLabs(card).catch(() => []),
    loadVisits(patientId, card, record).catch(() => []),
  ]);

  // только обезличенные данные: этот же набор показывается врачу в блоке «Что отправлено в модель»
  const sent = buildPayload({
    patient,
    record,
    card,
    visits,
    labs,
    input: { complaints: body.complaints, diagnosis, icdCode: body.icdCode, vitals: body.vitals, examination: body.notes },
  });

  // Рассуждающая модель тратит часть max_tokens на «размышления», а JSON должен прийти целиком, поэтому лимит большой.
  // temperature не передаём: такие модели управляют им сами.
  const { doctorMaxTokens, doctorTimeoutMs } = ai.limits();
  const { text, reasoning, provider, model } = await llm.chat({
    system: HINT_SYSTEM,
    messages: [{ role: 'user', content: `Данные пациента и приёма (JSON):\n${JSON.stringify(sent, null, 2)}` }],
    maxTokens: doctorMaxTokens,
    timeoutMs: doctorTimeoutMs,
    rejectTruncated: true,
  });

  res.json({ hint: parseHint(text), reasoning: reasoning.slice(0, 8000), sent, provider, model, disclaimer: DISCLAIMER });
};
