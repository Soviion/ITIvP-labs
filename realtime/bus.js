const { EventEmitter } = require('events');

// Шина событий внутри процесса (паттерн «издатель — подписчики»). Контроллеры и сервисы сообщают, что произошло
// («запись изменена»), и ничего не знают о сокетах. Модуль realtime подписан на эти события и рассылает их клиентам.
// Благодаря этому REST работает так же и без WebSocket, а рассылку можно менять, не трогая контроллеры.
const bus = new EventEmitter();

const EVENTS = {
  APPOINTMENT_CHANGED: 'appointment.changed',
  CHAT_READ: 'chat.read', // беседу прочитали через обычный HTTP-запрос: собеседнику нужно показать «прочитано»
};

const toTime = (value) => (value == null ? null : String(value).slice(0, 5));

// Запись приёма -> компактное описание события. previous — где запись была до переноса или изменения
function describeAppointment(appointment, previous) {
  const plain = typeof appointment.get === 'function' ? appointment.get({ plain: true }) : appointment;
  return {
    id: plain.id,
    doctorId: plain.doctorId,
    patientId: plain.patientId,
    date: plain.date,
    time: toTime(plain.time),
    previous: previous
      ? { doctorId: previous.doctorId, date: previous.date, time: toTime(previous.time) }
      : null,
  };
}

// action: booked | cancelled | rescheduled | updated | completed | deleted; actor: patient | staff | doctor.
// Сбой подписчика не должен ломать ответ клиенту, поэтому публикация никогда не бросает исключение
function publishAppointmentChange(action, actor, appointment, previous = null) {
  try {
    bus.emit(EVENTS.APPOINTMENT_CHANGED, { action, actor, ...describeAppointment(appointment, previous) });
  } catch (err) {
    console.error(`Realtime: не удалось опубликовать событие записи: ${err.message}`);
  }
}

module.exports = { bus, EVENTS, publishAppointmentChange };
