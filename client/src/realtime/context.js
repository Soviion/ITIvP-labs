import { createContext } from 'react';

// socket — подключение Socket.IO (null, пока не создано); phase — connecting | online | offline | unauthorized;
// unread — { total, items } из событий unread:changed; request(event, data) — отправка с ожиданием подтверждения
export const RealtimeContext = createContext({
  socket: null,
  phase: 'connecting',
  unread: { total: 0, items: [] },
  request: () => Promise.reject(new Error('Нет соединения с сервером')),
});
