const ApiError = require('./ApiError');
const { fromDisplayDate } = require('./dates');

const SOCIAL_STATUSES = ['student', 'schoolchild', 'child', 'adult'];
const GENDERS = ['male', 'female'];

const NAME_RE = /^\p{L}[\p{L}'’ -]*$/u;
const { normalizePhone } = require('./phone');

const str = (value) => (typeof value === 'string' ? value.trim().replace(/\s+/g, ' ') : value);
const digitsCount = (text) => (text.match(/\d/g) || []).length;

function ageOn(isoDate, today = new Date()) {
  const [y, m, d] = isoDate.split('-').map(Number);
  let age = today.getFullYear() - y;
  if (today.getMonth() + 1 < m || (today.getMonth() + 1 === m && today.getDate() < d)) age -= 1;
  return age;
}

// Допустимый возраст для каждого социального статуса
const AGE_RULES = {
  child: { test: (age) => age < 14, message: 'Статус «Ребёнок» — до 14 лет' },
  schoolchild: { test: (age) => age >= 6 && age <= 18, message: 'Статус «Школьник» — от 6 до 18 лет' },
  student: { test: (age) => age >= 15, message: 'Статус «Студент» — от 15 лет' },
  adult: { test: (age) => age >= 18, message: 'Статус «Взрослый» — от 18 лет' },
};

const FIELD_LABELS = { lastName: 'Фамилия', firstName: 'Имя', middleName: 'Отчество' };

function validateName(value, label, errors, field, { required = true } = {}) {
  if (value === undefined || value === null || value === '') {
    if (required) errors.push({ field, message: `Укажите ${label}` });
    return null;
  }
  if (typeof value !== 'string' || value.length < 2 || value.length > 60 || !NAME_RE.test(value)) {
    errors.push({ field, message: `${FIELD_LABELS[field]}: только буквы, пробел и дефис, от 2 до 60 символов` });
    return null;
  }
  return value;
}

/**
 * Проверяет анкету пациента целиком и возвращает нормализованные значения (даты в формате ISO).
 * Принимает «плоский» объект: именно такие данные приходят при регистрации и из карточки пациента.
 * Бросает ApiError 400 со списком всех найденных ошибок.
 */
function validatePatientProfile(input) {
  const errors = [];
  const v = {
    lastName: str(input.lastName),
    firstName: str(input.firstName),
    middleName: str(input.middleName),
    gender: input.gender,
    socialStatus: input.socialStatus,
    phone: str(input.phone),
    address: str(input.address),
    workplace: str(input.workplace),
    trustedPerson: str(input.trustedPerson),
  };

  const out = {
    lastName: validateName(v.lastName, 'фамилию', errors, 'lastName'),
    firstName: validateName(v.firstName, 'имя', errors, 'firstName'),
    middleName: input.noMiddleName === true ? null : validateName(v.middleName, 'отчество', errors, 'middleName'),
  };

  // дата рождения
  let birthIso = null;
  if (!input.birthDate) {
    errors.push({ field: 'birthDate', message: 'Укажите дату рождения' });
  } else {
    try {
      birthIso = fromDisplayDate(input.birthDate, 'birthDate');
      const today = new Date().toISOString().slice(0, 10);
      if (birthIso > today) {
        errors.push({ field: 'birthDate', message: 'Дата рождения не может быть в будущем' });
        birthIso = null;
      } else if (ageOn(birthIso) > 120) {
        errors.push({ field: 'birthDate', message: 'Проверьте дату рождения: возраст больше 120 лет' });
        birthIso = null;
      }
    } catch {
      errors.push({ field: 'birthDate', message: 'Укажите существующую дату рождения' });
    }
  }
  out.birthDate = birthIso;

  if (!GENDERS.includes(v.gender)) errors.push({ field: 'gender', message: 'Укажите пол' });
  out.gender = GENDERS.includes(v.gender) ? v.gender : null;

  // социальный статус должен соответствовать возрасту
  if (!SOCIAL_STATUSES.includes(v.socialStatus)) {
    errors.push({ field: 'socialStatus', message: 'Выберите социальный статус' });
  } else if (birthIso) {
    const rule = AGE_RULES[v.socialStatus];
    if (!rule.test(ageOn(birthIso))) errors.push({ field: 'socialStatus', message: rule.message });
  }
  out.socialStatus = SOCIAL_STATUSES.includes(v.socialStatus) ? v.socialStatus : null;

  // телефон
  const phone = v.phone ? normalizePhone(v.phone) : null;
  if (!v.phone || digitsCount(v.phone) === 0 || v.phone === '+375(') errors.push({ field: 'phone', message: 'Укажите номер телефона' });
  else if (!phone) errors.push({ field: 'phone', message: 'Телефон в формате +375(44)4444444' });
  out.phone = phone;

  // необязательные поля проверяются, только если заполнены
  if (v.address) {
    if (v.address.length < 5 || v.address.length > 255) errors.push({ field: 'address', message: 'Адрес: от 5 до 255 символов' });
  }
  out.address = v.address || null;

  if (v.workplace && v.workplace.length > 150) errors.push({ field: 'workplace', message: 'Место работы: не больше 150 символов' });
  out.workplace = v.workplace || null;

  // доверенное лицо: «ФИО, телефон, место работы». Для несовершеннолетних обязательно.
  const minor = birthIso ? ageOn(birthIso) < 18 : false;
  if (!v.trustedPerson) {
    if (minor) errors.push({ field: 'trustedPerson', message: 'Для несовершеннолетних укажите доверенное лицо (мать, отец, опекун)' });
  } else {
    const words = (v.trustedPerson.match(/\p{L}{2,}/gu) || []).length;
    const hasPhone = /\+375\(\d{2}\)\d{7}/.test(v.trustedPerson);
    if (v.trustedPerson.length > 300) errors.push({ field: 'trustedPerson', message: 'Доверенное лицо: не больше 300 символов' });
    else if (words < 2 || !hasPhone) errors.push({ field: 'trustedPerson', message: 'Укажите ФИО, телефон в формате +375(44)4444444 и место работы, например: Иванова Анна Петровна, +375(29)7654321, ООО «Ромашка»' });
  }
  out.trustedPerson = v.trustedPerson || null;

  if (errors.length) throw new ApiError(400, 'Проверьте данные анкеты', errors);
  return out;
}

module.exports = { validatePatientProfile, SOCIAL_STATUSES, GENDERS, ageOn };
