// Белорусский номер в одном строгом формате: +375(44)4444444 — код страны, код оператора в скобках, 7 цифр.
const PHONE_RE = /^\+375\(\d{2}\)\d{7}$/;

/**
 * Приводит введённое значение к формату +375(44)4444444.
 * Понимает +375 44 444-44-44, 80444444444, 444444444 и т. п. Возвращает null, если цифр не хватает или их слишком много.
 */
function normalizePhone(value) {
  let digits = String(value ?? '').replace(/\D/g, '');
  if (digits.startsWith('375')) digits = digits.slice(3);
  else if (digits.startsWith('80')) digits = digits.slice(2);
  if (digits.length !== 9) return null;
  return `+375(${digits.slice(0, 2)})${digits.slice(2)}`;
}

module.exports = { PHONE_RE, normalizePhone };
