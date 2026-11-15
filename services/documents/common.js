const {
  Paragraph, TextRun, Table, TableRow, TableCell, WidthType, AlignmentType, BorderStyle, VerticalAlign, ShadingType,
} = require('docx');

// Общие кирпичики для Word-документов (карта пациента и направление)
const FONT = 'Times New Roman';
const SIZE = 22; // 11 пт (в docx размер задаётся в половинках пункта)
const CM = 567; // twips в одном сантиметре
const PAGE_WIDTH = 17 * CM; // A4 21 см минус поля 2 см слева и справа

const LINE = { style: BorderStyle.SINGLE, size: 4, color: '808080' };
const NONE = { style: BorderStyle.NONE, size: 0, color: 'FFFFFF' };
const BORDERS = { top: LINE, bottom: LINE, left: LINE, right: LINE };
const NO_BORDERS = { top: NONE, bottom: NONE, left: NONE, right: NONE };

const pad2 = (n) => String(n).padStart(2, '0');

function formatDate(value) {
  if (!value) return '';
  const date = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(date.getTime())) return '';
  return `${pad2(date.getDate())}.${pad2(date.getMonth() + 1)}.${date.getFullYear()}`;
}

function formatDateTime(value) {
  if (!value) return '';
  const date = new Date(value);
  return `${formatDate(date)} ${pad2(date.getHours())}:${pad2(date.getMinutes())}`;
}

function run(text, opts = {}) {
  return new TextRun({ text: text ?? '', font: FONT, size: SIZE, ...opts });
}

// Абзац из одной или нескольких строк (\n превращается в перенос строки)
function para(text, { bold, italics, size, align, before = 0, after = 60, color, caps } = {}) {
  const lines = String(text ?? '').split('\n');
  return new Paragraph({
    alignment: align,
    spacing: { before, after },
    children: lines.map((line, index) => run(line, { bold, italics, size, color, allCaps: caps, break: index ? 1 : 0 })),
  });
}

function cell(content, { width, shade, bold, align, borders = BORDERS, span, vAlign = VerticalAlign.TOP, size, color } = {}) {
  const children = (Array.isArray(content) ? content : [content]).map((item) => (
    typeof item === 'string' || item == null ? para(item ?? '', { bold, align, size, color, after: 0 }) : item
  ));
  return new TableCell({
    children,
    borders,
    columnSpan: span,
    verticalAlign: vAlign,
    width: width ? { size: width, type: WidthType.DXA } : undefined,
    shading: shade ? { type: ShadingType.CLEAR, fill: shade, color: 'auto' } : undefined,
    margins: { top: 60, bottom: 60, left: 100, right: 100 },
  });
}

// Таблица «название — значение». Пустые значения остаются пустыми: врач заполнит их от руки или на сайте
function fieldsTable(rows, { labelWidth = 5.5 * CM } = {}) {
  return new Table({
    width: { size: PAGE_WIDTH, type: WidthType.DXA },
    columnWidths: [labelWidth, PAGE_WIDTH - labelWidth],
    rows: rows.map(([label, value]) => new TableRow({
      cantSplit: true,
      children: [
        cell(label, { width: labelWidth, shade: 'F0F0F0' }),
        cell(value ?? '', { width: PAGE_WIDTH - labelWidth }),
      ],
    })),
  });
}

function heading(text) {
  return new Paragraph({
    spacing: { before: 240, after: 100 },
    keepNext: true,
    border: { bottom: { style: BorderStyle.SINGLE, size: 6, color: '000000', space: 2 } },
    children: [run(text, { bold: true, size: 24, allCaps: true })],
  });
}

const spacer = (after = 120) => new Paragraph({ spacing: { after }, children: [] });

module.exports = {
  FONT, SIZE, CM, PAGE_WIDTH, BORDERS, NO_BORDERS, NONE, LINE,
  formatDate, formatDateTime, run, para, cell, fieldsTable, heading, spacer, AlignmentType, VerticalAlign,
};
