const { Op } = require('sequelize');

// Расписание приёма одинаково для всех врачей: пн–пт, 09:00–17:00, обед 13:00–14:00, талон — 30 минут.
const SLOT_MINUTES = 30;
const HORIZON_DAYS = 14; // на сколько дней вперёд открыта запись
const WORK_HOURS = [[9 * 60, 13 * 60], [14 * 60, 17 * 60]];

const pad = (n) => String(n).padStart(2, '0');
const toTime = (minutes) => `${pad(Math.floor(minutes / 60))}:${pad(minutes % 60)}`;
const toMinutes = (time) => Number(time.slice(0, 2)) * 60 + Number(time.slice(3, 5));
const toIso = (date) => `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;
const parseIso = (iso) => { const [y, m, d] = iso.split('-').map(Number); return new Date(y, m - 1, d); };

const SLOT_TIMES = WORK_HOURS.flatMap(([from, to]) => {
  const list = [];
  for (let t = from; t + SLOT_MINUTES <= to; t += SLOT_MINUTES) list.push(toTime(t));
  return list;
});

const todayIso = () => toIso(new Date());
const isWorkday = (iso) => { const day = parseIso(iso).getDay(); return day >= 1 && day <= 5; };

function bookableDates() {
  const dates = [];
  const cursor = new Date();
  for (let i = 0; i <= HORIZON_DAYS; i += 1) {
    const iso = toIso(cursor);
    if (isWorkday(iso)) dates.push(iso);
    cursor.setDate(cursor.getDate() + 1);
  }
  return dates;
}

// Занятые интервалы врача (в минутах от начала суток) по неотменённым записям
function busyByDate(appointments) {
  const map = new Map();
  appointments.forEach((a) => {
    const start = toMinutes(a.time);
    const list = map.get(a.date) || [];
    list.push([start, start + (a.durationMinutes || SLOT_MINUTES)]);
    map.set(a.date, list);
  });
  return map;
}

function slotsFor(iso, busy = []) {
  const now = new Date();
  const nowMinutes = now.getHours() * 60 + now.getMinutes();
  const isToday = iso === todayIso();
  return SLOT_TIMES.map((time) => {
    const start = toMinutes(time);
    const taken = busy.some(([from, to]) => start < to && start + SLOT_MINUTES > from);
    const past = isToday && start <= nowMinutes;
    return { time, free: !taken && !past };
  });
}

// excludeId — не считать занятой запись, которую как раз переносят
async function loadBusy(Appointment, doctorId, dates, excludeId = null) {
  const rows = await Appointment.findAll({
    where: {
      doctorId,
      date: { [Op.in]: dates },
      status: { [Op.ne]: 'cancelled' },
      ...(excludeId ? { id: { [Op.ne]: excludeId } } : {}),
    },
    attributes: ['date', 'time', 'durationMinutes'],
    raw: true,
  });
  return busyByDate(rows);
}

module.exports = { SLOT_TIMES, SLOT_MINUTES, HORIZON_DAYS, bookableDates, isWorkday, slotsFor, loadBusy, todayIso, toMinutes };
