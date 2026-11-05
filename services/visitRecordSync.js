const { MedicalRecord } = require('../models');

// Диагнозы и назначения врача попадают в медицинскую карту пациента: в его личном кабинете («Заболевания» и «Принимаемые препараты»)
// и в личное дело в MongoDB. Повторы не добавляются, лимиты те же, что у списков, которые пациент ведёт сам.
const MAX_ITEMS = 30;
const MAX_LENGTH = 120;

const normalize = (text) => String(text ?? '').trim().replace(/\s+/g, ' ').toLowerCase();
const stripCode = (text) => normalize(text).replace(/\s*\([a-z]\d{2}(\.\d{1,2})?\)$/i, '');

// «Артериальная гипертензия (I10)»
const diseaseText = (visit) => {
  const name = String(visit.diagnosis ?? '').trim();
  if (!name) return '';
  return (visit.icdCode ? `${name} (${visit.icdCode})` : name).slice(0, MAX_LENGTH);
};

// «Эналаприл 10 мг, курс 30 дн.»
const medicationText = (item) => {
  const parts = [String(item.drug ?? '').trim(), String(item.dose ?? '').trim()].filter(Boolean).join(' ');
  if (!parts) return '';
  return (item.days ? `${parts}, курс ${item.days} дн.` : parts).slice(0, MAX_LENGTH);
};

// Добавляет строку в список, если такой болезни или препарата там ещё нет. Возвращает true, если список изменился
function addDisease(list, text) {
  if (!text || list.length >= MAX_ITEMS) return false;
  if (list.some((existing) => stripCode(existing) === stripCode(text))) return false;
  list.push(text);
  return true;
}

function addMedication(list, drug, text) {
  if (!text || list.length >= MAX_ITEMS) return false;
  const name = normalize(drug);
  if (list.some((existing) => normalize(existing) === normalize(text) || normalize(existing).startsWith(name))) return false;
  list.push(text);
  return true;
}

// Кабинет пациента (PostgreSQL): строки в medical_records.diseases и medications
async function applyVisitToRecord(patientId, visit) {
  const record = await MedicalRecord.findOne({ where: { patientId } });
  if (!record) return false;

  const diseases = Array.isArray(record.diseases) ? [...record.diseases] : [];
  const medications = Array.isArray(record.medications) ? [...record.medications] : [];
  let changed = addDisease(diseases, diseaseText(visit));
  (visit.prescriptions ?? []).forEach((item) => { changed = addMedication(medications, item.drug, medicationText(item)) || changed; });

  if (changed) await record.update({ diseases, medications });
  return changed;
}

// Личное дело (MongoDB): вложенные документы diseases и medications. Возвращает true, если документ изменился (нужен save)
function applyVisitToCard(card, visit) {
  let changed = false;
  const name = String(visit.diagnosis ?? '').trim();
  if (name && !card.diseases.some((item) => stripCode(item.name) === stripCode(name))) {
    card.diseases.push({ name: name.slice(0, MAX_LENGTH), since: visit.date ?? new Date(), note: visit.icdCode ? `МКБ-10: ${visit.icdCode}` : undefined });
    changed = true;
  }
  (visit.prescriptions ?? []).forEach((item) => {
    const drug = String(item.drug ?? '').trim();
    if (!drug || card.medications.some((existing) => normalize(existing.name) === normalize(drug))) return;
    card.medications.push({
      name: drug.slice(0, MAX_LENGTH),
      dose: item.dose || undefined,
      schedule: item.days ? `курс ${item.days} дн.` : undefined,
      startedAt: visit.date ?? new Date(),
    });
    changed = true;
  });
  return changed;
}

module.exports = { applyVisitToRecord, applyVisitToCard, diseaseText, medicationText };
