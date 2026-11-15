const { Server } = require('socket.io');
const { client } = require('../config/auth');
const hub = require('./hub');
const { allowRequest, authenticate, scheduleExpiry, startRevalidation } = require('./auth');
const slots = require('./channels/slots');
const appointments = require('./channels/appointments');
const chatChannel = require('./channels/chat');
const holds = require('./channels/holds');
const mood = require('./channels/mood');

const { rooms } = hub;

const MAX_SOCKETS_PER_USER = 8;
const MAX_GUESTS_PER_IP = 20;

// Подключает Socket.IO к HTTP-серверу, на котором уже работает Express (REST остаётся как был).
//   Комнаты (назначает только сервер):  user:N · doctor:N · staff · slots:N · presence:… · chat:ID
//   Каналы: slots (свободные талоны), appointments (живые списки), chat (вопросы врачу, непрочитанные, «в сети»)
function attachRealtime(httpServer) {
  const io = new Server(httpServer, {
    // CORS для запасного long-polling; для WebSocket-подключений Origin проверяет allowRequest
    cors: { origin: client.origins },
    allowRequest,
    // сообщение — до 2000 символов (≈4 КБ в UTF-8); лимит по умолчанию (1 МБ) позволял бы забивать память пакетами
    maxHttpBufferSize: 16 * 1024,
    pingInterval: 25000,
    pingTimeout: 20000,
  });
  hub.setIo(io);

  io.use(authenticate);
  io.on('connection', onConnection);

  appointments.listen();
  startRevalidation(io);
  return io;
}

const guestsFrom = (io, address) => [...io.sockets.sockets.values()].filter((item) => !item.data.identity && item.handshake.address === address).length;

function onConnection(socket) {
  const io = hub.getIo();
  const { identity } = socket.data;

  // гости ограничены по адресу, вошедшие — по аккаунту: защита от «залития» сервера подключениями
  if (!identity && guestsFrom(io, socket.handshake.address) > MAX_GUESTS_PER_IP) {
    socket.emit('connection:refused', { reason: 'limit' });
    socket.disconnect(true);
    return;
  }
  if (identity && hub.size(rooms.user(identity.userId)) >= MAX_SOCKETS_PER_USER) {
    socket.emit('connection:refused', { reason: 'limit' });
    socket.disconnect(true);
    return;
  }

  slots.register(socket); // расписание доступно и гостям
  holds.register(socket); // бронь времени на 15 секунд: видят все, занять может только вошедший пациент
  mood.register(socket); // опрос «Ваше настроение сегодня»: результаты видят все, голосуют вошедшие

  if (!identity) {
    chatChannel.register(socket); // гостю чат отвечает отказом «войдите»
    return;
  }

  // личные комнаты: все вкладки аккаунта получают одни и те же события
  const keys = [rooms.user(identity.userId)];
  socket.join(keys[0]);
  if (identity.doctorId) {
    keys.push(rooms.doctor(identity.doctorId));
    socket.join(rooms.doctor(identity.doctorId));
  }
  if (identity.role === 'staff' || identity.role === 'admin') socket.join(rooms.staff);

  scheduleExpiry(socket);
  keys.forEach(hub.markConnected);
  socket.on('disconnect', () => keys.forEach(hub.markDisconnected));

  chatChannel.register(socket);
  // комнаты уже заняты, поэтому адресат считается «в сети» и очередь можно выдавать: порядок важен для гонки «сообщение пришло как раз сейчас»
  chatChannel.onConnected(socket);
}

module.exports = { attachRealtime };
