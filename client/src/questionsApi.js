import { api } from './api';

// Вопросы врачу: REST-часть (открыть беседу, список, история, «прочитано»). Сами сообщения отправляются по сокету,
// см. realtime/ и components/questions/useConversation.js. Повторов запроса нет (retry: false): у окна своя кнопка «Повторить»,
// а недоступность чата (503) не стоит ждать по три секунды на каждый запрос.
// Какой портал делает запрос (пациент или врач), определяется страницей — так подставляется нужный токен.

const options = (signal) => ({ signal, retry: false });

// Пациент открывает беседу с врачом (при первом обращении она создаётся)
export const openConversation = (doctorId) => api
  .post('/chat/conversations', { doctorId }, { retry: false })
  .then(({ data }) => data);

export const fetchConversations = (signal) => api
  .get('/chat/conversations', options(signal))
  .then(({ data }) => data);

// params: { before?, after?, limit? } — номера сообщений (seq)
export const fetchMessages = (conversationId, params = {}, signal) => api
  .get(`/chat/conversations/${conversationId}/messages`, { ...options(signal), params })
  .then(({ data }) => data);

export const markConversationRead = (conversationId) => api
  .post(`/chat/conversations/${conversationId}/read`, null, { retry: false })
  .then(({ data }) => data);
