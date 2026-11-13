const hub = require('../hub');
const { bus, EVENTS } = require('../bus');
const { createLimiter } = require('../limiter');
const chat = require('../../services/chatService');
const queue = require('../../services/deliveryQueue');
const Message = require('../../mongo/models/Message');
const Conversation = require('../../mongo/models/Conversation');
const ApiError = require('../../utils/ApiError');
const { isConnected } = require('../../config/mongo');

const { rooms } = hub;

// Канал чата «пациент — врач».
// Правило одно для всех: сообщение СНАЧАЛА сохраняется в MongoDB, и только потом доставляется.
//   адресат в сети      -> сразу по сокету (в его личную комнату: у него может быть открыто несколько вкладок)
//   адресата нет в сети -> id встаёт в очередь доставки (Redis), отправитель видит «будет доставлено, когда врач в сети»;
//                          при подключении адресата очередь выдаётся ему автоматически
// Режима «сокет или очередь» нет, поэтому нет и гонки в момент переключения: сообщение не теряется ни в одном из случаев.
// Подтверждённое «доставлено» — это «передано подключённому клиенту»; если связь оборвалась в этот момент, клиент
// при переподключении догружает пропущенное через GET /chat/conversations/:id/messages?after=<seq>.

const sendLimiter = createLimiter({ capacity: 5, refillPerSecond: 0.5 }); // 5 сообщений подряд, дальше одно в 2 секунды
const openLimiter = createLimiter({ capacity: 20, refillPerSecond: 1 });

const reply = (ack, payload) => { if (typeof ack === 'function') ack(payload); };

function failure(err) {
  if (err instanceof ApiError) return { ok: false, code: err.statusCode, error: err.message };
  if (err?.name?.startsWith('Mongo')) return { ok: false, code: 503, error: 'Чат временно недоступен. Повторите попытку позже' };
  console.error(`Realtime chat: ${err?.stack || err}`);
  return { ok: false, code: 500, error: 'Внутренняя ошибка сервера' };
}

function requireStorage() {
  if (!isConnected()) throw new ApiError(503, 'Чат временно недоступен. Повторите попытку позже');
}

async function emitUnread(key) {
  try {
    hub.emit(key, 'unread:changed', await chat.unreadSummaryForKey(key));
  } catch (err) {
    console.error(`Realtime chat: не удалось отправить счётчик непрочитанных: ${err.message}`);
  }
}

// ---------- доставка ----------

// Доставка недоставленных сообщений адресату по очереди. Для одного адресата выполняется строго по очереди,
// чтобы порядок сообщений не перемешался, если подключение и новое сообщение случились одновременно
const flushing = new Map();

function flushPending(key) {
  const previous = flushing.get(key) ?? Promise.resolve();
  const current = previous
    .then(() => deliverPending(key))
    .catch((err) => { console.error(`Realtime chat: не удалось доставить очередь ${key}: ${err.message}`); });
  flushing.set(key, current);
  current.then(() => { if (flushing.get(key) === current) flushing.delete(key); });
  return current;
}

async function deliverPending(key) {
  if (!isConnected() || !hub.isOnline(key)) return; // адресат снова пропал — сообщения остаются в очереди
  const pending = await queue.takePending(key);
  if (!pending.length) return;

  const now = new Date();
  pending.forEach((message) => {
    hub.emit(key, 'chat:message', { conversationId: String(message.conversationId), message: chat.serializeMessage({ ...message, deliveredAt: now }) });
  });
  await Message.updateMany({ _id: { $in: pending.map((message) => message._id) }, deliveredAt: null }, { $set: { deliveredAt: now } });

  // отправителям: «доставлено» (одним событием на беседу)
  const byConversation = new Map();
  pending.forEach((message) => {
    const id = String(message.conversationId);
    byConversation.set(id, [...(byConversation.get(id) ?? []), message]);
  });
  const conversations = await Conversation.find({ _id: { $in: [...byConversation.keys()] } }).lean();
  conversations.forEach((conversation) => {
    const list = byConversation.get(String(conversation._id));
    ['patient', 'doctor'].forEach((from) => {
      const seqs = list.filter((message) => message.from === from).map((message) => message.seq);
      if (seqs.length) hub.emit(chat.keyFor(conversation, from), 'chat:delivered', { conversationId: String(conversation._id), seqs, deliveredAt: now });
    });
  });
  await emitUnread(key);
}

// Что делать со свежим сообщением. Возвращает 'delivered' или 'queued' — это видит отправитель
async function dispatch({ conversation, message, participant, duplicate }) {
  if (duplicate) return message.deliveredAt ? 'delivered' : 'queued'; // повторная отправка: ничего не рассылаем второй раз

  const senderKey = chat.keyOf(participant);
  const recipientKey = message.recipientKey;
  const conversationId = String(conversation._id);

  // другие вкладки отправителя тоже видят своё сообщение (эта вкладка получит его в ответе и отсеет повтор по clientMsgId)
  hub.emit(senderKey, 'chat:message', { conversationId, message: chat.serializeMessage(message) });

  let delivery = 'queued';
  if (hub.isOnline(recipientKey)) {
    const now = new Date();
    hub.emit(recipientKey, 'chat:message', { conversationId, message: chat.serializeMessage({ ...message.toObject(), deliveredAt: now }) });
    await Message.updateOne({ _id: message._id, deliveredAt: null }, { $set: { deliveredAt: now } });
    // отправитель (во всех своих вкладках) узнаёт, что сообщение дошло: в событии выше оно ещё «в пути»
    hub.emit(senderKey, 'chat:delivered', { conversationId, seqs: [message.seq], deliveredAt: now });
    delivery = 'delivered';
  } else {
    await queue.enqueue(recipientKey, message._id);
    // адресат мог подключиться как раз между проверкой и постановкой в очередь: проверяем ещё раз и забираем сами
    if (hub.isOnline(recipientKey)) {
      await flushPending(recipientKey);
      const fresh = await Message.findById(message._id).select('deliveredAt').lean();
      if (fresh?.deliveredAt) delivery = 'delivered';
    }
  }
  await Promise.all([emitUnread(recipientKey), emitUnread(senderKey)]);
  return delivery;
}

// Собеседнику показываем «прочитано», себе (во всех вкладках) обнуляем красный кружок
async function announceRead(conversation, side) {
  hub.emit(chat.keyFor(conversation, chat.other(side)), 'chat:read', {
    conversationId: String(conversation._id),
    side,
    upToSeq: conversation.readSeq?.[side] ?? conversation.lastSeq,
  });
  await emitUnread(chat.keyFor(conversation, side));
}

// ---------- комната беседы: «вошёл в чат» / «вышел» ----------

function sideInChat(conversationId, side) {
  const members = hub.getIo()?.sockets.adapter.rooms.get(rooms.chat(conversationId));
  return [...(members ?? [])].some((id) => hub.getIo().sockets.sockets.get(id)?.data.participant?.side === side);
}

function leaveChat(socket) {
  const open = socket.data.openChat;
  if (!open) return;
  socket.data.openChat = null;
  socket.leave(rooms.chat(open.id));
  socket.leave(rooms.presence(open.peerKey));
  const { side } = socket.data.participant;
  // у аккаунта может быть несколько вкладок: «вышел», только когда закрылась последняя
  if (!sideInChat(open.id, side)) hub.emit(rooms.chat(open.id), 'chat:peer', { conversationId: open.id, side, state: 'left' });
}

// ---------- подключение ----------

// Тем, кто не вправе пользоваться чатом, на любое действие отвечаем отказом: без ответа клиент ждал бы подтверждение вечно
function deny(socket, code, error) {
  ['chat:open', 'chat:send', 'chat:read'].forEach((event) => socket.on(event, (data, ack) => reply(ack, { ok: false, code, error })));
}

function register(socket) {
  if (!socket.data.identity) {
    deny(socket, 401, 'Войдите в аккаунт, чтобы задать вопрос врачу');
    return;
  }
  const participant = chat.participantFrom(socket.data.identity);
  if (!participant) {
    // регистратура и администратор в чат не допускаются: переписка врачебная
    deny(socket, 403, 'Вопросы врачу доступны пациентам и врачам');
    return;
  }
  socket.data.participant = participant;
  const userKey = `u${participant.userId}`;

  // Открыть беседу: вступаем в её комнату и начинаем следить, в сети ли собеседник
  socket.on('chat:open', async (data, ack) => {
    try {
      requireStorage();
      if (!openLimiter.take(userKey)) throw new ApiError(429, 'Слишком часто. Подождите немного');
      const conversation = await chat.loadConversation(participant, data?.conversationId);
      leaveChat(socket); // вкладка показывает одну беседу
      const id = String(conversation._id);
      const peerKey = chat.keyFor(conversation, chat.other(participant.side));
      await socket.join([rooms.chat(id), rooms.presence(peerKey)]);
      socket.data.openChat = { id, peerKey };
      socket.to(rooms.chat(id)).emit('chat:peer', { conversationId: id, side: participant.side, state: 'joined' });
      reply(ack, { ok: true, present: hub.isPresent(peerKey), peerInChat: sideInChat(id, chat.other(participant.side)) });
    } catch (err) {
      reply(ack, failure(err));
    }
  });

  socket.on('chat:close', () => leaveChat(socket));

  // Отправить сообщение. Ответ (ack) приходит только после записи в MongoDB
  socket.on('chat:send', async (data, ack) => {
    try {
      requireStorage();
      if (!sendLimiter.take(userKey)) throw new ApiError(429, 'Слишком часто. Подождите несколько секунд');
      const saved = await chat.sendMessage(participant, data?.conversationId, data?.text, data?.clientMsgId);
      const delivery = await dispatch({ ...saved, participant });
      reply(ack, { ok: true, delivery, message: chat.serializeMessage(saved.message) });
    } catch (err) {
      reply(ack, failure(err));
    }
  });

  socket.on('chat:read', async (data, ack) => {
    try {
      requireStorage();
      if (!openLimiter.take(userKey)) throw new ApiError(429, 'Слишком часто. Подождите немного');
      const { conversation, changed } = await chat.markRead(participant, data?.conversationId);
      if (changed) await announceRead(conversation, participant.side);
      reply(ack, { ok: true });
    } catch (err) {
      reply(ack, failure(err));
    }
  });

  socket.on('disconnecting', () => leaveChat(socket));
}

// После входа: выдать накопленное, пока человека не было в сети, и прислать счётчик непрочитанных
async function onConnected(socket) {
  const { participant } = socket.data;
  if (!participant || !isConnected()) return;
  const key = chat.keyOf(participant);
  try {
    await flushPending(key);
    socket.emit('unread:changed', await chat.unreadSummaryForKey(key));
  } catch (err) {
    console.error(`Realtime chat: не удалось подготовить подключение ${key}: ${err.message}`);
  }
}

// Беседу прочитали через обычный запрос (REST): собеседнику всё равно нужно показать «прочитано»
bus.on(EVENTS.CHAT_READ, ({ conversation, side }) => {
  announceRead(conversation, side).catch((err) => console.error(`Realtime chat: ${err.message}`));
});

module.exports = { register, onConnected, flushPending };
