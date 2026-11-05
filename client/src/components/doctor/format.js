import { apiToIsoDate } from '../../utils/dates';
import { ageOn } from '../../utils/patient';

// Даты личного дела приходят из MongoDB как ISO-строки (2026-11-03T09:30:00.000Z)
const pad = (n) => String(n).padStart(2, '0');

export function fmtDate(value) {
  if (!value) return '';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '';
  return `${pad(date.getDate())}.${pad(date.getMonth() + 1)}.${date.getFullYear()}`;
}

export function fmtDateTime(value) {
  if (!value) return '';
  const date = new Date(value);
  return `${fmtDate(date)} ${pad(date.getHours())}:${pad(date.getMinutes())}`;
}

// ISO → значение для <input type="date">
export function toInputDate(value) {
  if (!value) return '';
  const date = new Date(value);
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;
}

export const GENDER_LABELS = { male: 'мужской', female: 'женский' };
export const SOCIAL_TEXT = { student: 'студент', schoolchild: 'школьник', child: 'ребёнок', adult: 'взрослый' };

// Строка списка: «a; b, c» → ['a','b','c']
export const splitList = (text) => String(text ?? '').split(/[;\n,]+/).map((item) => item.trim()).filter(Boolean);

// birthDate приходит как dd-mm-yyyy
export function ageText(birthDate) {
  if (!birthDate) return '';
  const age = ageOn(apiToIsoDate(birthDate));
  const lastTwo = age % 100;
  const last = age % 10;
  const word = lastTwo >= 11 && lastTwo <= 14 ? 'лет' : last === 1 ? 'год' : last >= 2 && last <= 4 ? 'года' : 'лет';
  return `${age} ${word}`;
}

export const dotDate = (apiDate) => (apiDate ? apiDate.replaceAll('-', '.') : '');
