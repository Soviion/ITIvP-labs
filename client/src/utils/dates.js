const pad = (n) => String(n).padStart(2, '0');

const toISO = (date) => `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;

// 'YYYY-MM-DD' → локальная дата (new Date('YYYY-MM-DD') считал бы её по UTC и мог «сдвинуть» день)
export function parseISO(iso) {
  const [year, month, day] = iso.split('-').map(Number);
  return new Date(year, month - 1, day);
}

export const todayISO = () => toISO(new Date());

export function addDaysISO(iso, days) {
  const date = parseISO(iso);
  date.setDate(date.getDate() + days);
  return toISO(date);
}

// API работает с датами dd-mm-yyyy, <input type="date"> — с yyyy-mm-dd
export const isoToApiDate = (iso) => (iso ? iso.split('-').reverse().join('-') : iso);
export const apiToIsoDate = (apiDate) => (apiDate ? apiDate.split('-').reverse().join('-') : apiDate);

const withoutYear = new Intl.DateTimeFormat('ru-RU', { weekday: 'long', day: 'numeric', month: 'long' });
const withYear = new Intl.DateTimeFormat('ru-RU', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' });
const capitalize = (text) => text.charAt(0).toUpperCase() + text.slice(1);

// Заголовок группы в списке: «Сегодня · вторник, 21 октября»
export function formatDayHeading(iso) {
  const today = todayISO();
  const relative = { [today]: 'Сегодня', [addDaysISO(today, 1)]: 'Завтра', [addDaysISO(today, -1)]: 'Вчера' }[iso] ?? null;
  const date = parseISO(iso);
  const formatter = date.getFullYear() === new Date().getFullYear() ? withoutYear : withYear;
  return { relative, text: capitalize(formatter.format(date)) };
}

export const formatShortDate = (iso) => (iso ? iso.split('-').reverse().join('.') : '');
