// Правила пароля повторяют серверную политику (utils/passwordPolicy.js): пользователь видит
// требования до отправки формы, а окончательную проверку всё равно делает сервер.
export const PASSWORD_RULES = [
  { id: 'length', label: 'Не короче 8 символов', test: (p) => p.length >= 8 },
  { id: 'upper', label: 'Заглавная буква', test: (p) => /\p{Lu}/u.test(p) },
  { id: 'lower', label: 'Строчная буква', test: (p) => /\p{Ll}/u.test(p) },
  { id: 'digit', label: 'Цифра', test: (p) => /\d/.test(p) },
  { id: 'special', label: 'Спецсимвол (! @ # $ %)', test: (p) => /[^\p{L}\p{N}\s]/u.test(p) },
];

const MAX_BYTES = 72; // bcrypt учитывает только первые 72 байта

export function checkPassword(password, email = '') {
  const rules = PASSWORD_RULES.map((rule) => ({ id: rule.id, label: rule.label, ok: rule.test(password) }));

  const localPart = email.split('@')[0].toLowerCase();
  if (localPart.length >= 3) {
    rules.push({ id: 'email', label: 'Не содержит часть e-mail', ok: !password.toLowerCase().includes(localPart) });
  }
  const tooLong = new TextEncoder().encode(password).length > MAX_BYTES;
  if (tooLong) {
    rules.push({ id: 'bytes', label: `Не длиннее ${MAX_BYTES} байт`, ok: false });
  }

  const passed = rules.filter((rule) => rule.ok).length;
  const valid = password.length > 0 && rules.every((rule) => rule.ok);

  let level = 0;
  if (password) {
    const base = PASSWORD_RULES.filter((rule) => rule.test(password)).length;
    level = base <= 2 ? 1 : base <= 4 ? 2 : password.length >= 12 && valid ? 4 : valid ? 3 : 2;
  }
  return { rules, passed, valid, level };
}

export const STRENGTH_LABELS = ['', 'Слабый', 'Средний', 'Хороший', 'Надёжный'];
