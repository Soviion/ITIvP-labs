// Реестр подключений: имена комнат, «кто в сети» и отправка событий.
// Всё хранится в памяти одного процесса Node: для этого проекта достаточно. Если сервер когда-нибудь запустят
// в нескольких экземплярах, комнаты придётся вынести в общий адаптер (Redis) — снаружи этого модуля ничего не изменится.

const GRACE_MS = Number(process.env.PRESENCE_GRACE_MS ?? 10000);

let io = null;
const announced = new Set(); // ключи, о которых клиентам уже сообщили «в сети»
const offlineTimers = new Map();

// Комнаты назначает только сервер, клиент не может попросить «войти в комнату X»
const rooms = {
  user: (id) => `user:${id}`, // все вкладки одного аккаунта
  doctor: (id) => `doctor:${id}`, // все вкладки аккаунтов врача (по сути один аккаунт: users.doctor_id уникален)
  staff: 'staff', // регистратура и администратор
  slots: (doctorId) => `slots:${doctorId}`, // кто смотрит свободные талоны этого врача (в том числе гости)
  presence: (key) => `presence:${key}`, // кто следит за тем, в сети ли user:N или doctor:N
  chat: (conversationId) => `chat:${conversationId}`, // открытая беседа
};

const setIo = (instance) => { io = instance; };
const getIo = () => io;

const size = (room) => io?.sockets.adapter.rooms.get(room)?.size ?? 0;

// Есть ли у адресата живое подключение: от этого зависит, отдать сообщение сразу или оставить в очереди
const isOnline = (key) => size(key) > 0;

// Что показываем в индикаторе «в сети»: с небольшой задержкой на выход, чтобы перезагрузка страницы не мигала «офлайн»
const isPresent = (key) => announced.has(key) || size(key) > 0;

function emit(room, event, payload) {
  io?.to(room).emit(event, payload);
}

function markConnected(key) {
  clearTimeout(offlineTimers.get(key));
  offlineTimers.delete(key);
  if (announced.has(key)) return;
  announced.add(key);
  emit(rooms.presence(key), 'presence:changed', { key, online: true });
}

// Вызывается после выхода сокета из комнат. У аккаунта может быть несколько вкладок: «офлайн» только когда закрылась последняя
function markDisconnected(key) {
  if (size(key) > 0 || offlineTimers.has(key)) return;
  const timer = setTimeout(() => {
    offlineTimers.delete(key);
    if (size(key) > 0) return;
    announced.delete(key);
    emit(rooms.presence(key), 'presence:changed', { key, online: false });
  }, GRACE_MS);
  timer.unref?.();
  offlineTimers.set(key, timer);
}

module.exports = { rooms, setIo, getIo, size, isOnline, isPresent, emit, markConnected, markDisconnected };
