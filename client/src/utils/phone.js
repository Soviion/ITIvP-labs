// Белорусский номер в строгом формате +375(44)4444444: код страны, код оператора в скобках, 7 цифр
export const PHONE_PREFIX = '+375(';
export const PHONE_RE = /^\+375\(\d{2}\)\d{7}$/;

// Оставляет только цифры номера без кода страны (не больше 9: 2 цифры оператора + 7 цифр абонента)
export function phoneDigits(value) {
  let digits = String(value ?? '').replace(/\D/g, '');
  if (digits.startsWith('375')) digits = digits.slice(3);
  else if (digits.startsWith('80') && digits.length > 2) digits = digits.slice(2);
  return digits.slice(0, 9);
}

// Любое введённое значение → маска +375(44)4444444. Префикс +375( присутствует всегда, лишние цифры отбрасываются.
export function formatPhone(value) {
  const digits = phoneDigits(value);
  return `${PHONE_PREFIX}${digits.slice(0, 2)}${digits.length >= 2 ? ')' : ''}${digits.slice(2)}`;
}

export const isPhoneEmpty = (value) => phoneDigits(value).length === 0;
export const isValidPhone = (value) => PHONE_RE.test(value ?? '');
