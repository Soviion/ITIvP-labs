// Состояние связи с сервером. Пока сервер недоступен, поверх сайта висит окно «Нет связи с сервером»
// (сайт затемнён и неактивен). Связь проверяется в фоне; когда она вернулась, окно закрывается само,
// а страница, у которой не загрузились данные, перезагружается и показывает их.
const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:3000';
const PROBE_EVERY_MS = 5000;

let lost = false; // окно «Нет связи» показано
let needsReload = false; // не загрузились данные страницы: после возвращения связи страницу нужно обновить
let timer = null;
const listeners = new Set();

function emit() {
  listeners.forEach((listener) => listener());
}

// Проверка связи без авторизации и повторов: отвечает ли сервер вообще (любой ответ HTTP считается «связь есть»)
export async function probeServer() {
  const controller = new AbortController();
  const stop = setTimeout(() => controller.abort(), 4000);
  try {
    await fetch(`${API_URL}/`, { cache: 'no-store', signal: controller.signal });
    return true;
  } catch {
    return false;
  } finally {
    clearTimeout(stop);
  }
}

function restored() {
  clearInterval(timer);
  timer = null;
  const reload = needsReload;
  needsReload = false;
  if (lost) { lost = false; emit(); }
  if (reload) window.location.reload();
}

function startProbing() {
  if (timer) return;
  timer = setInterval(async () => { if (await probeServer()) restored(); }, PROBE_EVERY_MS);
}

export const connection = {
  subscribe(listener) {
    listeners.add(listener);
    return () => listeners.delete(listener);
  },
  getSnapshot: () => lost,
  // сервер не ответил; isLoad – не получилось загрузить данные страницы (GET)
  reportLost(isLoad) {
    if (isLoad) needsReload = true;
    if (!lost) { lost = true; emit(); }
    startProbing();
  },
  // любой ответ сервера: связь есть
  reportOk() {
    if (lost || timer) restored();
  },
  // пользователь закрыл окно: оно скрывается, но проверка в фоне продолжается, если данные не загружены
  dismiss() {
    if (lost) { lost = false; emit(); }
    if (!needsReload) { clearInterval(timer); timer = null; }
  },
  // проверить сейчас (кнопка «Повторить»)
  async check() {
    const ok = await probeServer();
    if (ok) restored();
    return ok;
  },
};
