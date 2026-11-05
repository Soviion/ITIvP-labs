import { api } from './api';
import { fromApiMe } from './utils/patient';

// Ограничения совпадают с серверными (services/avatarImage.js)
export const AVATAR_LIMITS = {
  types: ['image/jpeg', 'image/png', 'image/webp'],
  typeLabel: 'JPEG, PNG или WebP',
  maxBytes: 8 * 1024 * 1024,
  minSide: 120,
};

// Своё фото пациента (JPEG) как Blob: <img> не умеет подставлять заголовок Authorization, поэтому грузим через axios
export const fetchMyAvatarBlob = (signal) => api
  .get('/me/avatar', { responseType: 'blob', signal, retry: false })
  .then(({ data }) => data);

export const chooseAvatarPreset = (preset) => api
  .put('/me/avatar/preset', { preset }, { retry: false })
  .then(({ data }) => fromApiMe(data));

// Файл отправляется телом запроса как есть; сервер сам уменьшает его до 480×480
export const uploadAvatarPhoto = (file, onProgress) => api
  .put('/me/avatar/photo', file, {
    headers: { 'Content-Type': file.type },
    transformRequest: [(data) => data],
    timeout: 30_000,
    retry: false,
    onUploadProgress: onProgress ? (event) => onProgress(event.total ? event.loaded / event.total : 0) : undefined,
  })
  .then(({ data }) => fromApiMe(data));

export const clearAvatar = () => api.delete('/me/avatar', { retry: false }).then(({ data }) => fromApiMe(data));

// Проверка файла до отправки. Возвращает текст ошибки или null
export async function checkAvatarFile(file) {
  if (!AVATAR_LIMITS.types.includes(file.type)) return `Формат не поддерживается. Допустимо: ${AVATAR_LIMITS.typeLabel}.`;
  if (file.size > AVATAR_LIMITS.maxBytes) return `Файл слишком большой (${(file.size / 1024 / 1024).toFixed(1)} МБ). Допустимо до ${AVATAR_LIMITS.maxBytes / 1024 / 1024} МБ.`;
  if (file.size === 0) return 'Файл пустой.';
  try {
    const { width, height } = await readImageSize(file);
    if (Math.min(width, height) < AVATAR_LIMITS.minSide) {
      return `Фото слишком маленькое (${width}×${height}). Нужно не меньше ${AVATAR_LIMITS.minSide}×${AVATAR_LIMITS.minSide} пикселей.`;
    }
  } catch {
    return 'Не удалось прочитать изображение. Выберите другой файл.';
  }
  return null;
}

async function readImageSize(file) {
  if (typeof createImageBitmap === 'function') {
    const bitmap = await createImageBitmap(file);
    const size = { width: bitmap.width, height: bitmap.height };
    bitmap.close?.();
    return size;
  }
  const url = URL.createObjectURL(file);
  try {
    return await new Promise((resolve, reject) => {
      const image = new Image();
      image.onload = () => resolve({ width: image.naturalWidth, height: image.naturalHeight });
      image.onerror = reject;
      image.src = url;
    });
  } finally {
    URL.revokeObjectURL(url);
  }
}
