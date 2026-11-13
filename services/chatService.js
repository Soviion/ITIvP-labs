const { Doctor, Specialty, Patient, User } = require('../models');
const Conversation = require('../mongo/models/Conversation');
const Message = require('../mongo/models/Message');
const ApiError = require('../utils/ApiError');

// Вся логика чата «пациент — врач» в одном месте: права, сообщения, непрочитанные, история.
// Сервис ничего не знает о сокетах; доставкой адресату занимается realtime/channels/chat.js.
// Участники — только пациент и врач этой беседы. Администратор и регистратура в чат не допускаются
// (переписка врачебная), хотя middleware/roles.js в остальном пропускает администратора всюду.

const MAX_TEXT = 2000;
const MAX_NEW_CONVERSATIONS_PER_DAY = 5;
const PAGE_SIZE = 50;
const MAX_LIST = 100;
const CLIENT_ID = /^[A-Za-z0-9_-]{8,64}$/;
const OBJECT_ID = /^[0-9a-f]{24}$/i;

const other = (side) => (side === 'patient' ? 'doctor' : 'patient');

// Участник по данным входа. Роль и привязка пришли из базы, а не из токена
function participantFrom({ userId, role, patientId, doctorId }) {
  if (role === 'patient' && patientId) return { side: 'patient', userId, patientId };
  if (role === 'doctor' && doctorId) return { side: 'doctor', userId, doctorId };
  return null;
}

// То же для обычного HTTP-запроса (в сокете это считается один раз при подключении)
async function participantForUser(userId, role) {
  if (role === 'patient') {
    const patient = await Patient.findOne({ where: { userId }, attributes: ['id'] });
    return participantFrom({ userId, role, patientId: patient?.id });
  }
  if (role === 'doctor') {
    const user = await User.findByPk(userId, { attributes: ['doctorId'] });
    return participantFrom({ userId, role, doctorId: user?.doctorId });
  }
  return null;
}

// Комната стороны беседы: у пациента — аккаунт (user:N), у врача — карточка врача (doctor:N)
const keyFor = (conversation, side) => (side === 'patient' ? `user:${conversation.patientUserId}` : `doctor:${conversation.doctorId}`);
const keyOf = (participant) => (participant.side === 'patient' ? `user:${participant.userId}` : `doctor:${participant.doctorId}`);

// ---------- доступ к беседе ----------

async function loadConversation(participant, id) {
  // строго строка из 24 hex-символов: объект вместо id (попытка подставить оператор запроса) сюда не пройдёт
  if (typeof id !== 'string' || !OBJECT_ID.test(id)) throw new ApiError(404, 'Беседа не найдена');
  const conversation = await Conversation.findById(id);
  const mine = conversation && (participant.side === 'patient'
    ? conversation.patientId === participant.patientId
    : conversation.doctorId === participant.doctorId);
  // чужую беседу не выдаём и не подтверждаем, что она существует
  if (!mine) throw new ApiError(404, 'Беседа не найдена');
  return conversation;
}

// Пациент открывает беседу с врачом (создаётся при первом обращении, дальше возвращается та же)
async function openConversation(participant, rawDoctorId) {
  if (participant.side !== 'patient') throw new ApiError(403, 'Задать вопрос может только пациент');
  const doctorId = Number(rawDoctorId);
  if (!Number.isInteger(doctorId) || doctorId < 1) throw new ApiError(400, 'Выберите врача');

  const doctor = await Doctor.findOne({ where: { id: doctorId, isActive: true }, attributes: ['id'] });
  if (!doctor) throw new ApiError(404, 'Врач не найден или не ведёт приём');
  // вопрос некому читать, если у врача нет аккаунта в кабинете «Моя клиника»
  const account = await User.findOne({ where: { doctorId, role: 'doctor', isVerified: true }, attributes: ['id'] });
  if (!account) throw new ApiError(409, 'Этот врач пока не принимает вопросы онлайн');

  const pair = { patientId: participant.patientId, doctorId };
  let conversation = await Conversation.findOne(pair);
  if (!conversation) {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    // защита от рассылки вопросов всем врачам подряд
    if (await Conversation.countDocuments({ patientId: pair.patientId, createdAt: { $gte: today } }) >= MAX_NEW_CONVERSATIONS_PER_DAY) {
      throw new ApiError(429, 'Сегодня вы уже обратились к нескольким врачам. Попробуйте завтра или продолжите уже начатые беседы');
    }
    try {
      conversation = await Conversation.create({ ...pair, patientUserId: participant.userId });
    } catch (err) {
      if (err.code !== 11000) throw err; // две вкладки создали беседу одновременно — берём ту, что успела
      conversation = await Conversation.findOne(pair);
    }
  }
  return conversation;
}

// ---------- сообщения ----------

const serializeMessage = (message) => ({
  id: String(message._id),
  conversationId: String(message.conversationId),
  seq: message.seq,
  from: message.from,
  text: message.text,
  clientMsgId: message.clientMsgId,
  createdAt: message.createdAt,
  deliveredAt: message.deliveredAt ?? null,
});

function normalizeText(raw) {
  if (typeof raw !== 'string') throw new ApiError(400, 'Введите текст сообщения');
  // управляющие символы убираем (перенос строки оставляем), пустое сообщение не принимаем
  // eslint-disable-next-line no-control-regex
  const text = raw.replace(/\r\n?/g, '\n').replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F]/g, '').trim();
  if (!text) throw new ApiError(400, 'Введите текст сообщения');
  if (text.length > MAX_TEXT) throw new ApiError(400, `Сообщение: не больше ${MAX_TEXT} символов`);
  return text;
}

// Сохраняет сообщение. Повтор с тем же clientMsgId (клиент не получил подтверждение и отправил снова) дубль не создаёт.
// Номер seq и счётчики непрочитанных меняются одной атомарной операцией в самой беседе
async function sendMessage(participant, conversationId, rawText, clientMsgId) {
  const conversation = await loadConversation(participant, conversationId);
  const text = normalizeText(rawText);
  if (typeof clientMsgId !== 'string' || !CLIENT_ID.test(clientMsgId)) throw new ApiError(400, 'Некорректный идентификатор сообщения');

  const known = await Message.findOne({ conversationId: conversation._id, clientMsgId });
  if (known) return { conversation, message: known, duplicate: true };

  const { side } = participant;
  const peer = other(side);
  const updated = await Conversation.findOneAndUpdate(
    { _id: conversation._id },
    [
      {
        $set: {
          lastSeq: { $add: ['$lastSeq', 1] },
          lastMessageAt: '$$NOW',
          [`unread.${peer}`]: { $add: [{ $ifNull: [`$unread.${peer}`, 0] }, 1] },
          [`unread.${side}`]: 0, // отправитель, очевидно, всё прочитал
        },
      },
      { $set: { [`readSeq.${side}`]: '$lastSeq' } },
    ],
    { returnDocument: 'after', updatePipeline: true },
  );

  try {
    const message = await Message.create({
      conversationId: updated._id,
      seq: updated.lastSeq,
      from: side,
      recipientKey: keyFor(updated, peer),
      text,
      clientMsgId,
    });
    return { conversation: updated, message, duplicate: false };
  } catch (err) {
    // сообщение не записалось: возвращаем счётчик (пропущенный номер seq безвреден, он нужен только для порядка)
    await Conversation.updateOne({ _id: updated._id, [`unread.${peer}`]: { $gt: 0 } }, { $inc: { [`unread.${peer}`]: -1 } }).catch(() => {});
    if (err.code === 11000) {
      const existing = await Message.findOne({ conversationId: updated._id, clientMsgId });
      if (existing) return { conversation: updated, message: existing, duplicate: true };
    }
    throw err;
  }
}

// Отметить беседу прочитанной до последнего сообщения. changed = false, если читать было нечего
async function markRead(participant, conversationId) {
  const conversation = await loadConversation(participant, conversationId);
  const { side } = participant;
  const updated = await Conversation.findOneAndUpdate(
    { _id: conversation._id, [`unread.${side}`]: { $gt: 0 } },
    [{ $set: { [`readSeq.${side}`]: '$lastSeq', [`unread.${side}`]: 0 } }],
    { returnDocument: 'after', updatePipeline: true },
  );
  return { conversation: updated ?? conversation, changed: Boolean(updated) };
}

const toSeq = (value) => {
  const seq = Number(value);
  if (!Number.isInteger(seq) || seq < 0) throw new ApiError(400, 'Некорректный номер сообщения');
  return seq;
};

// Страница истории. По умолчанию — последние; before — более старые; after — всё новее указанного
// (так клиент догружает пропущенное после обрыва связи)
async function history(participant, conversationId, { before, after, limit } = {}) {
  const conversation = await loadConversation(participant, conversationId);
  const size = Math.min(Math.max(Number(limit) || PAGE_SIZE, 1), MAX_LIST);
  const filter = { conversationId: conversation._id };

  let rows;
  if (after !== undefined) {
    filter.seq = { $gt: toSeq(after) };
    rows = await Message.find(filter).sort({ seq: 1 }).limit(size + 1).lean();
  } else {
    if (before !== undefined) filter.seq = { $lt: toSeq(before) };
    rows = (await Message.find(filter).sort({ seq: -1 }).limit(size + 1).lean()).reverse();
  }
  const hasMore = rows.length > size;
  if (hasMore) rows = after !== undefined ? rows.slice(0, size) : rows.slice(1);
  return { conversation, messages: rows.map(serializeMessage), hasMore };
}

// ---------- списки и счётчики ----------

// Имена собеседников берутся из PostgreSQL при выдаче, а не копируются в беседу: переименование врача видно сразу
async function counterparts(conversations, side) {
  if (side === 'patient') {
    const doctors = await Doctor.findAll({
      where: { id: [...new Set(conversations.map((item) => item.doctorId))] },
      include: [{ model: Specialty, as: 'specialty', attributes: ['name'] }],
      paranoid: false,
    });
    return new Map(doctors.map((doctor) => [doctor.id, { id: doctor.id, name: doctor.fullName, subtitle: doctor.specialty?.name ?? '' }]));
  }
  const patients = await Patient.findAll({
    where: { id: [...new Set(conversations.map((item) => item.patientId))] },
    attributes: ['id', 'lastName', 'firstName', 'middleName'],
    paranoid: false,
  });
  return new Map(patients.map((patient) => [patient.id, { id: patient.id, name: patient.fullName, subtitle: 'Пациент' }]));
}

async function describe(conversations, participant) {
  if (!conversations.length) return [];
  const { side } = participant;
  const peer = other(side);
  const people = await counterparts(conversations, side);
  // Последнее сообщение ищем по самому большому номеру, а не по lastSeq: при одновременной повторной отправке
  // один номер может остаться пустым (пропуск в нумерации безвреден, но в конце беседы не должен «стирать» последний текст)
  const last = await Promise.all(conversations.map((item) => Message.findOne({ conversationId: item._id }).sort({ seq: -1 }).lean()));
  const lastByConversation = new Map(last.filter(Boolean).map((message) => [String(message.conversationId), message]));

  return conversations.map((item) => {
    const lastMessage = lastByConversation.get(String(item._id));
    const personId = side === 'patient' ? item.doctorId : item.patientId;
    return {
      id: String(item._id),
      side,
      counterpart: people.get(personId) ?? { id: personId, name: 'Собеседник', subtitle: '' },
      unread: item.unread?.[side] ?? 0,
      lastSeq: item.lastSeq,
      peerReadSeq: item.readSeq?.[peer] ?? 0, // до какого сообщения собеседник прочитал: отсюда «прочитано» у своих сообщений
      lastMessageAt: item.lastMessageAt,
      lastFrom: lastMessage?.from ?? null,
      lastText: lastMessage ? lastMessage.text.slice(0, 120) : '',
    };
  });
}

const describeOne = async (conversation, participant) => (await describe([conversation], participant))[0];

// Беседы участника, в которых уже есть сообщения (пустые, открытые «на всякий случай», в списке не показываем)
async function listConversations(participant) {
  const filter = participant.side === 'patient' ? { patientId: participant.patientId } : { doctorId: participant.doctorId };
  const rows = await Conversation.find({ ...filter, lastSeq: { $gt: 0 } }).sort({ lastMessageAt: -1 }).limit(MAX_LIST);
  return describe(rows, participant);
}

// Сколько бесед с непрочитанным и сколько в каждой: отсюда красный кружок. Считается по базе, а не по событиям,
// поэтому пропущенное во время обрыва связи не теряется
async function unreadSummaryForKey(key) {
  const [kind, rawId] = String(key).split(':');
  const side = kind === 'doctor' ? 'doctor' : 'patient';
  const filter = side === 'doctor' ? { doctorId: Number(rawId) } : { patientUserId: Number(rawId) };
  const rows = await Conversation.find({ ...filter, [`unread.${side}`]: { $gt: 0 } }).select('unread').lean();
  return { total: rows.length, items: rows.map((row) => ({ conversationId: String(row._id), unread: row.unread[side] })) };
}

const unreadSummary = (participant) => unreadSummaryForKey(keyOf(participant));

module.exports = {
  other,
  keyFor,
  keyOf,
  participantFrom,
  participantForUser,
  openConversation,
  loadConversation,
  sendMessage,
  markRead,
  history,
  describe,
  describeOne,
  listConversations,
  unreadSummary,
  unreadSummaryForKey,
  serializeMessage,
};
