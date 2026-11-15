// Адрес сервера (API и WebSocket). Откуда он берётся:
//   1) в Docker: файл /config.js, который контейнер с nginx создаёт при запуске из переменной VITE_API_URL (см. client/docker/);
//      так домен меняется в .env без пересборки образа;
//   2) при разработке: VITE_API_URL из .env, который Vite читает на этапе сборки;
//   3) иначе локальный сервер.
const runtime = typeof window === 'undefined' ? {} : window.__APP_CONFIG__ ?? {};

export const API_URL = String(runtime.apiUrl || import.meta.env.VITE_API_URL || 'http://localhost:3000').replace(/\/+$/, '');
