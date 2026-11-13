import { useEffect, useEffectEvent, useMemo, useState, useSyncExternalStore } from 'react';
import { useToast } from '../ui/toastContext';
import { useRealtime } from './hooks';

// Бронь времени. Пациент выбрал врача, день и время: сервер закрепляет талон за ним на 15 секунд (событие hold:acquire),
// остальные видят его занятым. Бронь снимается, когда выбор изменился, окно закрыто, связь потеряна или время вышло.
// Запись по-прежнему делает обычный REST-запрос: бронь только не даёт чужому пациенту занять талон раньше.
//
// Состояние: idle (брони нет) · pending (ждём ответ сервера или соединение) · holding (талон за вами, идёт отсчёт) ·
// denied (отказали, выбор сброшен) · ended (время вышло, выбор сброшен) · unavailable (бронь недоступна, запись работает как обычно)

const IDLE = { status: 'idle', deadline: null, ttlMs: 0 };
const EMPTY = { key: null, ...IDLE };

const MESSAGES = {
  timeout: { title: 'Бронь снята', text: 'Время брони истекло. Выберите время снова' },
  replaced: { title: 'Бронь снята', text: 'Вы выбрали время в другом окне, здесь бронь снята. Выберите время снова' },
  taken: { title: 'Время недоступно', text: 'Этот талон только что выбрал другой пациент. Выберите другое время' },
  cooldown: { title: 'Подождите немного', text: 'Вы только что держали это время. Подождите несколько секунд или выберите другое' },
  rate: { title: 'Слишком часто', text: 'Вы слишком быстро выбираете время. Подождите несколько секунд' },
  invalid: { title: 'Время недоступно', text: 'Этот талон выбрать нельзя. Выберите другое время' },
};
// эти отказы не про выбор пациента: бронь просто не работает, а запись идёт обычным путём
const NO_HOLD = new Set(['login', 'forbidden', 'unavailable']);
const DEFAULT_TTL_MS = 15000;
const RETRY_MS = 1000;
const MAX_RETRIES = 3;

// ---------- часы: один таймер на всё приложение, компоненты с отсчётом перерисовываются 4 раза в секунду ----------

const listeners = new Set();
let ticker = null;

// Текущее время в performance.now(), округлённое ВВЕРХ до 50 мс: в пределах одной отрисовки оно не меняется (React сверяет
// значение дважды), а показанные секунды никогда не выше настоящих (в первый кадр брони видно «15 с», а не «16 с»)
const clock = () => Math.ceil(performance.now() / 50) * 50;

function subscribe(listener) {
  listeners.add(listener);
  if (!ticker) ticker = setInterval(() => listeners.forEach((notify) => notify()), 250);
  return () => {
    listeners.delete(listener);
    if (!listeners.size) {
      clearInterval(ticker);
      ticker = null;
    }
  };
}

// Сколько четвертей секунды осталось до deadline (момент в performance.now()). Секунды = Math.ceil(q / 4)
export function useHoldQuarters(deadline) {
  return useSyncExternalStore(subscribe, () => (deadline == null ? 0 : Math.max(0, Math.ceil((deadline - clock()) / 250))));
}
export const quartersToSeconds = (quarters) => Math.ceil(quarters / 4);

// ---------- сама бронь ----------

// onLost() вызывается, когда бронь закончилась не по воле пациента (время вышло, отказ, бронь снята в другом окне):
// владелец выбора должен сбросить время. Сообщение пациенту показывает сам хук.
export default function useSlotHold({ doctorId, date, time, enabled = true, onLost }) {
  const { socket, request } = useRealtime();
  const toast = useToast();
  const [hold, setHold] = useState(EMPTY);
  const key = enabled && doctorId && date && time ? `${doctorId}|${date}|${time}` : null;

  const lost = useEffectEvent((message) => {
    onLost?.();
    if (message) toast.info(message.text, { title: message.title, duration: 6000 });
  });

  useEffect(() => {
    if (!socket || !key) return undefined;
    const [id, day, slot] = key.split('|');
    const target = { doctorId: Number(id), date: day, time: slot };

    let alive = true; // эффект ещё актуален: выбор не менялся
    let finished = false; // бронь закончилась, повторять нельзя
    let held = false; // сервер подтвердил бронь, и она не снята
    let inflight = false; // запрос на бронь отправлен, ответа нет
    let attempt = 0; // номер запроса: запоздавший ответ предыдущего отбрасывается
    let retries = 0;
    let hardDeadline = null; // самый поздний момент, до которого бронь может жить, даже если пришлось бронировать заново после обрыва
    let timer = null;
    let retryTimer = null;

    const publish = (status, deadline = null, ttlMs = 0) => setHold({ key, status, deadline, ttlMs });

    // Бронь закончилась: сообщаем, сбрасываем выбор и (на всякий случай) просим сервер снять её, если она ещё есть
    const stop = (status, message) => {
      if (finished) return;
      finished = true;
      held = false;
      clearTimeout(timer);
      clearTimeout(retryTimer);
      publish(status);
      if (socket.connected) socket.emit('hold:release', target);
      lost(message);
    };

    const acquire = async () => {
      if (finished || inflight) return;
      inflight = true;
      const mine = ++attempt;
      try {
        const response = await request('hold:acquire', target);
        if (!alive || finished || mine !== attempt) return;
        inflight = false;
        retries = 0;
        held = true;
        const ttl = Number(response.ttlMs) > 0 ? Number(response.ttlMs) : DEFAULT_TTL_MS;
        const granted = performance.now() + ttl;
        hardDeadline ??= granted; // после обрыва связи бронь не продлевается: всего 15 секунд на один выбор
        const deadline = Math.min(granted, hardDeadline);
        publish('holding', deadline, ttl);
        clearTimeout(timer);
        timer = setTimeout(() => stop('ended', MESSAGES.timeout), Math.max(0, deadline - performance.now()));
      } catch (error) {
        if (!alive || finished || mine !== attempt) return;
        inflight = false;
        if (error.code && NO_HOLD.has(error.code)) {
          publish('unavailable');
          return;
        }
        if (error.code) {
          stop('denied', MESSAGES[error.code] ?? MESSAGES.invalid);
          return;
        }
        // нет связи или сервер не ответил: пока работаем без брони, при (пере)подключении попробуем снова
        publish('pending');
        if (socket.connected && retries < MAX_RETRIES) {
          retries += 1;
          retryTimer = setTimeout(acquire, RETRY_MS);
        }
      }
    };

    // Связь вернулась: сервер снял бронь при обрыве, бронируем заново, но только пока не вышел исходный срок
    const onConnect = () => {
      if (finished) return;
      held = false;
      inflight = false;
      if (hardDeadline !== null && performance.now() >= hardDeadline) {
        stop('ended', MESSAGES.timeout);
        return;
      }
      acquire();
    };
    const onDisconnect = () => {
      if (finished) return;
      held = false;
      inflight = false;
      attempt += 1;
      clearTimeout(timer);
      clearTimeout(retryTimer);
      publish('pending');
    };
    // Сервер сообщил, что бронь закончилась: вышло время, бронь заменена (другое окно) или талон занят записью
    const onEnded = (event) => {
      if (finished || event?.doctorId !== target.doctorId || event.date !== target.date || event.time !== target.time) return;
      if (event.reason === 'booked') {
        finished = true;
        held = false;
        clearTimeout(timer);
        publish('idle');
        return;
      }
      stop('ended', event.reason === 'replaced' ? MESSAGES.replaced : MESSAGES.timeout);
    };

    socket.on('connect', onConnect);
    socket.on('disconnect', onDisconnect);
    socket.on('hold:ended', onEnded);
    if (socket.connected) acquire();

    return () => {
      alive = false;
      clearTimeout(timer);
      clearTimeout(retryTimer);
      socket.off('connect', onConnect);
      socket.off('disconnect', onDisconnect);
      socket.off('hold:ended', onEnded);
      // выбор изменился или окно закрыто: бронь больше не нужна (если запрос ещё в пути, сервер получит снятие следом за ним)
      if (!finished && (held || inflight) && socket.connected) socket.emit('hold:release', target);
      setHold(EMPTY);
    };
  }, [socket, request, key]);

  const current = hold.key === key ? hold : null;
  const status = key ? (current?.status ?? 'pending') : 'idle';
  const deadline = current?.deadline ?? null;
  const ttlMs = current?.ttlMs ?? 0;
  return useMemo(() => (status === 'idle' ? IDLE : { status, deadline, ttlMs }), [status, deadline, ttlMs]);
}

export { IDLE as HOLD_IDLE };
