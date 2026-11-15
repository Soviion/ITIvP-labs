import { todayISO } from './dates';

const nowMinutes = () => { const now = new Date(); return now.getHours() * 60 + now.getMinutes(); };
const toMinutes = (time) => Number(time.slice(0, 2)) * 60 + Number(time.slice(3, 5));

// Не больше стольких активных талонов у одного пациента (проверяет и сервер)
export const MAX_ACTIVE_TICKETS = 4;

// Активный талон: не отменён и дата сегодняшняя или будущая. Талоны сегодняшнего дня остаются активными
// до конца суток, даже если время приёма уже прошло: в архив они уйдут только завтра.
export const isActiveTicket = (item) => item.status !== 'cancelled' && item.date >= todayISO();

// Отменить можно запланированный приём, который ещё не начался
export const canCancelTicket = (item) => item.status === 'scheduled'
  && (item.date > todayISO() || (item.date === todayISO() && toMinutes(item.time) > nowMinutes()));

const key = (item) => `${item.date} ${item.time}`;
export const byTimeAsc = (a, b) => key(a).localeCompare(key(b));
export const byTimeDesc = (a, b) => key(b).localeCompare(key(a));
