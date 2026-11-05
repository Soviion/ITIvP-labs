const { Doctor, Appointment } = require('../models');
const ApiError = require('../utils/ApiError');
const { fromDisplayDate, toDisplayDate } = require('../utils/dates');
const { bookableDates, isWorkday, slotsFor, loadBusy, todayIso, HORIZON_DAYS } = require('../utils/schedule');

async function activeDoctorOrFail(rawId) {
  const id = Number(rawId);
  if (!Number.isInteger(id) || id < 1) throw new ApiError(400, 'Некорректная ссылка на врача');
  const doctor = await Doctor.findOne({ where: { id, isActive: true } });
  if (!doctor) throw new ApiError(404, 'Врач не найден или не ведёт приём');
  return doctor;
}

// ?exclude=<id записи> — при переносе своей записи её текущее время считается свободным
const excludeId = (req) => (Number.isInteger(Number(req.query.exclude)) && Number(req.query.exclude) > 0 ? Number(req.query.exclude) : null);

// GET /slots/days?doctorId=1 — ближайшие рабочие дни и сколько в них свободных талонов
exports.days = async (req, res) => {
  const doctor = await activeDoctorOrFail(req.query.doctorId);
  const dates = bookableDates();
  const busy = await loadBusy(Appointment, doctor.id, dates, excludeId(req));
  res.json(dates.map((iso) => ({
    date: toDisplayDate(iso),
    free: slotsFor(iso, busy.get(iso)).filter((slot) => slot.free).length,
  })));
};

// GET /slots?doctorId=1&date=22-10-2026 — талоны врача на день
exports.list = async (req, res) => {
  const doctor = await activeDoctorOrFail(req.query.doctorId);
  const iso = fromDisplayDate(req.query.date, 'date');
  if (!bookableDates().includes(iso)) {
    if (!isWorkday(iso)) throw new ApiError(400, 'В выходные приём не ведётся');
    throw new ApiError(400, iso < todayIso() ? 'Эта дата уже прошла' : `Запись открыта на ${HORIZON_DAYS} дней вперёд`);
  }
  const busy = await loadBusy(Appointment, doctor.id, [iso], excludeId(req));
  res.json({ date: toDisplayDate(iso), doctorId: doctor.id, slots: slotsFor(iso, busy.get(iso)) });
};
