const DOCX = 'application/vnd.openxmlformats-officedocument.wordprocessingml.document';

// Отдаёт готовый Word-файл как скачивание. Имя может быть на русском: для браузера оно кодируется отдельным полем
function sendDocx(res, buffer, name) {
  res.set({
    'Content-Type': DOCX,
    'Content-Disposition': `attachment; filename="${name.replace(/[^\w.-]/g, '_')}"; filename*=UTF-8''${encodeURIComponent(name)}`,
    'Content-Length': buffer.length,
    'Cache-Control': 'no-store',
  }).send(buffer);
}

module.exports = sendDocx;
