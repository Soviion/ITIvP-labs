const {
  Document, Packer, Table, TableRow, Paragraph, AlignmentType, WidthType, BorderStyle,
} = require('docx');
const {
  FONT, SIZE, CM, PAGE_WIDTH, NO_BORDERS, BORDERS, formatDate, run, para, cell, fieldsTable, spacer, VerticalAlign,
} = require('./common');
const clinic = require('./clinic');

const URGENCY = { planned: 'плановое', urgent: 'СРОЧНОЕ' };

const fullName = (patient) => [patient?.lastName, patient?.firstName, patient?.middleName].filter(Boolean).join(' ');

// Официальная шапка: слева — учреждение, справа — реквизиты документа. Под ней двойная линия
function header(referral) {
  const left = [
    para('Министерство здравоохранения', { size: 20, after: 0 }),
    para('Республики Беларусь', { size: 20, after: 80 }),
    para(`Учреждение здравоохранения «${clinic.name}»`, { bold: true, size: 24, after: 20 }),
    para(`${clinic.address}`, { size: 18, color: '444444', after: 0 }),
    para(`тел. ${clinic.phone}`, { size: 18, color: '444444', after: 0 }),
  ];
  const right = [
    para('Номер направления', { size: 18, color: '444444', after: 0, align: AlignmentType.RIGHT }),
    para(referral.number, { bold: true, size: 26, after: 80, align: AlignmentType.RIGHT }),
    para('Дата выдачи', { size: 18, color: '444444', after: 0, align: AlignmentType.RIGHT }),
    para(formatDate(referral.issuedAt), { bold: true, after: 0, align: AlignmentType.RIGHT }),
  ];
  const half = PAGE_WIDTH / 2;
  return [
    new Table({
      width: { size: PAGE_WIDTH, type: WidthType.DXA },
      columnWidths: [half + 400, half - 400],
      rows: [new TableRow({ children: [
        cell(left, { width: half + 400, borders: NO_BORDERS }),
        cell(right, { width: half - 400, borders: NO_BORDERS }),
      ] })],
    }),
    new Paragraph({
      spacing: { before: 60, after: 200 },
      border: {
        top: { style: BorderStyle.SINGLE, size: 12, color: '000000', space: 1 },
        bottom: { style: BorderStyle.SINGLE, size: 4, color: '000000', space: 1 },
      },
      children: [],
    }),
  ];
}

// Блок подписи и места печати: слева подпись врача, справа рамка «М.П.»
function signatureBlock(referral) {
  const stamp = cell(
    [para('М.П.', { align: AlignmentType.CENTER, color: '888888', after: 0 })],
    { width: 4.5 * CM, borders: BORDERS, vAlign: VerticalAlign.CENTER },
  );
  const sign = cell([
    para('Врач', { size: 20, color: '444444', after: 20 }),
    para(`${referral.doctor?.name ?? ''}${referral.doctor?.specialty ? `, ${referral.doctor.specialty}` : ''}`, { bold: true, after: 300 }),
    para('Подпись ____________________', { after: 200 }),
    para(`Дата ${formatDate(referral.issuedAt)}`, { after: 0 }),
  ], { width: PAGE_WIDTH - 4.5 * CM - 400, borders: NO_BORDERS });
  const gap = cell('', { width: 400, borders: NO_BORDERS });

  return new Table({
    width: { size: PAGE_WIDTH, type: WidthType.DXA },
    columnWidths: [PAGE_WIDTH - 4.5 * CM - 400, 400, 4.5 * CM],
    rows: [new TableRow({ height: { value: 3.5 * CM, rule: 'atLeast' }, children: [sign, gap, stamp] })],
  });
}

// card — документ карты (пациент, номер), referral — одно направление из массива referrals
async function buildReferralDocx(card, referral) {
  const patient = card.patient ?? {};
  const children = [
    ...header(referral),
    para('НАПРАВЛЕНИЕ', { bold: true, size: 36, align: AlignmentType.CENTER, after: 40 }),
    para(`${referral.toSpecialty}${referral.urgency === 'urgent' ? ' — срочно' : ''}`, { size: 24, align: AlignmentType.CENTER, after: 240, italics: true }),
    fieldsTable([
      ['Пациент', fullName(patient)],
      ['Дата рождения', formatDate(patient.birthDate)],
      ['Номер медицинской карты', card.cardNumber],
      ['Адрес проживания', patient.address],
      ['Номер полиса', patient.insuranceNumber],
    ], { labelWidth: 5.5 * CM }),
    spacer(160),
    fieldsTable([
      ['Куда направляется', [referral.toSpecialty, referral.toFacility].filter(Boolean).join(', ')],
      ['Срочность', URGENCY[referral.urgency] ?? ''],
      ['Диагноз', [referral.diagnosis, referral.icdCode ? `(МКБ-10: ${referral.icdCode})` : ''].filter(Boolean).join(' ')],
      ['Цель направления', referral.purpose],
      ['Проведённое обследование и отметки', referral.notes],
      ['Действительно до', formatDate(referral.validUntil)],
    ], { labelWidth: 5.5 * CM }),
    spacer(360),
    signatureBlock(referral),
  ];

  const doc = new Document({
    creator: clinic.name,
    title: `Направление ${referral.number}`,
    styles: { default: { document: { run: { font: FONT, size: SIZE } } } },
    sections: [{
      properties: { page: { size: { width: 11906, height: 16838 }, margin: { top: 1000, bottom: 1000, left: 2 * CM, right: 2 * CM } } },
      children,
    }],
  });
  return Packer.toBuffer(doc);
}

module.exports = { buildReferralDocx, run };
