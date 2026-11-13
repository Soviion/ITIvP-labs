// Обезличивание данных перед отправкой во внешнюю модель. В модель уходят только цифры и обезличенный текст:
// возраст, пол, группа крови, рост, вес, заболевания, препараты, аллергии, социальный статус и условия работы,
// анамнез (привычки, операции, наследственность), история болезни (прошлые диагнозы, назначения, осмотры – с давностью вместо дат),
// анализы и данные текущего приёма (жалобы, осмотр, температура, пульс, давление, диагноз).
// ФИО пациента и врачей, телефон, почта, адрес, дата рождения, номер карты и полиса не отправляются никогда.
// Настроение пациента в базе не хранится: ежедневный опрос на сайте анонимный, голос нельзя связать с человеком.

const { escapeRegExp } = require('../../utils/text');

const SOCIAL = { adult: 'взрослый', student: 'студент', schoolchild: 'школьник', child: 'ребёнок' };

// Возраст в полных годах вместо даты рождения
function ageYears(birthDate, today = new Date()) {
  const born = new Date(birthDate);
  if (Number.isNaN(born.getTime())) return null;
  let years = today.getFullYear() - born.getFullYear();
  if (today < new Date(today.getFullYear(), born.getMonth(), born.getDate())) years -= 1;
  return years;
}

// Чистит свободный текст врача: имена пациента (в любых падежах), почта, телефоны, длинные номера, даты, адреса
function scrubText(text, names = []) {
  let result = String(text ?? '');
  names
    .flatMap((name) => String(name ?? '').split(/[\s-]+/))
    .filter((part) => part.length >= 3)
    .forEach((part) => {
      // окончания меняются (Иванова, Иванову), поэтому сравниваем по основе слова
      const stem = escapeRegExp(part.slice(0, Math.max(3, part.length - 2)));
      result = result.replace(new RegExp(`(?<![\\p{L}])${stem}\\p{L}*`, 'giu'), '[имя]');
    });
  return result
    .replace(/[\w.+-]+@[\w-]+(\.[\w-]+)+/g, '[контакт]')
    .replace(/(\+?\d[\d\s().-]{6,}\d)/g, '[номер]')
    .replace(/\b\d{1,2}[.\-/]\d{1,2}[.\-/]\d{2,4}\b/g, '[дата]')
    .replace(/\b\d{6,}\b/g, '[номер]')
    .replace(/(?:г\.|ул\.|улица|пр\.|проспект|пер\.|переулок|д\.|кв\.)\s*[^\n,;]{0,40}/gi, '[адрес]')
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, 1000);
}

const deviation = (indicator) => {
  if (indicator.refMin !== undefined && indicator.refMin !== null && indicator.value < indicator.refMin) return 'ниже нормы';
  if (indicator.refMax !== undefined && indicator.refMax !== null && indicator.value > indicator.refMax) return 'выше нормы';
  return 'в норме';
};

const stripEmpty = (object) => Object.fromEntries(Object.entries(object).filter(([, value]) => value !== undefined && value !== null && value !== '' && !(Array.isArray(value) && !value.length)));

const MAX_HISTORY = 6; // сколько прошлых приёмов уходит в модель (самые свежие)

// «3 мес. назад» вместо даты приёма: точная дата не нужна, а в сочетании с другими данными она лишняя
function agoText(date, today = new Date()) {
  const then = new Date(date);
  if (Number.isNaN(then.getTime())) return null;
  const days = Math.max(0, Math.floor((today - then) / 86_400_000));
  if (days < 1) return 'сегодня';
  if (days < 31) return `${days} дн. назад`;
  if (days < 730) return `${Math.round(days / 30)} мес. назад`;
  return `${Math.floor(days / 365)} г. назад`;
}

const drugText = (item) => {
  if (typeof item === 'string') return item;
  const main = [item?.drug ?? item?.name, item?.dose].filter(Boolean).join(' ');
  return item?.days ? `${main}, курс ${item.days} дн.` : main;
};

function vitalsOf(vitals = {}) {
  const pressure = vitals.pressure?.systolic ? `${vitals.pressure.systolic}/${vitals.pressure.diastolic ?? ''}` : '';
  return { температура: vitals.temperature, пульс: vitals.pulse, давление: pressure };
}

// Прошлый приём из истории болезни. visit – запись из личного дела (MongoDB) или из PostgreSQL (MedicalEntry): поля общие.
// Врач (ФИО) не отправляется, только его специальность.
function historyItem(visit, names, today) {
  return stripEmpty({
    давность: agoText(visit.date ?? visit.createdAt, today),
    специальность: visit.doctor?.specialty ?? visit.specialty,
    жалобы: scrubText(visit.complaints, names),
    'осмотр врача': scrubText(visit.examination, names),
    ...vitalsOf(visit.vitals),
    диагноз: scrubText(visit.diagnosis, names),
    'код МКБ-10': visit.icdCode,
    лечение: scrubText(visit.treatment, names),
    назначения: (Array.isArray(visit.prescriptions) ? visit.prescriptions : visit.prescriptions ? [visit.prescriptions] : [])
      .map((item) => scrubText(drugText(item), names)).filter(Boolean).slice(0, 10),
    рекомендации: scrubText(visit.recommendations, names),
  });
}

// Анамнез из личного дела: привычки, операции, наследственность, инвалидность
function anamnesisOf(card, names) {
  const anamnesis = card?.anamnesis;
  if (!anamnesis) return {};
  return {
    'вредные привычки': anamnesis.habits ? scrubText(anamnesis.habits, names) : null,
    'перенесённые операции': anamnesis.surgeries ? scrubText(anamnesis.surgeries, names) : null,
    наследственность: anamnesis.family ? scrubText(anamnesis.family, names) : null,
    инвалидность: anamnesis.disability ? scrubText(anamnesis.disability, names) : null,
    'заметки к анамнезу': anamnesis.notes ? scrubText(anamnesis.notes, names) : null,
  };
}

// Строки заболеваний и препаратов: карта пациента в PostgreSQL, а если её нет – личное дело врача (данные в них синхронизируются)
function linesOf(primary, fallback) {
  const list = Array.isArray(primary) && primary.length ? primary : (fallback ?? []);
  return list.map((item) => (typeof item === 'string' ? item : [item?.name, item?.dose, item?.schedule].filter(Boolean).join(' '))).filter(Boolean);
}

/**
 * Собирает обезличенный набор данных для подсказки врачу. Список полей фиксирован, лишнее не попадёт даже случайно.
 * patient – карточка пациента (PostgreSQL), record – его медицинская карта (PostgreSQL), card – личное дело (MongoDB, если есть),
 * visits – прошлые приёмы (история болезни), labs – показатели анализов, input – то, что ввёл врач на текущем приёме.
 */
function buildPayload({ patient, record, card = null, visits = [], labs = [], input = {}, today = new Date() }) {
  const names = [patient.lastName, patient.firstName, patient.middleName, patient.trustedPerson];
  const height = record?.heightCm || card?.heightCm || null;
  const weight = record?.weightKg ? Number(record.weightKg) : (card?.weightKg ? Number(card.weightKg) : null);
  const bmi = height && weight ? Math.round((weight / ((height / 100) ** 2)) * 10) / 10 : null;
  const vitals = input.vitals ?? {};
  const pressure = vitals.pressure?.systolic ? `${vitals.pressure.systolic}/${vitals.pressure.diastolic ?? ''}` : '';
  const allergies = record?.allergies || (card?.allergies?.length ? card.allergies.join(', ') : null);
  const history = [...visits]
    .sort((a, b) => new Date(b.date ?? b.createdAt) - new Date(a.date ?? a.createdAt))
    .slice(0, MAX_HISTORY)
    .map((visit) => historyItem(visit, names, today));

  return {
    пациент: stripEmpty({
      'возраст, лет': ageYears(patient.birthDate),
      пол: patient.gender === 'female' ? 'женский' : 'мужской',
      'группа крови': record?.bloodType || card?.bloodType || null,
      'социальный статус': SOCIAL[patient.socialStatus] ?? null,
      // место работы или учёбы: важны условия (сидячая работа, стресс, вредность). Имена, телефоны, адреса вычищаются,
      // но название организации распознать нельзя: врач видит это поле в блоке «Что отправлено в модель»
      'работа или учёба': patient.workplace ? scrubText(patient.workplace, names) : null,
      'рост, см': height,
      'вес, кг': weight,
      'индекс массы тела': bmi,
      аллергии: allergies ? scrubText(allergies, names) : null,
      'текущие препараты': linesOf(record?.medications, card?.medications?.filter((item) => item.active !== false)).map((item) => scrubText(item, names)).slice(0, 15),
      'хронические заболевания': linesOf(record?.diseases, card?.diseases).map((item) => scrubText(item, names)).slice(0, 15),
      ...anamnesisOf(card, names),
    }),
    'история болезни (прошлые приёмы, сначала самые свежие)': history,
    приём: stripEmpty({
      жалобы: scrubText(input.complaints, names),
      диагноз: scrubText(input.diagnosis, names),
      'код МКБ-10': scrubText(input.icdCode, names),
      температура: vitals.temperature,
      пульс: vitals.pulse,
      давление: pressure,
      'осмотр врача': scrubText(input.examination ?? input.notes, names),
    }),
    анализы: labs.slice(0, 40).map((item) => stripEmpty({
      название: item.name,
      значение: item.value,
      единица: item.unit,
      'норма от': item.refMin,
      'норма до': item.refMax,
      отклонение: deviation(item),
    })),
  };
}

module.exports = { ageYears, scrubText, buildPayload, deviation, agoText };
