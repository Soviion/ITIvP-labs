const sharp = require('sharp');
const ApiError = require('../utils/ApiError');

// Парсер загружаемых фото: проверяет формат по содержимому файла (а не по расширению), поворачивает по EXIF,
// обрезает до квадрата и уменьшает до одного размера. В базу попадает только готовый маленький JPEG.
const ACCEPTED = { jpeg: 'JPEG', png: 'PNG', webp: 'WebP' };
const MAX_UPLOAD_BYTES = 8 * 1024 * 1024; // что принимаем от пользователя
const MIN_SIDE = 120; // меньше — на документе будет мыльным
const MAX_PIXELS = 40_000_000; // защита от «бомб» (маленький файл с гигантским разрешением)
const OUTPUT_SIDE = 480;
const OUTPUT_QUALITY = 84;

const ACCEPT_TEXT = `${Object.values(ACCEPTED).join(', ')}, до ${MAX_UPLOAD_BYTES / 1024 / 1024} МБ, не меньше ${MIN_SIDE}×${MIN_SIDE} пикселей`;

async function processAvatar(input) {
  if (!Buffer.isBuffer(input) || input.length === 0) {
    throw new ApiError(400, `Файл не получен. Допустимо: ${ACCEPT_TEXT}`);
  }
  if (input.length > MAX_UPLOAD_BYTES) {
    throw new ApiError(413, `Файл слишком большой. Допустимо: ${ACCEPT_TEXT}`);
  }

  let meta;
  try {
    meta = await sharp(input, { limitInputPixels: MAX_PIXELS }).metadata();
  } catch {
    throw new ApiError(400, `Не удалось прочитать изображение. Допустимо: ${ACCEPT_TEXT}`);
  }
  if (!ACCEPTED[meta.format]) {
    throw new ApiError(415, `Формат не поддерживается. Допустимо: ${ACCEPT_TEXT}`);
  }
  // для повёрнутых по EXIF снимков ширина и высота меняются местами, но минимальная сторона остаётся той же
  if (Math.min(meta.width ?? 0, meta.height ?? 0) < MIN_SIDE) {
    throw new ApiError(400, `Фото слишком маленькое: нужно не меньше ${MIN_SIDE}×${MIN_SIDE} пикселей`);
  }

  return sharp(input, { limitInputPixels: MAX_PIXELS })
    .rotate() // учитывает ориентацию из EXIF
    .resize(OUTPUT_SIDE, OUTPUT_SIDE, { fit: 'cover', position: 'attention' })
    .flatten({ background: '#ffffff' }) // прозрачность PNG/WebP заливаем белым
    .jpeg({ quality: OUTPUT_QUALITY, mozjpeg: true }) // метаданные (геотеги и т.п.) не сохраняются
    .toBuffer();
}

module.exports = { processAvatar, ACCEPTED_TYPES: ['image/jpeg', 'image/png', 'image/webp'], MAX_UPLOAD_BYTES, MIN_SIDE, OUTPUT_SIDE, ACCEPT_TEXT };
