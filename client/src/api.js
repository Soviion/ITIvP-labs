import axios from 'axios';
import { connection } from './connection';
import { humanizeError, humanizeFieldMessage } from './errors';
import { fromApiAppointment, toApiAppointment, toApiPatient } from './utils/appointments';
import { apiToIsoDate, isoToApiDate } from './utils/dates';
import { fromApiMe, toApiProfile } from './utils/patient';

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:3000';
// Искусственная задержка для демонстрации спиннера и оптимистичного UI (VITE_API_DELAY_MS в .env)
const FAKE_DELAY_MS = Number(import.meta.env.VITE_API_DELAY_MS) || 0;
// Два независимых входа: сайт пациентов («Твой талон») и кабинет врача («Моя клиника»). У каждого свой токен и своя сессия:
// вход на одном сайте не открывает другой.
const TOKEN_KEYS = { site: 'clinic.site.token', doctor: 'clinic.doctor.token' };
// какому входу принадлежит запрос, определяется страницей, с которой он сделан
export const portalOf = (pathname = window.location.pathname) => (pathname === '/doctor' || pathname.startsWith('/doctor/') ? 'doctor' : 'site');

// Повтор запроса при ошибке: всего до 3 попыток, пауза растёт: 1 с, 2 с
export const RETRY = { attempts: 3, baseDelayMs: 1000 };


const memoryTokens = { site: null, doctor: null };

export const tokenStorage = {
  get(portal = portalOf()) {
    try {
      return localStorage.getItem(TOKEN_KEYS[portal]) ?? memoryTokens[portal];
    } catch {
      return memoryTokens[portal];
    }
  },
  set(token, portal = portalOf()) {
    memoryTokens[portal] = token;
    try {
      localStorage.setItem(TOKEN_KEYS[portal], token);
    } catch { /* без localStorage токен живёт до перезагрузки страницы */ }
  },
  clear(portal = portalOf()) {
    memoryTokens[portal] = null;
    try {
      localStorage.removeItem(TOKEN_KEYS[portal]);
    } catch { /* ничего не делаем */ }
  },
};

//  Экземпляр axios 
export const api = axios.create({
  baseURL: API_URL,
  timeout: 10_000,
});

const sleep = (ms, signal) => new Promise((resolve, reject) => {
  if (signal?.aborted) {
    reject(new axios.CanceledError());
    return;
  }
  const onAbort = () => {
    clearTimeout(timer);
    reject(new axios.CanceledError());
  };
  const timer = setTimeout(() => {
    signal?.removeEventListener('abort', onAbort);
    resolve();
  }, ms);
  signal?.addEventListener('abort', onAbort, { once: true });
});

api.interceptors.request.use(async (config) => {
  if (FAKE_DELAY_MS) await sleep(FAKE_DELAY_MS, config.signal);

  config.portal = config.portal ?? portalOf();
  const token = tokenStorage.get(config.portal);
  if (token && !config.skipAuth) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

let retrySeq = 0;
let retrySnapshot = null;
const retryEntries = new Map();
const retryListeners = new Set();

function publishRetry() {
  const entries = [...retryEntries.values()];
  retrySnapshot = entries.length ? entries[entries.length - 1] : null;
  retryListeners.forEach((listener) => listener());
}

export const retryStore = {
  subscribe(listener) {
    retryListeners.add(listener);
    return () => retryListeners.delete(listener);
  },
  getSnapshot: () => retrySnapshot,
};

function clearRetry(config) {
  if (config?.__retryId && retryEntries.delete(config.__retryId)) publishRetry();
}

function shouldRetry(error) {
  if (axios.isCancel(error) || error.config?.retry === false) return false;
  if (!error.response) return true;
  return error.response.status >= 500 || error.response.status === 408;
}

const unauthorizedListeners = new Set();

export function onUnauthorized(listener) {
  unauthorizedListeners.add(listener);
  return () => unauthorizedListeners.delete(listener);
}

api.interceptors.response.use(
  (response) => {
    clearRetry(response.config);
    connection.reportOk(); // сервер ответил: связь есть
    return response;
  },
  async (error) => {
    const { config } = error;

    if (config && shouldRetry(error)) {
      const attempt = config.__attempt ?? 1;
      if (attempt < RETRY.attempts) {
        const delayMs = RETRY.baseDelayMs * 2 ** (attempt - 1);
        const id = (config.__retryId ??= ++retrySeq);
        const entry = { id, attempt: attempt + 1, max: RETRY.attempts, delayMs, method: config.method?.toUpperCase(), url: config.url };

        config.__attempt = attempt + 1;
        retryEntries.set(id, { ...entry, phase: 'waiting' });
        publishRetry();

        try {
          await sleep(delayMs, config.signal);
        } catch (cancel) {
          clearRetry(config);
          throw cancel;
        }

        retryEntries.set(id, { ...entry, phase: 'sending' });
        publishRetry();
        return api.request(config); 
      }
    }

    clearRetry(config);

    // Сервер не ответил совсем (не таймаут, не отмена запроса): показываем окно «Нет связи с сервером».
    // Любой ответ сервера, даже с ошибкой, означает, что связь есть.
    if (error.response) connection.reportOk();
    else if (!axios.isCancel(error) && error.code !== 'ECONNABORTED' && error.code !== 'ETIMEDOUT') connection.reportLost(config?.method?.toLowerCase() === 'get');

    if (error.response?.status === 401 && config?.headers?.Authorization) {
      const portal = config.portal ?? portalOf();
      tokenStorage.clear(portal);
      unauthorizedListeners.forEach((listener) => listener(portal)); // выходит только тот вход, чей токен отклонён
    }
    return Promise.reject(error);
  },
);


export const isCanceled = (error) => axios.isCancel(error);
export const getStatus = (error) => error?.response?.status ?? null;

// Тексты ошибок для интерфейса собирает errors.js: адреса запросов и прочий технический текст до пользователя не доходят
export const getErrorMessage = humanizeError;

export function getFieldErrors(error) {
  const details = error?.response?.data?.details;
  if (!Array.isArray(details)) return {};
  return details.reduce((acc, { field, message }) => (field && !acc[field] ? { ...acc, [field]: humanizeFieldMessage(message) } : acc), {});
}

export const getDetailMessages = (error) => {
  const details = error?.response?.data?.details;
  return Array.isArray(details) ? details.map((item) => humanizeFieldMessage(item.message)) : [];
};

//  Записи на приём: CRUD 

export const fetchAppointments = (signal) => api
  .get('/appointments', { signal })
  .then(({ data }) => data.map(fromApiAppointment));

export const addAppointment = (draft) => api
  .post('/appointments', toApiAppointment(draft))
  .then(({ data }) => fromApiAppointment(data));

export const updateAppointment = (id, draft) => api
  .put(`/appointments/${id}`, toApiAppointment(draft))
  .then(({ data }) => fromApiAppointment(data));

export const patchAppointment = (id, changes) => api
  .patch(`/appointments/${id}`, changes)
  .then(({ data }) => fromApiAppointment(data));

export const deleteAppointment = (id) => api
  .delete(`/appointments/${id}`)
  .then(({ data }) => data);


export const fetchPatients = (signal) => api.get('/patients', { signal }).then(({ data }) => data);

export const createPatient = (draft) => api.post('/patients', toApiPatient(draft)).then(({ data }) => data);

export const fetchDoctors = (signal) => api.get('/doctors', { signal }).then(({ data }) => data);


export const fetchSlotDays = (doctorId, signal, exclude) => api
  .get('/slots/days', { params: { doctorId, exclude }, signal })
  .then(({ data }) => data.map((day) => ({ date: apiToIsoDate(day.date), free: day.free })));

export const fetchSlots = (doctorId, isoDate, signal, exclude) => api
  .get('/slots', { params: { doctorId, date: isoToApiDate(isoDate), exclude }, signal })
  .then(({ data }) => data.slots);

//  Личный кабинет пациента 

export const fetchMe = (signal) => api.get('/me', { signal }).then(({ data }) => fromApiMe(data));

export const updatePatientProfile = (values) => api
  .patch('/me/patient', toApiProfile(values), { retry: false })
  .then(({ data }) => fromApiMe(data));

// changes: { bloodType?, heightCm?, weightKg?, diseases?, medications? }
export const updateRecord = (changes) => api
  .patch('/me/record', changes, { retry: false })
  .then(({ data }) => fromApiMe(data));

export const fetchMyAppointments = (signal) => api
  .get('/me/appointments', { signal })
  .then(({ data }) => data.map(fromApiAppointment));

export const bookAppointment = ({ doctorId, date, time, reason }) => api
  .post('/me/appointments', { doctorId, date: isoToApiDate(date), time, reason }, { retry: false })
  .then(({ data }) => fromApiAppointment(data));

export const cancelMyAppointment = (id) => api
  .post(`/me/appointments/${id}/cancel`, null, { retry: false })
  .then(({ data }) => fromApiAppointment(data));

// Удалить отменённый или прошедший талон из своего списка (в клинике запись остаётся)
export const deleteMyAppointment = (id) => api
  .delete(`/me/appointments/${id}`, { retry: false })
  .then(({ data }) => data);

// Очистить архив: убрать все отменённые и прошедшие талоны
export const clearMyArchive = () => api
  .delete('/me/appointments', { retry: false })
  .then(({ data }) => data);

export const fetchDoctor = (id, signal) => api.get(`/doctors/${id}`, { signal }).then(({ data }) => data);

// Перенос и/или смена описания собственной записи: changes = { date?, time?, reason? }
export const updateMyAppointment = (id, changes) => api
  .patch(`/me/appointments/${id}`, { ...changes, ...(changes.date ? { date: isoToApiDate(changes.date) } : {}) }, { retry: false })
  .then(({ data }) => fromApiAppointment(data));
