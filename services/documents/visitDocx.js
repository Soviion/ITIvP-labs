const { Document, Packer, Paragraph, AlignmentType } = require('docx');
const {
  FONT, SIZE, CM, formatDate, formatDateTime, para, fieldsTable, heading, spacer,
} = require('./common');
const clinic = require('./clinic');

const GENDERS = { male: 'мужской', female: 'женский' };

const fullName = (patient) => [patient?.lastName, patient?.firstName, patient?.middleName].filter(Boolean).join(' ');

// Документ «Запись о приёме»: то, что врач оформил на осмотре. card — документ карты (пациент, номер), visit — один приём
async function buildVisitDocx(card, visit) {
  const patient = card.patient ?? {};
  const pressure = visit.vitals?.pressure?.systolic ? `${visit.vitals.pressure.systolic}/${visit.vitals.pressure.diastolic ?? ''}` : '';
  const vitals = [
    visit.vitals?.temperature ? `температура ${visit.vitals.temperature} °C` : '',
    visit.vitals?.pulse ? `пульс ${visit.vitals.pulse} уд/мин` : '',
    pressure ? `давление ${pressure} мм рт. ст.` : '',
  ].filter(Boolean).join(', ');
  const prescriptions = (visit.prescriptions ?? [])
    .map((item) => [item.drug, item.dose, item.days ? `${item.days} дн.` : ''].filter(Boolean).join(' '))
    .join('\n');

  const children = [
    para(clinic.name, { bold: true, size: 26, after: 20 }),
    para(`${clinic.address}, тел. ${clinic.phone}`, { size: 18, color: '555555', after: 240 }),
    para('ЗАПИСЬ О ПРИЁМЕ ВРАЧА', { bold: true, size: 30, align: AlignmentType.CENTER, after: 40 }),
    para(`от ${formatDateTime(visit.date)}`, { size: 22, align: AlignmentType.CENTER, after: 200 }),
    heading('Пациент'),
    fieldsTable([
      ['Фамилия, имя, отчество', fullName(patient)],
      ['Дата рождения', formatDate(patient.birthDate)],
      ['Пол', GENDERS[patient.gender] ?? ''],
      ['Номер медицинской карты', card.cardNumber],
    ]),
    heading('Приём'),
    fieldsTable([
      ['Врач', [visit.doctor?.name, visit.doctor?.specialty].filter(Boolean).join(', ')],
      ['Жалобы', visit.complaints],
      ['Объективный осмотр', [visit.examination, vitals].filter(Boolean).join('\n')],
      ['Диагноз', [visit.diagnosis, visit.icdCode ? `(МКБ-10: ${visit.icdCode})` : ''].filter(Boolean).join(' ')],
      ['Лечение', visit.treatment],
      ['Назначения', prescriptions],
      ['Рекомендации', visit.recommendations],
    ]),
    spacer(400),
    para(`Врач: ${visit.doctor?.name ?? '______________________'}`, { after: 160 }),
    para('Подпись: ______________________', { after: 0 }),
  ];

  const doc = new Document({
    creator: clinic.name,
    title: `Приём ${formatDate(visit.date)}`,
    styles: { default: { document: { run: { font: FONT, size: SIZE } } } },
    sections: [{
      properties: { page: { size: { width: 11906, height: 16838 }, margin: { top: 1000, bottom: 1000, left: 2 * CM, right: 2 * CM } } },
      children,
    }],
  });
  return Packer.toBuffer(doc);
}

module.exports = { buildVisitDocx, Paragraph };
