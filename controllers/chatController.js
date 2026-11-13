const chat = require('../services/chatService');
const { bus, EVENTS } = require('../realtime/bus');
const ApiError = require('../utils/ApiError');
const { getBody } = require('../utils/request');

// REST-часть чата: открыть беседу, список, история, счётчик непрочитанных. Сообщения отправляются по сокету
// (realtime/channels/chat.js) — там доставка и подтверждение; всё остальное, что нужно при загрузке страницы или
// после обрыва связи, берётся отсюда. Права проверяет тот же chatService, что и в сокете.

async function participantOrFail(req) {
  const participant = await chat.participantForUser(req.user.id, req.user.role);
  if (!participant) throw new ApiError(403, 'Вопросы врачу доступны пациентам и врачам');
  return participant;
}

// POST /chat/conversations { doctorId } — пациент открывает беседу с врачом (при первом обращении она создаётся)
exports.open = async (req, res) => {
  const participant = await participantOrFail(req);
  const conversation = await chat.openConversation(participant, getBody(req).doctorId);
  res.status(201).json(await chat.describeOne(conversation, participant));
};

// GET /chat/conversations — мои беседы, в которых уже есть сообщения
exports.list = async (req, res) => {
  res.json(await chat.listConversations(await participantOrFail(req)));
};

// GET /chat/unread — сколько бесед с непрочитанным
exports.unread = async (req, res) => {
  res.json(await chat.unreadSummary(await participantOrFail(req)));
};

// GET /chat/conversations/:id/messages?before=<seq>|after=<seq>&limit=50
exports.messages = async (req, res) => {
  const participant = await participantOrFail(req);
  const { before, after, limit } = req.query;
  const { conversation, messages, hasMore } = await chat.history(participant, req.params.id, { before, after, limit });
  res.json({ conversation: await chat.describeOne(conversation, participant), messages, hasMore });
};

// POST /chat/conversations/:id/read — отметить прочитанным (собеседнику придёт «прочитано» через сокет)
exports.read = async (req, res) => {
  const participant = await participantOrFail(req);
  const { conversation, changed } = await chat.markRead(participant, req.params.id);
  if (changed) bus.emit(EVENTS.CHAT_READ, { conversation, side: participant.side });
  res.json({ ok: true });
};
