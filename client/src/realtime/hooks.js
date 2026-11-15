import { useContext, useEffect, useEffectEvent, useState } from 'react';
import { RealtimeContext } from './context';

export const useRealtime = () => useContext(RealtimeContext);

// Сколько бесед с непрочитанным: красный кружок. { total, items: [{ conversationId, unread }] }
export const useUnread = () => useContext(RealtimeContext).unread;

// Подписка на событие сервера, пока компонент на экране
export function useSocketEvent(event, handler) {
  const { socket } = useRealtime();
  const run = useEffectEvent(handler);
  useEffect(() => {
    if (!socket) return undefined;
    const listener = (...args) => run(...args);
    socket.on(event, listener);
    return () => socket.off(event, listener);
  }, [socket, event]);
}

// «Тихое» обновление данных по сигналу сервера: refresh вызывается без спиннера загрузки. Серия событий подряд
// схлопывается в один вызов (delay), а после обрыва связи данные обновляются сами: пропущенные события не потеряются
export function useLiveRefresh(event, refresh, delay = 250) {
  const { socket } = useRealtime();
  const run = useEffectEvent(refresh);
  useEffect(() => {
    if (!socket) return undefined;
    let timer = null;
    const schedule = () => {
      clearTimeout(timer);
      timer = setTimeout(run, delay);
    };
    socket.on(event, schedule);
    socket.io.on('reconnect', schedule);
    return () => {
      clearTimeout(timer);
      socket.off(event, schedule);
      socket.io.off('reconnect', schedule);
    };
  }, [socket, event, delay]);
}

const NO_HOLDS = new Set();
const holdKey = ({ date, time }) => `${date}|${time}`;

// Следить за свободными талонами врача. onChanged вызывается, когда у него что-то изменилось (и после переподключения).
// Сервер держит одну подписку на вкладку, новая заменяет прежнюю. Расписание открыто всем, вход не нужен.
// Возвращает множество броней врача «ГГГГ-ММ-ДД|ЧЧ:ММ»: талоны, которые сейчас выбирает какой-то пациент (в том числе
// этот же). Снимок приходит в ответе на подписку, дальше брони меняются по событию hold:changed; после переподключения
// снимок запрашивается заново, поэтому пропущенные события не страшны.
export function useSlotsWatch(doctorId, onChanged) {
  const { socket } = useRealtime();
  const changed = useEffectEvent(onChanged);
  const [holds, setHolds] = useState({ doctorId: null, keys: NO_HOLDS });
  useEffect(() => {
    if (!socket || !doctorId) return undefined;
    let alive = true;
    const watch = () => socket.emit('slots:watch', { doctorId }, (response) => {
      if (!alive || !response?.ok) return;
      setHolds({ doctorId, keys: new Set((response.holds ?? []).map(holdKey)) });
    });
    const onSlots = (event) => { if (event.doctorId === doctorId) changed(event); };
    const onHold = (event) => {
      if (event?.doctorId !== doctorId) return;
      setHolds((prev) => {
        const keys = new Set(prev.doctorId === doctorId ? prev.keys : NO_HOLDS);
        if (event.held) keys.add(holdKey(event));
        else keys.delete(holdKey(event));
        return { doctorId, keys };
      });
    };
    const onReconnect = () => changed(null);
    if (socket.connected) watch();
    socket.on('connect', watch); // комнаты на сервере сбрасываются при обрыве: подписываемся заново
    socket.on('slots:changed', onSlots);
    socket.on('hold:changed', onHold);
    socket.io.on('reconnect', onReconnect);
    return () => {
      alive = false;
      socket.off('connect', watch);
      socket.off('slots:changed', onSlots);
      socket.off('hold:changed', onHold);
      socket.io.off('reconnect', onReconnect);
      if (socket.connected) socket.emit('slots:unwatch');
    };
  }, [socket, doctorId]);
  return holds.doctorId === doctorId ? holds.keys : NO_HOLDS;
}
