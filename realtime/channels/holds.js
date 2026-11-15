const hub = require('../hub');
const { bus, EVENTS } = require('../bus');
const { createLimiter } = require('../limiter');
const slotHolds = require('../../services/slotHolds');
const { Appointment, Doctor } = require('../../models');
const { SLOT_TIMES, bookableDates, slotsFor, loadBusy } = require('../../utils/schedule');

const { rooms } = hub;

// Бронь времени. Пациент выбрал врача, день и время: талон на 15 секунд закрепляется за ним, остальные видят его занятым.
// Клиент → сервер (все с подтверждением, ack):
//   hold:acquire { doctorId, date: 'ГГГГ-ММ-ДД', time: 'ЧЧ:ММ' } → { ok: true, ttlMs }
//                                                               или { ok: false, code, status, error }
//       code: login (гость) · forbidden (не пациент) · invalid (нет такого талона) · taken (занят записью или чужой бронью)
//             · cooldown (вы только что держали этот талон) · rate (слишком часто)
//   hold:release {} → { ok: true }   (снять бронь; безопасно вызывать, даже если брони нет)
// Сервер → клиенты:
//   hold:changed { doctorId, date, time, held }       в комнату slots:{doctorId}: талон забронирован или освободился
//   hold:ended   { doctorId, date, time, reason }     только держателю: 'timeout' (время вышло) · 'replaced' (выбрал другое время или
//                                                     снял бронь в другой вкладке) · 'booked' (талон занят записью)
// Текущие брони новый наблюдатель получает в ответе на slots:watch (см. slots.js).

// Не больше 6 бронирований подряд, дальше одно в 3 секунды: быстрый перебор талонов не нужен ни одному живому человеку
const acquireLimiter = createLimiter({ capacity: 6, refillPerSecond: 0.3 });

const reply = (ack, payload) => { if (typeof ack === 'function') ack(payload); };

const refusal = (code, status, error, extra = {}) => ({ ok: false, code, status, error, ...extra });

const isPatient = (identity) => identity?.role === 'patient' && Boolean(identity.patientId);

// Талон существует, не в прошлом и не занят записью. Правила те же, что при записи (utils/schedule.js)
async function isFreeInDatabase(doctorId, date, time) {
  const busy = await loadBusy(Appointment, doctorId, [date]);
  return Boolean(slotsFor(date, busy.get(date)).find((slot) => slot.time === time)?.free);
}

async function acquire(socket, data, ack) {
  const { identity } = socket.data;
  if (!identity) return reply(ack, refusal('login', 401, 'Войдите в аккаунт, чтобы выбрать время'));
  if (!isPatient(identity)) return reply(ack, refusal('forbidden', 403, 'Выбирать талоны могут только пациенты'));
  if (!acquireLimiter.take(`h${identity.userId}`)) return reply(ack, refusal('rate', 429, 'Слишком часто. Подождите несколько секунд'));

  const doctorId = Number(data?.doctorId);
  const date = typeof data?.date === 'string' ? data.date : '';
  const time = typeof data?.time === 'string' ? data.time : '';
  if (!Number.isInteger(doctorId) || doctorId < 1 || !bookableDates().includes(date) || !SLOT_TIMES.includes(time)) {
    return reply(ack, refusal('invalid', 400, 'На это время запись недоступна'));
  }

  try {
    if (!(await Doctor.count({ where: { id: doctorId, isActive: true } }))) {
      return reply(ack, refusal('invalid', 400, 'Врач не найден или не ведёт приём'));
    }
    if (!(await isFreeInDatabase(doctorId, date, time))) {
      return reply(ack, refusal('taken', 409, 'Этот талон уже занят. Выберите другое время'));
    }
  } catch (err) {
    console.error(`Realtime holds: не удалось проверить талон: ${err.message}`);
    return reply(ack, refusal('unavailable', 503, 'Не удалось проверить талон. Повторите попытку'));
  }

  const result = slotHolds.acquire({ userId: identity.userId, socketId: socket.id, doctorId, date, time });
  if (result.ok) return reply(ack, { ok: true, ttlMs: result.ttlMs });
  if (result.code === 'cooldown') {
    const seconds = Math.ceil(result.retryAfterMs / 1000);
    return reply(ack, refusal('cooldown', 429, `Вы только что держали это время. Подождите ${seconds} с или выберите другое`, { retryAfterMs: result.retryAfterMs }));
  }
  return reply(ack, refusal('taken', 409, 'Этот талон сейчас выбирает другой пациент'));
}

// События хранилища и шины подключаются один раз на процесс, а не при каждом подключении сокета
let wired = false;
function wire() {
  if (wired) return;
  wired = true;

  slotHolds.events.on('changed', ({ doctorId, date, time, held }) => {
    hub.emit(rooms.slots(doctorId), 'hold:changed', { doctorId, date, time, held });
  });
  // у каждого сокета есть личная комната с его id: так событие уходит только той вкладке, которая бронировала
  slotHolds.events.on('ended', ({ socketId, doctorId, date, time, reason }) => {
    hub.emit(socketId, 'hold:ended', { doctorId, date, time, reason });
  });
  // Запись создана или перенесена на талон: бронь на него больше не нужна. Бронь пациента не переживает его запись
  bus.on(EVENTS.APPOINTMENT_CHANGED, (event) => {
    if (event.action === 'booked' || event.action === 'rescheduled') slotHolds.releaseSlot(event.doctorId, event.date, event.time, 'booked');
  });
}

function register(socket) {
  wire();

  socket.on('hold:acquire', (data, ack) => {
    acquire(socket, data, ack).catch((err) => {
      console.error(`Realtime holds: ${err?.stack || err}`);
      reply(ack, refusal('unavailable', 500, 'Внутренняя ошибка сервера'));
    });
  });

  socket.on('hold:release', (data, ack) => {
    const { identity } = socket.data;
    if (identity) slotHolds.release(identity.userId, socket.id);
    reply(ack, { ok: true });
  });

  // вкладку закрыли или связь оборвалась: бронь снимается сразу, не дожидаясь таймера
  socket.on('disconnect', () => slotHolds.releaseSocket(socket.id));
}

module.exports = { register };
