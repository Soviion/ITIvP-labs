import { useSyncExternalStore } from 'react';

// Версия для слабовидящих. Режим один на весь клиент: им пользуются и сайт «Твой талон», и кабинет врача «Моя клиника».
// Состояние хранится в localStorage и применяется атрибутами на <html>, а все стили лежат в vision.css:
//   data-vision="on"  — режим включён;  data-vscheme="bw|wb|yb" — цвета;  data-vimg="on|off" — картинки.
// Размер текста один, он задан в vision.css (увеличение в 1,25 раза).

const KEY = 'talon.vision';
export const SCHEMES = ['bw', 'wb', 'yb'];
const DEFAULTS = { on: false, scheme: 'bw', images: true };

function sanitize(value) {
  const source = value && typeof value === 'object' ? value : {};
  return {
    on: source.on === true,
    scheme: SCHEMES.includes(source.scheme) ? source.scheme : DEFAULTS.scheme,
    images: source.images !== false,
  };
}

function load() {
  try {
    const raw = localStorage.getItem(KEY);
    if (raw) return sanitize(JSON.parse(raw));
  } catch { /* localStorage недоступен или в нём мусор — берём значения по умолчанию */ }
  return { ...DEFAULTS };
}

let state = load();
const listeners = new Set();

// Ставит атрибуты на <html>. Вызывается синхронно до первого рендера, поэтому страница не «мигает»
export function applyVision(current = state) {
  const root = document.documentElement;
  if (current.on) {
    root.setAttribute('data-vision', 'on');
    root.setAttribute('data-vscheme', current.scheme);
    root.setAttribute('data-vimg', current.images ? 'on' : 'off');
  } else {
    ['data-vision', 'data-vscheme', 'data-vimg'].forEach((name) => root.removeAttribute(name));
  }
}

function update(patch) {
  state = sanitize({ ...state, ...patch });
  try {
    localStorage.setItem(KEY, JSON.stringify(state));
  } catch { /* без localStorage режим живёт до перезагрузки */ }
  applyVision();
  listeners.forEach((listener) => listener());
}

const subscribe = (listener) => {
  listeners.add(listener);
  return () => listeners.delete(listener);
};
const getSnapshot = () => state;

// Режим, включённый в другой вкладке, подхватывается сразу
if (typeof window !== 'undefined') {
  window.addEventListener('storage', (event) => {
    if (event.key !== KEY) return;
    state = load();
    applyVision();
    listeners.forEach((listener) => listener());
  });
}

export const visionActions = {
  toggle: () => update({ on: !state.on }),
  enable: () => update({ on: true }),
  disable: () => update({ on: false }), // настройки цвета и картинок запоминаются, возвращается обычное оформление
  setScheme: (scheme) => update({ scheme }),
  setImages: (images) => update({ images }),
};

export const initVision = () => applyVision();
export const useVision = () => useSyncExternalStore(subscribe, getSnapshot, getSnapshot);
