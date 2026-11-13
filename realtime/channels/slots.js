const hub = require('../hub');
const slotHolds = require('../../services/slotHolds');

const { rooms } = hub;

// Свободные талоны врача: клиент, который смотрит расписание, подписывается на врача и получает сигнал «талоны изменились».
// Расписание открыто и гостям (маршрут /slots не требует входа), поэтому подписка доступна без токена.
// Сигнал не содержит данных о пациенте: только «у врача N изменился день D», остальное клиент перезапрашивает через REST.
// Подписка одна на вкладку (смотрят расписание одного врача): новая заменяет прежнюю, так комнаты не копятся.

function register(socket) {
  socket.on('slots:watch', (data, ack) => {
    const doctorId = Number(data?.doctorId);
    if (!Number.isInteger(doctorId) || doctorId < 1) {
      if (typeof ack === 'function') ack({ ok: false });
      return;
    }
    [...socket.rooms].filter((room) => room.startsWith('slots:')).forEach((room) => socket.leave(room));
    socket.join(rooms.slots(doctorId));
    // вместе с подпиской отдаём текущие брони врача (дальше о них сообщает hold:changed); mine — бронь этого пациента
    if (typeof ack === 'function') ack({ ok: true, holds: slotHolds.snapshot(doctorId, socket.data.identity?.userId ?? null) });
  });

  socket.on('slots:unwatch', () => {
    [...socket.rooms].filter((room) => room.startsWith('slots:')).forEach((room) => socket.leave(room));
  });
}

// Место, которое запись занимала или заняла, надо обновить у всех, кто смотрит этого врача (перенос затрагивает два места)
function announce(event) {
  const places = [{ doctorId: event.doctorId, date: event.date }];
  if (event.previous && (event.previous.doctorId !== event.doctorId || event.previous.date !== event.date)) {
    places.push({ doctorId: event.previous.doctorId, date: event.previous.date });
  }
  places.forEach((place) => hub.emit(rooms.slots(place.doctorId), 'slots:changed', place));
}

module.exports = { register, announce };
