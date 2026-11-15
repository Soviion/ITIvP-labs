const ApiError = require('./ApiError');

const MIN_LENGTH = 8;
// bcrypt учитывает только первые 72 байта 

const MAX_BYTES = 72;

const RULES = [
  {
    message: `Пароль должен содержать не менее ${MIN_LENGTH} символов`,
    test: (password) => password.length >= MIN_LENGTH,
  },
  {
    message: `Пароль не должен быть длиннее ${MAX_BYTES} байт`,
    test: (password) => Buffer.byteLength(password, 'utf8') <= MAX_BYTES,
  },
  {
    message: 'Пароль должен содержать хотя бы одну заглавную букву',
    test: (password) => /\p{Lu}/u.test(password),
  },
  {
    message: 'Пароль должен содержать хотя бы одну строчную букву',
    test: (password) => /\p{Ll}/u.test(password),
  },
  {
    message: 'Пароль должен содержать хотя бы одну цифру',
    test: (password) => /\d/.test(password),
  },
  {
    message: 'Пароль должен содержать хотя бы один спецсимвол (например, ! @ # $ % ^ & *)',
    test: (password) => /[^\p{L}\p{N}\s]/u.test(password),
  },
];

function checkPasswordStrength(password, { email } = {}) {
  const problems = RULES.filter((rule) => !rule.test(password)).map((rule) => rule.message);

  const localPart = email ? email.split('@')[0].toLowerCase() : '';
  if (localPart.length >= 3 && password.toLowerCase().includes(localPart)) {
    problems.push('Пароль не должен содержать часть вашего e-mail');
  }
  return problems;
}

function assertStrongPassword(password, options) {
  const problems = checkPasswordStrength(password, options);
  if (problems.length) {
    throw new ApiError(
      400,
      'Пароль не соответствует требованиям безопасности',
      problems.map((message) => ({ field: 'password', message })),
    );
  }
}

module.exports = { checkPasswordStrength, assertStrongPassword };
