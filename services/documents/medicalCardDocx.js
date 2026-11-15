const sharp = require('sharp');
const {
  Document, Packer, Table, TableRow, ImageRun, Footer, Paragraph, AlignmentType, WidthType, TextRun, PageNumber,
} = require('docx');
const {
  FONT, SIZE, CM, PAGE_WIDTH, NO_BORDERS, BORDERS, formatDate, formatDateTime, run, para, cell, fieldsTable, heading, spacer, VerticalAlign,
} = require('./common');
const clinic = require('./clinic');

const GENDERS = { male: 'мужской', female: 'женский' };
const SOCIAL = { student: 'студент', schoolchild: 'школьник', child: 'ребёнок', adult: 'взрослый' };

const PHOTO_W = 3 * CM;
const PHOTO_H = 4 * CM;
const PHOTO_COL = PHOTO_W + 200;

// Фото 3×4 см. Если пациент своё фото не загружал — пустая рамка с надписью «Нет фото»
async function photoCell(photo) {
  if (photo) {
    const data = await sharp(photo).resize(360, 480, { fit: 'cover', position: 'attention' }).jpeg({ quality: 88 }).toBuffer();
    return cell(
      new Paragraph({ alignment: AlignmentType.CENTER, children: [new ImageRun({ type: 'jpg', data, transformation: { width: 113, height: 151 } })] }),
      { width: PHOTO_COL, borders: BORDERS, vAlign: VerticalAlign.CENTER },
    );
  }
  return cell(para('Нет фото', { align: AlignmentType.CENTER, color: '808080', after: 0 }), {
    width: PHOTO_COL, borders: BORDERS, vAlign: VerticalAlign.CENTER,
  });
}

const listText = (items, pick) => (items?.length ? items.map(pick).join('; ') : '');

function fullName(patient) {
  return [patient?.lastName, patient?.firstName, patient?.middleName].filter(Boolean).join(' ');
}

function visitBlock(visit, index) {
  const prescriptions = listText(visit.prescriptions, (item) => [item.drug, item.dose, item.days ? `${item.days} дн.` : ''].filter(Boolean).join(' '));
  const pressure = visit.vitals?.pressure?.systolic ? `${visit.vitals.pressure.systolic}/${visit.vitals.pressure.diastolic ?? ''}` : '';
  const vitals = [
    visit.vitals?.temperature ? `t ${visit.vitals.temperature} °C` : '',
    visit.vitals?.pulse ? `пульс ${visit.vitals.pulse}` : '',
    pressure ? `АД ${pressure}` : '',
  ].filter(Boolean).join(', ');
  return [
    para(`Приём ${index + 1} — ${formatDateTime(visit.date)}, ${visit.doctor?.name ?? ''}${visit.doctor?.specialty ? ` (${visit.doctor.specialty})` : ''}`, { bold: true, before: 160, after: 60 }),
    fieldsTable([
      ['Жалобы', visit.complaints],
      ['Объективный осмотр', [visit.examination, vitals].filter(Boolean).join('\n')],
      ['Диагноз', [visit.diagnosis, visit.icdCode ? `(МКБ-10: ${visit.icdCode})` : ''].filter(Boolean).join(' ')],
      ['Лечение и назначения', [visit.treatment, prescriptions].filter(Boolean).join('\n')],
      ['Рекомендации', visit.recommendations],
    ], { labelWidth: 4.5 * CM }),
  ];
}

// card — обычный объект документа MongoDB (toObject), photo — Buffer с JPEG или null
async function buildMedicalCardDocx(card, photo) {
  const patient = card.patient ?? {};
  const anamnesis = card.anamnesis ?? {};
  const bmi = card.heightCm && card.weightKg ? Math.round((card.weightKg / ((card.heightCm / 100) ** 2)) * 10) / 10 : '';

  const topTable = new Table({
    width: { size: PAGE_WIDTH, type: WidthType.DXA },
    columnWidths: [PAGE_WIDTH - PHOTO_COL, PHOTO_COL],
    borders: { top: NO_BORDERS.top, bottom: NO_BORDERS.bottom, left: NO_BORDERS.left, right: NO_BORDERS.right, insideHorizontal: NO_BORDERS.top, insideVertical: NO_BORDERS.top },
    rows: [new TableRow({
      height: { value: PHOTO_H + 200, rule: 'atLeast' },
      children: [
        cell([
          para(clinic.name, { bold: true, size: 26, after: 20 }),
          para(`${clinic.address}, тел. ${clinic.phone}`, { size: 18, color: '555555', after: 200 }),
          para('МЕДИЦИНСКАЯ КАРТА АМБУЛАТОРНОГО ПАЦИЕНТА', { bold: true, size: 28, after: 120 }),
          para(`Карта № ${card.cardNumber ?? ''}`, { bold: true, size: 24, after: 40 }),
          para(`Дата заведения: ${formatDate(card.createdAt)}`, { after: 0 }),
        ], { width: PAGE_WIDTH - PHOTO_COL, borders: NO_BORDERS }),
        await photoCell(photo),
      ],
    })],
  });

  const children = [
    topTable,
    heading('1. Данные пациента'),
    fieldsTable([
      ['Фамилия, имя, отчество', fullName(patient)],
      ['Дата рождения', formatDate(patient.birthDate)],
      ['Пол', GENDERS[patient.gender] ?? ''],
      ['Телефон', patient.phone],
      ['E-mail', patient.email],
      ['Адрес проживания', patient.address],
      ['Социальный статус', SOCIAL[patient.socialStatus] ?? ''],
      ['Место работы или учёбы', patient.workplace],
      ['Номер полиса', patient.insuranceNumber],
      ['Доверенное лицо', patient.trustedPerson],
    ]),
    heading('2. Медицинские данные'),
    fieldsTable([
      ['Группа крови', card.bloodType],
      ['Рост, см', card.heightCm ? String(card.heightCm) : ''],
      ['Вес, кг', card.weightKg ? String(card.weightKg) : ''],
      ['Индекс массы тела', bmi ? String(bmi) : ''],
      ['Аллергии', (card.allergies ?? []).join('; ')],
      ['Заболевания', listText(card.diseases, (item) => item.name)],
      ['Принимаемые препараты', listText(card.medications, (item) => [item.name, item.dose].filter(Boolean).join(' '))],
    ]),
    heading('3. Анамнез'),
    fieldsTable([
      ['Наследственность', anamnesis.family],
      ['Вредные привычки', anamnesis.habits],
      ['Операции и травмы', anamnesis.surgeries],
      ['Инвалидность', anamnesis.disability],
      ['Прочее', anamnesis.notes],
    ]),
    heading('4. Приёмы и осмотры'),
  ];

  if (card.visits?.length) {
    card.visits.forEach((visit, index) => children.push(...visitBlock(visit, index)));
  } else {
    children.push(para('Записей о приёмах пока нет.', { italics: true, color: '555555' }));
  }

  children.push(heading('5. Выданные направления'));
  if (card.referrals?.length) {
    children.push(fieldsTable(card.referrals.map((item) => [
      `№ ${item.number} от ${formatDate(item.issuedAt)}`,
      `${item.toSpecialty}${item.toFacility ? `, ${item.toFacility}` : ''}. ${item.purpose}`,
    ]), { labelWidth: 5 * CM }));
  } else {
    children.push(para('Направлений нет.', { italics: true, color: '555555' }));
  }

  children.push(
    spacer(300),
    para(`Карту оформил(а): ${card.createdBy?.name ?? '______________________'}`, { after: 120 }),
    para('Подпись: ______________________', { after: 0 }),
  );

  const doc = new Document({
    creator: clinic.name,
    title: `Медицинская карта ${card.cardNumber ?? ''}`,
    styles: { default: { document: { run: { font: FONT, size: SIZE } } } },
    sections: [{
      properties: { page: { size: { width: 11906, height: 16838 }, margin: { top: 1000, bottom: 1000, left: 2 * CM, right: 2 * CM } } },
      footers: {
        default: new Footer({
          children: [new Paragraph({
            alignment: AlignmentType.CENTER,
            children: [
              run(`${clinic.name} · карта ${card.cardNumber ?? ''} · стр. `, { size: 16, color: '777777' }),
              new TextRun({ children: [PageNumber.CURRENT], font: FONT, size: 16, color: '777777' }),
            ],
          })],
        }),
      },
      children,
    }],
  });
  return Packer.toBuffer(doc);
}

module.exports = { buildMedicalCardDocx };
