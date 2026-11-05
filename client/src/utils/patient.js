import { apiToIsoDate, isoToApiDate, todayISO } from './dates';
import { isPhoneEmpty, isValidPhone } from './phone';

export const SOCIAL_STATUSES = [
  { value: 'student', label: 'Студент' },
  { value: 'schoolchild', label: 'Школьник' },
  { value: 'child', label: 'Ребёнок (до 14 лет)' },
  { value: 'adult', label: 'Взрослый' },
];
export const SOCIAL_LABELS = Object.fromEntries(SOCIAL_STATUSES.map((s) => [s.value, s.label]));

// Индекс массы тела и словесная оценка по шкале ВОЗ
export function bodyMassIndex(heightCm, weightKg) {
  if (!heightCm || !weightKg) return null;
  const value = Math.round((weightKg / ((heightCm / 100) ** 2)) * 10) / 10;
  let label = 'норма';
  if (value < 18.5) label = 'дефицит массы';
  else if (value >= 30) label = 'ожирение';
  else if (value >= 25) label = 'избыточная масса';
  return { value, label };
}

export const BLOOD_TYPES = ['O+', 'O-', 'A+', 'A-', 'B+', 'B-', 'AB+', 'AB-'];

// ---------- Адаптеры: формат API ↔ формат интерфейса ----------

export function fromApiPatient(patient) {
  if (!patient) return null;
  return {
    id: patient.id,
    lastName: patient.lastName,
    firstName: patient.firstName,
    middleName: patient.middleName ?? '',
    noMiddleName: patient.middleName === null,
    birthDate: apiToIsoDate(patient.birthDate),
    gender: patient.gender,
    socialStatus: patient.socialStatus ?? '',
    phone: patient.phone,
    email: patient.email ?? '',
    address: patient.address ?? '',
    workplace: patient.workplace ?? '',
    trustedPerson: patient.trustedPerson ?? '',
    avatar: patient.avatar ?? { kind: null, preset: null, version: null }, // стикер или своё фото (само фото грузится отдельно)
  };
}

export const fromApiMe = (data) => ({
  user: data.user,
  patient: fromApiPatient(data.patient),
  record: data.record,
});

// Анкета для отправки на сервер: даты dd-mm-yyyy
export function toApiProfile(values) {
  return {
    lastName: values.lastName,
    firstName: values.firstName,
    middleName: values.noMiddleName ? null : values.middleName,
    noMiddleName: Boolean(values.noMiddleName),
    birthDate: isoToApiDate(values.birthDate),
    gender: values.gender,
    socialStatus: values.socialStatus,
    phone: values.phone,
    address: values.address,
    workplace: values.workplace,
    trustedPerson: values.trustedPerson,
  };
}

export const emptyProfile = () => ({
  lastName: '', firstName: '', middleName: '', noMiddleName: false,
  birthDate: '', gender: '', socialStatus: '',
  phone: '', address: '', workplace: '', trustedPerson: '',
});

// ---------- Проверка анкеты (те же правила, что на сервере: utils/patientProfile.js) ----------

const NAME_RE = /^\p{L}[\p{L}'’ -]*$/u;
const squash = (text) => text.trim().replace(/\s+/g, ' ');

export function ageOn(iso) {
  const [y, m, d] = iso.split('-').map(Number);
  const now = new Date();
  let age = now.getFullYear() - y;
  if (now.getMonth() + 1 < m || (now.getMonth() + 1 === m && now.getDate() < d)) age -= 1;
  return age;
}

const AGE_RULES = {
  child: [(age) => age < 14, 'Статус «Ребёнок» — до 14 лет'],
  schoolchild: [(age) => age >= 6 && age <= 18, 'Статус «Школьник» — от 6 до 18 лет'],
  student: [(age) => age >= 15, 'Статус «Студент» — от 15 лет'],
  adult: [(age) => age >= 18, 'Статус «Взрослый» — от 18 лет'],
};

const NAME_LABELS = { lastName: 'Фамилия', firstName: 'Имя', middleName: 'Отчество' };

function checkName(name, value, errors) {
  const text = squash(value);
  if (!text) errors[name] = `Укажите ${{ lastName: 'фамилию', firstName: 'имя', middleName: 'отчество' }[name]}`;
  else if (text.length < 2 || text.length > 60 || !NAME_RE.test(text)) {
    errors[name] = `${NAME_LABELS[name]}: только буквы, пробел и дефис, от 2 до 60 символов`;
  }
}

export function validateProfile(values) {
  const errors = {};
  checkName('lastName', values.lastName, errors);
  checkName('firstName', values.firstName, errors);
  if (!values.noMiddleName) checkName('middleName', values.middleName, errors);

  let age = null;
  if (!/^\d{4}-\d{2}-\d{2}$/.test(values.birthDate)) errors.birthDate = 'Укажите дату рождения';
  else if (values.birthDate > todayISO()) errors.birthDate = 'Дата рождения не может быть в будущем';
  else if (values.birthDate < '1900-01-01' || ageOn(values.birthDate) > 120) errors.birthDate = 'Проверьте дату рождения';
  else age = ageOn(values.birthDate);

  if (!values.gender) errors.gender = 'Укажите пол';

  if (!values.socialStatus) errors.socialStatus = 'Выберите социальный статус';
  else if (age !== null) {
    const [test, message] = AGE_RULES[values.socialStatus];
    if (!test(age)) errors.socialStatus = message;
  }

  if (isPhoneEmpty(values.phone)) errors.phone = 'Укажите номер телефона';
  else if (!isValidPhone(values.phone)) errors.phone = 'Телефон в формате +375(44)4444444';

  const address = squash(values.address);
  if (address && (address.length < 5 || address.length > 255)) errors.address = 'Адрес: от 5 до 255 символов';

  if (squash(values.workplace).length > 150) errors.workplace = 'Место работы: не больше 150 символов';

  const trusted = squash(values.trustedPerson);
  if (!trusted) {
    if (age !== null && age < 18) errors.trustedPerson = 'Для несовершеннолетних укажите доверенное лицо (мать, отец, опекун)';
  } else if (trusted.length > 300) errors.trustedPerson = 'Не больше 300 символов';
  else if ((trusted.match(/\p{L}{2,}/gu) || []).length < 2 || !/\+?\d[\d\s()-]{5,}\d/.test(trusted)) {
    errors.trustedPerson = 'Укажите ФИО, телефон в формате +375(44)4444444 и место работы через запятую';
  }
  return errors;
}

export function fullPatientName(patient) {
  return patient ? [patient.lastName, patient.firstName, patient.middleName].filter(Boolean).join(' ') : '';
}

// Имя в шапке: настоящие имя и фамилия пациента, а пока карточка не загрузилась (или у сотрудника) — часть почты до @
export const displayNameOf = (patient, email = '') => (patient
  ? [patient.firstName, patient.lastName].filter(Boolean).join(' ')
  : email.split('@')[0]);
