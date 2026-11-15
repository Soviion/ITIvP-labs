// Статусы приёма — те же значения, что в enum модели Appointment на сервере
export const STATUSES = [
  { value: 'scheduled', label: 'Запланирован' },
  { value: 'completed', label: 'Проведён' },
  { value: 'cancelled', label: 'Отменён' },
  { value: 'no_show', label: 'Не явился' },
];

export const STATUS_LABELS = Object.fromEntries(STATUSES.map((s) => [s.value, s.label]));

export const DURATIONS = [15, 20, 30, 40, 45, 60, 90, 120];

export const PERIODS = [
  { value: 'all', label: 'Все' },
  { value: 'today', label: 'Сегодня' },
  { value: 'upcoming', label: 'Предстоящие' },
  { value: 'past', label: 'Прошедшие' },
];

export const DEFAULT_FILTERS = {
  query: '',
  status: 'all',
  doctorId: 'all',
  period: 'all',
  direction: 'asc',
};

export const GENDERS = [
  { value: 'female', label: 'Женский' },
  { value: 'male', label: 'Мужской' },
];
