import { api } from './api';

// Запросы кабинета врача. Сервер: routes/doctorPortal.js, вход — POST /auth/doctor/login.
const anonymous = { skipAuth: true, retry: false };
const once = { retry: false };

// ---------- Вход ----------

// Ответ: либо { token, user }, либо { twoFactorRequired: true, tempToken } — как у обычного входа
// Второй шаг входа врача (код из Google Authenticator): у врачей свой адрес, код пациентов здесь не принимается
export const doctorLoginTwoFactor = (tempToken, code) => api
  .post('/auth/doctor/login/2fa', { tempToken, code }, anonymous)
  .then(({ data }) => data);

export const doctorLogin = (login, password) => api
  .post('/auth/doctor/login', { login, password }, anonymous)
  .then(({ data }) => data);

// ---------- Данные ----------

export const fetchDoctorMe = (signal) => api.get('/doctor/me', { signal }).then(({ data }) => data.doctor);

// period: soon (сегодня и завтра) | today | upcoming | past | all; doctorId — только для администратора (записи одного врача)
export const fetchDoctorAppointments = (period, signal, doctorId) => api
  .get('/doctor/appointments', { params: { period, ...(doctorId ? { doctorId } : {}) }, signal })
  .then(({ data }) => data);

export const fetchDoctorPatient = (patientId, signal) => api
  .get(`/doctor/patients/${patientId}`, { signal })
  .then(({ data }) => data);

// Своё фото пациента (JPEG) → blob. Если фото нет, сервер отвечает 404
export const fetchPatientPhoto = (patientId, signal) => api
  .get(`/doctor/patients/${patientId}/avatar`, { signal, responseType: 'blob', retry: false })
  .then(({ data }) => data);

// ---------- Личное дело в MongoDB ----------

export const fetchCard = (patientId, signal) => api
  .get(`/doctor/patients/${patientId}/card`, { signal })
  .then(({ data }) => data);

export const createCard = (patientId) => api
  .post(`/doctor/patients/${patientId}/card`, null, once)
  .then(({ data }) => data);

export const updateCard = (patientId, changes) => api
  .patch(`/doctor/patients/${patientId}/card`, changes, once)
  .then(({ data }) => data);

export const addVisit = (patientId, visit) => api
  .post(`/doctor/patients/${patientId}/card/visits`, visit, once)
  .then(({ data }) => data);

export const addReferral = (patientId, referral) => api
  .post(`/doctor/patients/${patientId}/card/referrals`, referral, once)
  .then(({ data }) => data);

// ---------- Word ----------

// Имя файла из Content-Disposition: filename*=UTF-8''... (кириллица) или обычный filename
function filenameFrom(header) {
  if (!header) return null;
  const encoded = /filename\*=UTF-8''([^;]+)/i.exec(header);
  if (encoded) {
    try {
      return decodeURIComponent(encoded[1]);
    } catch { /* падаем на обычное имя */ }
  }
  return /filename="?([^";]+)"?/i.exec(header)?.[1] ?? null;
}

// При ошибке blob-запроса тело ответа тоже blob: превращаем его обратно в JSON, чтобы показать сообщение сервера
async function unwrapBlobError(error) {
  const body = error?.response?.data;
  if (body instanceof Blob) {
    try {
      error.response.data = JSON.parse(await body.text());
    } catch { /* тело не JSON */ }
  }
  throw error;
}

// Скачивает документ Word с токеном и сохраняет файл через временную ссылку
export async function downloadDocx(path, fallbackName) {
  const response = await api.get(path, { responseType: 'blob', retry: false }).catch(unwrapBlobError);
  const name = filenameFrom(response.headers['content-disposition']) ?? fallbackName;
  const url = URL.createObjectURL(response.data);
  const link = document.createElement('a');
  link.href = url;
  link.download = name;
  document.body.append(link);
  link.click();
  link.remove();
  setTimeout(() => URL.revokeObjectURL(url), 10_000);
  return name;
}

// Своё фото пациента для кабинета врача (GET /doctor/patients/:id/avatar) как Blob
export const fetchPatientAvatarBlob = (patientId) => api.get(`/doctor/patients/${patientId}/avatar`, { responseType: 'blob', retry: false }).then((response) => response.data);

export const downloadCardDocx = (patientId) => downloadDocx(`/doctor/patients/${patientId}/card.docx`, 'Медицинская карта.docx');

export const downloadReferralDocx = (patientId, referralId) => downloadDocx(
  `/doctor/patients/${patientId}/referrals/${referralId}.docx`,
  'Направление.docx',
);

// Открыть доступ новому врачу: сервер создаст аккаунт и отправит на почту роль, почту и пароль
export const grantDoctorAccess = (email) => api
  .post('/doctor/access', { email }, once)
  .then(({ data }) => data);
