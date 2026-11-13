// Небольшие общие помощники для работы с текстом

const escapeRegExp = (text) => text.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

// Для сравнения без учёта регистра и лишних пробелов
const normalize = (text) => String(text ?? '').trim().replace(/\s+/g, ' ').toLowerCase();

// Код МКБ-10 в конце строки: «Артериальная гипертензия (I10)»
const CODE_TAIL = /\s*\(([A-Za-z]\d{2}(?:\.\d{1,2})?)\)$/;
const stripCode = (text) => normalize(String(text ?? '').replace(CODE_TAIL, ''));

// «Омез; Ингалипт, Супрастин» → массив строк
const splitList = (text) => (text ? String(text).split(/[,;\n]+/).map((item) => item.trim()).filter(Boolean) : []);

module.exports = { escapeRegExp, normalize, CODE_TAIL, stripCode, splitList };
