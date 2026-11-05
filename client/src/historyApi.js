import { api } from './api';
import { downloadDocx } from './doctorApi';

// «Моя история болезни»: приёмы, которые оформил врач, и выданные по ним направления

// Список приёмов пациента: { mongoAvailable, data: [{ id, date, doctor, diagnosis, icdCode, complaints, referralsCount }] }
export const fetchHistory = (signal) => api
  .get('/me/history', { signal })
  .then(({ data }) => data);

// Один приём: { visit, referrals, card }
export const fetchVisit = (visitId, signal) => api
  .get(`/me/history/${visitId}`, { signal })
  .then(({ data }) => data);

export const downloadVisitDocx = (visitId) => downloadDocx(`/me/history/${visitId}/visit.docx`, 'Приём врача.docx');

export const downloadMyReferralDocx = (visitId, referralId) => downloadDocx(
  `/me/history/${visitId}/referrals/${referralId}.docx`,
  'Направление.docx',
);
