import { apiToIsoDate, isoToApiDate, todayISO } from './dates';

// ---------- Имена ----------

export const fullName = (person) => (person
  ? [person.lastName, person.firstName, person.middleName].filter(Boolean).join(' ')
  : '');

// «Петрова А.С.»
export function shortName(person) {
  if (!person) return '';
  const initials = [person.firstName, person.middleName].filter(Boolean).map((part) => `${part[0]}.`).join('');
  return [person.lastName, initials].filter(Boolean).join(' ');
}

// ---------- Адаптеры между форматом API и форматом интерфейса ----------
// API: даты dd-mm-yyyy, вложенные patient/doctor. Интерфейс: даты yyyy-mm-dd (для <input type="date">).

export function fromApiAppointment(raw) {
  return {
    id: raw.id,
    patientId: raw.patientId,
    doctorId: raw.doctorId,
    patient: raw.patient ?? null,
    doctor: raw.doctor ?? null,
    date: apiToIsoDate(raw.date),
    time: raw.time,
    durationMinutes: raw.durationMinutes,
    reason: raw.reason ?? '',
    status: raw.status,
    cabinet: raw.cabinet ?? '',
  };
}

const blankToNull = (text) => {
  const trimmed = String(text ?? '').trim();
  return trimmed === '' ? null : trimmed;
};

// Полное тело для POST и PUT (PUT на сервере требует все обязательные поля)
export function toApiAppointment(draft) {
  return {
    patientId: Number(draft.patientId),
    doctorId: Number(draft.doctorId),
    date: isoToApiDate(draft.date),
    time: draft.time,
    durationMinutes: Number(draft.durationMinutes),
    reason: blankToNull(draft.reason),
    status: draft.status,
    cabinet: blankToNull(draft.cabinet),
  };
}

export function toApiPatient(draft) {
  return {
    lastName: draft.lastName.trim(),
    firstName: draft.firstName.trim(),
    middleName: blankToNull(draft.middleName),
    birthDate: isoToApiDate(draft.birthDate),
    gender: draft.gender,
    phone: draft.phone.trim(),
  };
}

// ---------- Черновики и проверка форм ----------

export const createEmptyDraft = () => ({
  patientId: '',
  doctorId: '',
  date: todayISO(),
  time: '09:00',
  durationMinutes: 30,
  reason: '',
  status: 'scheduled',
  cabinet: '',
});

export const draftFromItem = (item) => ({
  id: item.id,
  patientId: String(item.patientId),
  doctorId: String(item.doctorId),
  date: item.date,
  time: item.time,
  durationMinutes: item.durationMinutes,
  reason: item.reason,
  status: item.status,
  cabinet: item.cabinet,
});

export function validateDraft(draft) {
  const errors = {};
  if (!draft.patientId) errors.patientId = 'Выберите пациента';
  if (!draft.doctorId) errors.doctorId = 'Выберите врача';
  if (!/^\d{4}-\d{2}-\d{2}$/.test(draft.date)) errors.date = 'Укажите дату приёма';
  if (!/^([01]\d|2[0-3]):[0-5]\d$/.test(draft.time)) errors.time = 'Укажите время в формате ЧЧ:ММ';
  const duration = Number(draft.durationMinutes);
  if (!Number.isInteger(duration) || duration < 5 || duration > 480) errors.durationMinutes = 'От 5 до 480 минут';
  if (draft.reason.length > 1000) errors.reason = 'Не больше 1000 символов';
  if (draft.cabinet.length > 10) errors.cabinet = 'Не больше 10 символов';
  return errors;
}

export function validatePatientDraft(draft) {
  const errors = {};
  if (!draft.lastName.trim()) errors.lastName = 'Укажите фамилию';
  if (!draft.firstName.trim()) errors.firstName = 'Укажите имя';
  if (!/^\d{4}-\d{2}-\d{2}$/.test(draft.birthDate)) errors.birthDate = 'Укажите дату рождения';
  else if (draft.birthDate > todayISO() || draft.birthDate < '1900-01-01') errors.birthDate = 'Дата от 01.01.1900 до сегодняшнего дня';
  if (!draft.gender) errors.gender = 'Выберите пол';
  if (!/^\+?[\d\s()-]{7,20}$/.test(draft.phone.trim())) errors.phone = 'Например, +375 29 123-45-67';
  return errors;
}

// ---------- Поиск, фильтры, группировка ----------

const searchText = (item) => [
  fullName(item.patient),
  fullName(item.doctor),
  item.doctor?.specialty?.name,
  item.reason,
  item.cabinet,
].filter(Boolean).join(' ').toLowerCase();

export function filterAppointments(items, filters) {
  const query = filters.query.trim().toLowerCase();
  const today = todayISO();
  return items.filter((item) => {
    if (filters.status !== 'all' && item.status !== filters.status) return false;
    if (filters.doctorId !== 'all' && String(item.doctorId) !== filters.doctorId) return false;
    if (filters.period === 'today' && item.date !== today) return false;
    if (filters.period === 'upcoming' && item.date < today) return false;
    if (filters.period === 'past' && item.date >= today) return false;
    return !query || searchText(item).includes(query);
  });
}

export function sortAppointments(items, direction) {
  const sign = direction === 'desc' ? -1 : 1;
  return [...items].sort((a, b) => sign * (`${a.date} ${a.time}`.localeCompare(`${b.date} ${b.time}`)));
}

// [{ date, items }, ...] в порядке следующих друг за другом дат
export function groupByDate(items) {
  const groups = [];
  items.forEach((item) => {
    const last = groups[groups.length - 1];
    if (last && last.date === item.date) last.items.push(item);
    else groups.push({ date: item.date, items: [item] });
  });
  return groups;
}

export const countByStatus = (items) => items.reduce(
  (acc, item) => ({ ...acc, [item.status]: (acc[item.status] ?? 0) + 1 }),
  { all: items.length },
);
