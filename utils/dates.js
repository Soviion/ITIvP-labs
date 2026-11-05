const ApiError = require('./ApiError');

// API принимает и отдаёт даты как dd-mm-yyyy, в БД хранится DATE (yyyy-mm-dd).

function fromDisplayDate(value, field = 'date') {
  const match = typeof value === 'string' && /^(\d{2})-(\d{2})-(\d{4})$/.exec(value);
  if (match) {
    const [, dd, mm, yyyy] = match;
    const parsed = new Date(Date.UTC(+yyyy, +mm - 1, +dd));
    if (parsed.getUTCFullYear() === +yyyy && parsed.getUTCMonth() === +mm - 1 && parsed.getUTCDate() === +dd) {
      return `${yyyy}-${mm}-${dd}`;
    }
  }
  throw new ApiError(400, 'Укажите существующую дату');
}

function toDisplayDate(iso) {
  if (typeof iso !== 'string') return iso;
  const [yyyy, mm, dd] = iso.split('-');
  return `${dd}-${mm}-${yyyy}`;
}

function fromDisplayTime(value, field = 'time') {
  if (typeof value === 'string' && /^([01]\d|2[0-3]):[0-5]\d$/.test(value)) {
    return value;
  }
  throw new ApiError(400, 'Укажите время от 00:00 до 23:59');
}

function toDisplayTime(time) {
  return typeof time === 'string' ? time.slice(0, 5) : time;
}

module.exports = { fromDisplayDate, toDisplayDate, fromDisplayTime, toDisplayTime };
