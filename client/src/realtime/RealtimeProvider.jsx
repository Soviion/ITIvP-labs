import { useCallback, useEffect, useMemo, useState } from 'react';
import { io } from 'socket.io-client';
import { API_URL, tokenStorage } from '../api';
import { useAuth } from '../auth/context';
import { RealtimeContext } from './context';

const NO_UNREAD = { total: 0, items: [] };
const RECONNECT_AFTER_REFUSAL_MS = 5000;

// Одно подключение Socket.IO на вкладку и на портал. Внутри него идут все события: слоты, списки записей, чат, счётчики.
// Токен берётся из сессии своего портала («Твой талон» или «Моя клиника»), поэтому подключения порталов не смешиваются.
// Гость тоже подключается (без токена): ему доступны только свободные талоны. При входе, выходе или смене токена
// подключение пересоздаётся.
export function RealtimeProvider({ portal, children }) {
  const { status } = useAuth();
  const token = status === 'authed' ? tokenStorage.get(portal) : null;

  // owner — для какого подключения получены значения: после смены токена старые значения не показываем
  const [session, setSession] = useState({ socket: null, phase: 'connecting', unread: NO_UNREAD, owner: null });

  useEffect(() => {
    const socket = io(API_URL, {
      auth: token ? { token } : {},
      transports: ['websocket', 'polling'],
      reconnectionDelayMax: 10000,
    });
    let fatal = false; // токен отклонён или истёк: дальше переподключаться бессмысленно
    let retryTimer = null;

    const patch = (changes) => setSession((prev) => (prev.owner === socket ? { ...prev, ...changes } : prev));

    socket.on('connect', () => patch({ phase: 'online' }));
    socket.on('disconnect', (reason) => {
      patch({ phase: fatal ? 'unauthorized' : 'offline' });
      // сервер сам закрыл соединение (перезапуск, лимит): клиент в этом случае сам не переподключается
      if (reason === 'io server disconnect' && !fatal) retryTimer = setTimeout(() => socket.connect(), RECONNECT_AFTER_REFUSAL_MS);
    });
    // Отказ при рукопожатии (неверный токен, сбой базы): автоматически клиент не повторяет, решаем сами
    socket.on('connect_error', (error) => {
      if (error.message === 'unauthorized') {
        fatal = true;
        patch({ phase: 'unauthorized' });
      } else {
        patch({ phase: 'offline' });
        if (!socket.active) retryTimer = setTimeout(() => socket.connect(), RECONNECT_AFTER_REFUSAL_MS);
      }
    });
    socket.on('auth:expired', () => { fatal = true; });
    socket.on('unread:changed', (unread) => patch({ unread }));

    setSession({ socket, phase: 'connecting', unread: NO_UNREAD, owner: socket });
    return () => {
      clearTimeout(retryTimer);
      socket.close();
    };
  }, [token]);

  // Отправка с ожиданием подтверждения сервера. Ошибки приходят с понятным текстом
  const { socket } = session;
  const request = useCallback((event, data, timeoutMs = 8000) => new Promise((resolve, reject) => {
    if (!socket?.connected) {
      reject(new Error('Нет соединения с сервером. Попробуйте ещё раз через несколько секунд'));
      return;
    }
    socket.timeout(timeoutMs).emit(event, data, (error, response) => {
      if (error) reject(new Error('Сервер не ответил. Повторите попытку'));
      else if (response?.ok === false) reject(Object.assign(new Error(response.error || 'Не удалось выполнить действие'), { code: response.code }));
      else resolve(response);
    });
  }), [socket]);

  const value = useMemo(() => ({ socket, phase: session.phase, unread: session.unread, request }), [socket, session.phase, session.unread, request]);
  return <RealtimeContext value={value}>{children}</RealtimeContext>;
}
