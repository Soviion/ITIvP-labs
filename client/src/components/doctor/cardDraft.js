import { splitList } from './format';

// Черновик редактирования личного дела: все значения — строки, чтобы их можно было класть в поля ввода
const listText = (items, pick) => (items ?? []).map(pick).join('; ');
const medText = (item) => [item.name, item.dose].filter(Boolean).join(' ');

export function makeDraft(card) {
  const p = card.patient ?? {};
  const a = card.anamnesis ?? {};
  return {
    patient: {
      phone: p.phone ?? '',
      email: p.email ?? '',
      address: p.address ?? '',
      socialStatus: p.socialStatus ?? '',
      workplace: p.workplace ?? '',
      insuranceNumber: p.insuranceNumber ?? '',
      trustedPerson: p.trustedPerson ?? '',
    },
    bloodType: card.bloodType ?? '',
    heightCm: card.heightCm ?? '',
    weightKg: card.weightKg ?? '',
    allergies: (card.allergies ?? []).join('; '),
    diseases: listText(card.diseases, (item) => item.name),
    medications: listText(card.medications, medText),
    anamnesis: {
      family: a.family ?? '',
      habits: a.habits ?? '',
      surgeries: a.surgeries ?? '',
      disability: a.disability ?? '',
      notes: a.notes ?? '',
    },
  };
}

const number = (value) => (value === '' || value === null ? '' : Number(String(value).replace(',', '.')));

// Тело PATCH. Списки заболеваний и препаратов отправляем только если текст изменился,
// чтобы не потерять дозировки, которые врач не трогал
export function draftToPayload(draft, card) {
  const original = makeDraft(card);
  const payload = {
    patient: draft.patient,
    bloodType: draft.bloodType,
    heightCm: number(draft.heightCm),
    weightKg: number(draft.weightKg),
    allergies: splitList(draft.allergies),
    anamnesis: draft.anamnesis,
  };
  if (draft.diseases !== original.diseases) payload.diseases = splitList(draft.diseases);
  if (draft.medications !== original.medications) payload.medications = splitList(draft.medications);
  return payload;
}

export const hasChanges = (draft, card) => JSON.stringify(draft) !== JSON.stringify(makeDraft(card));

export function setIn(draft, path, value) {
  const [head, tail] = path.split('.');
  if (!tail) return { ...draft, [head]: value };
  return { ...draft, [head]: { ...draft[head], [tail]: value } };
}

export function getIn(draft, path) {
  const [head, tail] = path.split('.');
  // в режиме просмотра черновика ещё нет (draft === null), а редакторы полей собираются заранее
  return tail ? draft?.[head]?.[tail] ?? '' : draft?.[head] ?? '';
}
