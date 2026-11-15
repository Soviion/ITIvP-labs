require('dotenv').config({ quiet: true });
const { EventEmitter } = require('events');

// Бронь талона на время выбора. Пациент нажал на время, и этот талон на несколько секунд закреплён за ним:
// другие пациенты его не видят свободным и не могут записаться на него (проверка есть и в REST).
// Бронь снимается, когда пациент записался, выбрал другое время, отменил выбор, закрыл страницу или истёк таймер.
// Таймер обязателен: без него можно было бы «заморозить» любой талон, просто выбрав его и ничего не делая.
//
// Модуль ничего не знает о сокетах: он хранит брони в памяти процесса и сообщает о них событиями
//   'changed' { doctorId, date, time, held }                              – талон забронирован или освободился (видят все наблюдатели)
//   'ended'   { userId, socketId, doctorId, date, time, reason }           – бронь закончилась не по воле держателя: 'timeout' | 'replaced' | 'booked'
// Рассылкой клиентам занимается realtime/channels/holds.js. Брони живут в одном процессе Node (как и комнаты сокетов),
// после перезапуска сервера они пропадают, и это безопасно: через 15 секунд они бы и так истекли.

const events = new EventEmitter();
const holds = new Map(); // ключ слота -> { userId, doctorId, date, time, sockets: Set, expiresAt, timer }
const holdOfUser = new Map(); // userId -> ключ слота (у пациента не больше одной брони)
const cooldowns = new Map(); // userId|ключ слота -> до какого момента (мс) нельзя снова бронировать этот талон

// Настройки читаются при каждом обращении: так их можно поменять в .env или в тесте без перезагрузки модуля
const seconds = (name, fallback) => {
  const value = process.env[name];
  return value !== undefined && value.trim() !== '' && Number(value) >= 0 ? Number(value) : fallback;
};
const ttlMs = () => (seconds('SLOT_HOLD_SECONDS', 15) || 15) * 1000; // 0 секунд для брони не имеет смысла
const cooldownMs = () => seconds('SLOT_HOLD_COOLDOWN_SECONDS', 10) * 1000; // 0 — пауза отключена

const keyOf = (doctorId, date, time) => `${Number(doctorId)}|${date}|${String(time).slice(0, 5)}`;
const slotOf = (hold) => ({ doctorId: hold.doctorId, date: hold.date, time: hold.time });
const remaining = (hold) => Math.max(0, hold.expiresAt - Date.now());

// Убрать бронь из хранилища и сообщить всем, что талон свободен. Возвращает удалённую бронь
function drop(key) {
  const hold = holds.get(key);
  if (!hold) return null;
  clearTimeout(hold.timer);
  holds.delete(key);
  if (holdOfUser.get(hold.userId) === key) holdOfUser.delete(hold.userId);
  events.emit('changed', { ...slotOf(hold), held: false });
  return hold;
}

// Сообщить держателю (во всех его вкладках с этой бронью), что бронь закончилась. except — вкладка, которая сама сняла бронь
function notifyEnded(hold, reason, except = null) {
  hold.sockets.forEach((socketId) => {
    if (socketId !== except) events.emit('ended', { userId: hold.userId, socketId, ...slotOf(hold), reason });
  });
}

// Время вышло: талон освобождается, а тому же пациенту нельзя сразу забронировать его снова.
// Иначе недобросовестный пользователь нажимал бы на один и тот же талон каждые 15 секунд, и никто другой не успевал бы его занять
function expire(key) {
  const hold = drop(key);
  if (!hold) return;
  const pause = cooldownMs();
  if (pause > 0) {
    const cooldownKey = `${hold.userId}|${key}`;
    cooldowns.set(cooldownKey, Date.now() + pause);
    setTimeout(() => cooldowns.delete(cooldownKey), pause).unref?.();
  }
  notifyEnded(hold, 'timeout');
}

/**
 * Забронировать талон за пациентом.
 * Новая бронь заменяет прежнюю (у пациента она одна). Повторная бронь того же талона время не продлевает:
 * иначе таймер можно было бы обнулять сколько угодно раз. Ответ: { ok: true, ttlMs, replaced } или { ok: false, code, retryAfterMs? },
 * где code: 'taken' (талон держит другой пациент) | 'cooldown' (вы только что держали этот талон)
 */
function acquire({ userId, socketId, doctorId, date, time }) {
  const key = keyOf(doctorId, date, time);
  const existing = holds.get(key);

  if (existing && existing.userId !== userId) return { ok: false, code: 'taken' };
  if (existing) {
    existing.sockets.add(socketId); // та же бронь из второй вкладки: общая, со старым таймером
    return { ok: true, ttlMs: remaining(existing), replaced: false };
  }

  const until = cooldowns.get(`${userId}|${key}`);
  if (until && until > Date.now()) return { ok: false, code: 'cooldown', retryAfterMs: until - Date.now() };

  const previousKey = holdOfUser.get(userId);
  let replaced = false;
  if (previousKey) {
    const previous = drop(previousKey);
    if (previous) {
      replaced = true;
      // событие уходит всем вкладкам с прежней бронью, в том числе той, что выбрала новое время: оно приходит раньше ответа
      // на hold:acquire, поэтому клиент сверяет талон из события с тем, что выбран сейчас
      notifyEnded(previous, 'replaced');
    }
  }

  const ttl = ttlMs();
  const hold = {
    userId,
    doctorId: Number(doctorId),
    date,
    time: String(time).slice(0, 5),
    sockets: new Set([socketId]),
    expiresAt: Date.now() + ttl,
    timer: null,
  };
  hold.timer = setTimeout(() => expire(key), ttl);
  hold.timer.unref?.();
  holds.set(key, hold);
  holdOfUser.set(userId, key);
  events.emit('changed', { ...slotOf(hold), held: true });
  return { ok: true, ttlMs: ttl, replaced };
}

// Пациент сам снял бронь (отменил выбор). Другим его вкладкам с этой бронью сообщаем, что она закончилась
function release(userId, exceptSocketId = null) {
  const key = holdOfUser.get(userId);
  const hold = key ? drop(key) : null;
  if (hold) notifyEnded(hold, 'replaced', exceptSocketId);
  return Boolean(hold);
}

// Талон занят (запись создана или перенесена на него): бронь больше не нужна, кто бы её ни держал
function releaseSlot(doctorId, date, time, reason = 'booked') {
  const hold = drop(keyOf(doctorId, date, time));
  if (hold) notifyEnded(hold, reason);
  return Boolean(hold);
}

// Вкладка закрылась или связь оборвалась: бронь снимается сразу, если у неё не осталось других вкладок
function releaseSocket(socketId) {
  [...holds.entries()].forEach(([key, hold]) => {
    if (!hold.sockets.delete(socketId)) return;
    if (hold.sockets.size === 0) drop(key);
  });
}

// Держит ли этот талон кто-то другой (REST-запись проверяет это, чтобы нельзя было обойти бронь прямым запросом)
function isHeldByOther({ doctorId, date, time, userId }) {
  const hold = holds.get(keyOf(doctorId, date, time));
  return Boolean(hold) && hold.userId !== userId;
}

// Все брони врача для нового наблюдателя расписания; mine — бронь принадлежит этому пациенту
function snapshot(doctorId, userId = null) {
  return [...holds.values()]
    .filter((hold) => hold.doctorId === Number(doctorId))
    .map((hold) => ({ date: hold.date, time: hold.time, mine: userId !== null && hold.userId === userId }));
}

module.exports = { events, acquire, release, releaseSlot, releaseSocket, isHeldByOther, snapshot };
