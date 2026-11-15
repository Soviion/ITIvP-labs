// Единое место, где любая ошибка превращается в понятный пользователю текст.
// Интерфейс никогда не показывает адреса запросов, названия заголовков, типы баз данных и прочий технический шум:
// если сообщение сервера похоже на техническое (или его нет), подставляется текст по смыслу ошибки.

// Признаки «технического» текста: HTTP-методы, пути, заголовки, токены, названия систем, camelCase-поля и т.п.
const TECHNICAL = [
  /\b(GET|POST|PUT|PATCH|DELETE|HEAD|OPTIONS|QUERY)\b/,
  /(^|[\s(])\/[\w\-.:]+(\/[\w\-.:]*)*/, // пути вида /doctors/5 или /auth/2fa/setup
  /bearer|authorization|заголовок|header/i,
  /токен|token|jwt/i,
  /objectid|json|mongo|postgres|sequelize|mongoose|\bsql\b|smtp|\bapi\b|http|localhost|endpoint|payload/i,
  /\b[a-z]+[A-Z][A-Za-z]*\b/, // patientId, bloodType и другие названия полей
  /\b(id|code)\s*=|"[A-Za-z_]+"|dd-mm-yyyy|yyyy|HH:MM/i,
  /параметр|тело запроса|маршрут/i,
  /status code|network error|econn|etimedout|enotfound|timeout of|aborted/i,
];

export const isTechnical = (text) => TECHNICAL.some((pattern) => pattern.test(text));

// Тексты по смыслу ошибки (код HTTP пользователю не показываем)
const BY_STATUS = {
  400: 'Не удалось выполнить действие. Проверьте введённые данные.',
  401: 'Сессия истекла или недействительна. Войдите заново.',
  403: 'У вас нет прав для этого действия.',
  404: 'Запрошенные данные не найдены. Возможно, они уже удалены или ссылка устарела.',
  409: 'Действие сейчас невозможно: данные уже изменились. Обновите страницу и повторите.',
  413: 'Файл слишком большой.',
  415: 'Такой тип файла не поддерживается.',
  429: 'Слишком много попыток. Подождите немного и повторите.',
  502: 'Сервис временно недоступен. Повторите попытку позже.',
  503: 'Сервис временно недоступен. Повторите попытку позже.',
  504: 'Сервис временно недоступен. Повторите попытку позже.',
};
const SERVER_ERROR = 'На сервере произошла ошибка. Повторите попытку позже.';
const NO_CONNECTION = 'Не удалось связаться с сервером. Проверьте подключение к интернету и повторите попытку.';
export const NO_CONNECTION_TEXT = NO_CONNECTION;
const TIMEOUT = 'Сервер не ответил вовремя. Проверьте соединение и повторите попытку.';

// Частные случаи, когда по тексту можно дать более точную подсказку
const SPECIAL = [
  [/истёк|истек|недействител/i, 'Сессия истекла. Войдите заново.'],
  [/objectid|идентификатор/i, 'Ссылка некорректна. Вернитесь к списку и откройте запись заново.'],
  [/mongo/i, 'Личные дела временно недоступны. Повторите попытку позже.'],
  [/2fa|setup|двухфактор/i, 'Сначала начните настройку двухфакторной защиты.'],
];

export function fallbackForStatus(status) {
  if (status >= 500) return BY_STATUS[status] ?? SERVER_ERROR;
  return BY_STATUS[status] ?? 'Не удалось выполнить действие. Повторите попытку.';
}

// Делает из текста сервера текст для пользователя. Понятные сообщения проходят как есть.
export function humanizeMessage(text, status) {
  const clean = typeof text === 'string' ? text.trim() : '';
  if (clean && !isTechnical(clean)) return status >= 500 ? `${clean.replace(/[.!]+$/, '')}. Повторите попытку позже.` : clean;
  const special = clean && SPECIAL.find(([pattern]) => pattern.test(clean));
  if (special && status !== 404 && status !== 429) return special[1];
  return fallbackForStatus(status);
}

// Текст ошибки для пользователя из ошибки axios
export function humanizeError(error) {
  if (!error?.response) {
    // Нет связи с сервером: текст пустой, об этом сообщает только окно «Нет связи с сервером» (ConnectionLostDialog).
    // Пустой текст значит «ошибку внутри блока и в уведомлении не показываем».
    return error?.code === 'ECONNABORTED' || error?.code === 'ETIMEDOUT' ? TIMEOUT : '';
  }
  const { status, data } = error.response;
  return humanizeMessage(typeof data?.error === 'string' ? data.error : '', status);
}

// «Сырой» текст сервера нужен только логике приложения (например, понять, что истёк код входа), в интерфейс он не попадает
export const serverMessage = (error) => (typeof error?.response?.data?.error === 'string' ? error.response.data.error : '');

// Подсказки к полям формы: оставляем только человеческие
export const humanizeFieldMessage = (message) => (typeof message === 'string' && message && !isTechnical(message) ? message : 'Проверьте значение');
