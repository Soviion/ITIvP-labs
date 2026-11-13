const { Patient } = require('../../models');
const { bus, EVENTS } = require('../bus');
const hub = require('../hub');
const slots = require('./slots');

const { rooms } = hub;

// Живые списки записей. На событие «запись изменена» сервер рассылает СИГНАЛ, а не данные: клиент получает «обнови» и
// перезапрашивает список обычным REST-запросом, где права проверяются заново. Поэтому даже при ошибке в адресации
// чужие данные не утекут. В сигнале только то, что адресат и так вправе знать: что случилось и когда.
//   гости и все, кто смотрит расписание -> slots:changed (слот освободился или занят)
//   врач этой записи (doctor:N)         -> appointments:changed
//   регистратура и администратор (staff) -> appointments:changed
//   пациент этой записи (user:N)         -> appointments:changed (+ тост, если запись изменил не он сам)

async function onAppointmentChanged(event) {
  slots.announce(event);

  const signal = { id: event.id, action: event.action, actor: event.actor, doctorId: event.doctorId, date: event.date, time: event.time };
  hub.emit(rooms.doctor(event.doctorId), 'appointments:changed', signal);
  if (event.previous && event.previous.doctorId !== event.doctorId) {
    hub.emit(rooms.doctor(event.previous.doctorId), 'appointments:changed', signal);
  }
  hub.emit(rooms.staff, 'appointments:changed', signal);

  const patient = await Patient.findByPk(event.patientId, { attributes: ['userId'] });
  if (patient?.userId) hub.emit(rooms.user(patient.userId), 'appointments:changed', signal);
}

function listen() {
  // слушатель асинхронный: без перехвата ошибки в нём стали бы необработанным отказом и могли бы уронить процесс
  bus.on(EVENTS.APPOINTMENT_CHANGED, (event) => {
    onAppointmentChanged(event).catch((err) => console.error(`Realtime: не удалось разослать изменение записи: ${err.message}`));
  });
}

module.exports = { listen };
