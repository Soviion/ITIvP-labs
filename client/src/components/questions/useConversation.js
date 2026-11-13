import { useCallback, useEffect, useEffectEvent, useRef, useState } from 'react';
import { getErrorMessage, isCanceled } from '../../api';
import { fetchMessages, markConversationRead } from '../../questionsApi';
import { useRealtime, useSocketEvent } from '../../realtime/hooks';
import { setOpenConversation } from '../../realtime/openConversation';

// Идентификатор сообщения придумывает клиент: если ответ сервера потерялся и сообщение отправлено ещё раз, дубля не будет.
// randomUUID есть только на https и localhost, поэтому запасной вариант тоже подходит под формат сервера
const newId = () => globalThis.crypto?.randomUUID?.() ?? `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 12)}`;

const order = (a, b) => (a.seq ?? Infinity) - (b.seq ?? Infinity) || new Date(a.createdAt) - new Date(b.createdAt);

// Влить сообщения в список: одно и то же сообщение (по clientMsgId) приходит ответом на отправку, событием и в истории —
// оно обновляется, а не дублируется. «Доставлено» не пропадает от запоздавшей копии, где оно ещё не стояло
function merge(list, incoming) {
  const byKey = new Map(list.map((message) => [message.clientMsgId, message]));
  incoming.forEach((message) => {
    const old = byKey.get(message.clientMsgId);
    const next = { ...old, ...message };
    if (!('local' in message)) { delete next.local; delete next.error; }
    if (next.deliveredAt == null && old?.deliveredAt) next.deliveredAt = old.deliveredAt;
    byKey.set(message.clientMsgId, next);
  });
  return [...byKey.values()].sort(order);
}

// sending | failed | queued (ждёт, пока собеседник появится в сети) | delivered | read
export function messageStatus(message, peerReadSeq) {
  if (message.local === 'failed') return 'failed';
  if (message.local === 'sending') return 'sending';
  if (message.seq !== undefined && message.seq <= peerReadSeq) return 'read';
  return message.deliveredAt ? 'delivered' : 'queued';
}

// Вся живая часть одной беседы: история (REST), события сокета, отправка с подтверждением, «в сети», «прочитано».
// Окно монтируется на одну беседу (key = id), поэтому состояние при смене беседы пересоздаётся.
export default function useConversation({ conversationId, side }) {
  const { socket, phase, request } = useRealtime();
  const [data, setData] = useState({ load: 'loading', error: '', conversation: null, messages: [], hasMore: false, peerReadSeq: 0 });
  const [presence, setPresence] = useState({ known: false, present: false, peerInChat: false });
  const [loadingOlder, setLoadingOlder] = useState(false);
  const [reloadKey, setReloadKey] = useState(0);
  const latest = useRef({ messages: [], loaded: false });
  const needsRead = useRef(false);
  const joins = useRef(0);
  // Пришло новое сообщение собеседника: просим отметить беседу прочитанной. Через состояние, потому что событие эффекта
  // (flushRead) разрешено вызывать только из эффектов, а не из обработчика сокета
  const [readTick, setReadTick] = useState(0);

  useEffect(() => { latest.current = { messages: data.messages, loaded: data.load === 'ready' }; });

  // Отметить прочитанным, если есть непрочитанное от собеседника и вкладка на виду. Без сокета — обычным запросом
  const flushRead = useEffectEvent(() => {
    if (!needsRead.current || document.visibilityState !== 'visible') return;
    needsRead.current = false;
    const done = socket?.connected ? request('chat:read', { conversationId }) : markConversationRead(conversationId);
    Promise.resolve(done).catch(() => { needsRead.current = true; });
  });

  // История: последние сообщения. События, пришедшие раньше ответа, не теряются (список сливается, а не заменяется)
  useEffect(() => {
    const controller = new AbortController();
    fetchMessages(conversationId, {}, controller.signal)
      .then(({ conversation, messages, hasMore }) => {
        setData((prev) => ({
          load: 'ready',
          error: '',
          conversation,
          hasMore,
          messages: merge(prev.messages, messages),
          peerReadSeq: Math.max(prev.peerReadSeq, conversation.peerReadSeq ?? 0),
        }));
        if (conversation.unread > 0) needsRead.current = true;
        flushRead();
      })
      .catch((error) => {
        if (!isCanceled(error)) setData((prev) => ({ ...prev, load: 'error', error: getErrorMessage(error) }));
      });
    return () => controller.abort();
  }, [conversationId, reloadKey]);

  // После обрыва связи: всё, что пришло за это время, догружается по номеру последнего известного сообщения
  const catchUp = useEffectEvent(async () => {
    if (!latest.current.loaded) return;
    const last = Math.max(0, ...latest.current.messages.map((message) => message.seq ?? 0));
    try {
      const { messages, conversation } = await fetchMessages(conversationId, { after: last });
      setData((prev) => ({ ...prev, messages: merge(prev.messages, messages), peerReadSeq: Math.max(prev.peerReadSeq, conversation.peerReadSeq ?? 0) }));
      if (messages.some((message) => message.from !== side)) {
        needsRead.current = true;
        flushRead();
      }
    } catch { /* следующее событие или повторное открытие всё подтянет */ }
  });

  // Войти в комнату беседы: узнаём, в сети ли собеседник, и следим за этим. Повторяется после каждого переподключения
  useEffect(() => {
    if (phase !== 'online') return undefined;
    let cancelled = false;
    request('chat:open', { conversationId })
      .then((result) => {
        if (cancelled) return;
        setPresence({ known: true, present: result.present, peerInChat: result.peerInChat });
        joins.current += 1;
        if (joins.current > 1) catchUp();
      })
      .catch(() => { /* окно покажет состояние «нет соединения» */ });
    return () => {
      cancelled = true;
      if (socket?.connected) socket.emit('chat:close');
    };
  }, [phase, socket, request, conversationId]);

  useEffect(() => {
    setOpenConversation(conversationId);
    return () => setOpenConversation(null);
  }, [conversationId]);

  useEffect(() => {
    if (readTick > 0) flushRead();
  }, [readTick]);

  // вернулся на вкладку — прочитанное отмечается
  useEffect(() => {
    const onVisible = () => flushRead();
    document.addEventListener('visibilitychange', onVisible);
    return () => document.removeEventListener('visibilitychange', onVisible);
  }, []);

  useSocketEvent('chat:message', ({ conversationId: id, message }) => {
    if (id !== conversationId) return;
    setData((prev) => ({ ...prev, messages: merge(prev.messages, [message]) }));
    if (message.from !== side) {
      needsRead.current = true;
      setReadTick((tick) => tick + 1);
    }
  });
  useSocketEvent('chat:delivered', ({ conversationId: id, seqs, deliveredAt }) => {
    if (id !== conversationId) return;
    setData((prev) => ({ ...prev, messages: prev.messages.map((message) => (seqs.includes(message.seq) ? { ...message, deliveredAt: message.deliveredAt ?? deliveredAt } : message)) }));
  });
  useSocketEvent('chat:read', ({ conversationId: id, side: reader, upToSeq }) => {
    if (id !== conversationId || reader === side) return;
    setData((prev) => ({ ...prev, peerReadSeq: Math.max(prev.peerReadSeq, upToSeq) }));
  });
  // собеседник вошёл в эту беседу или вышел из неё
  useSocketEvent('chat:peer', ({ conversationId: id, side: peer, state }) => {
    if (id !== conversationId || peer === side) return;
    setPresence((prev) => ({ ...prev, peerInChat: state === 'joined' }));
  });
  // вкладка следит только за собеседником открытой беседы (одна комната «в сети»), поэтому фильтр по ключу не нужен
  useSocketEvent('presence:changed', ({ online }) => {
    setPresence((prev) => ({ ...prev, known: true, present: online, peerInChat: online ? prev.peerInChat : false }));
  });

  // Отправка. Сообщение появляется сразу («отправляется»), потом подтверждается сервером или помечается «не отправлено».
  // Повтор (retryOf) уходит с тем же идентификатором, поэтому сообщение не продублируется
  const send = useCallback(async (text, retryOf) => {
    const clientMsgId = retryOf?.clientMsgId ?? newId();
    const draft = { clientMsgId, from: side, text, createdAt: retryOf?.createdAt ?? new Date().toISOString(), deliveredAt: null };
    setData((prev) => ({ ...prev, messages: merge(prev.messages, [{ ...draft, local: 'sending' }]) }));
    try {
      const result = await request('chat:send', { conversationId, text, clientMsgId });
      // в ответе сообщение ещё без отметки «доставлено», хотя сервер уже передал его собеседнику
      const message = { ...result.message, deliveredAt: result.delivery === 'delivered' ? (result.message.deliveredAt ?? new Date().toISOString()) : result.message.deliveredAt };
      setData((prev) => ({ ...prev, messages: merge(prev.messages, [message]) }));
      return { ok: true };
    } catch (error) {
      setData((prev) => ({ ...prev, messages: merge(prev.messages, [{ ...draft, local: 'failed', error: error.message }]) }));
      return { ok: false, error };
    }
  }, [request, conversationId, side]);

  const discard = useCallback((clientMsgId) => {
    setData((prev) => ({ ...prev, messages: prev.messages.filter((message) => message.clientMsgId !== clientMsgId) }));
  }, []);

  const loadOlder = useCallback(async () => {
    const first = latest.current.messages.find((message) => message.seq !== undefined);
    if (!first || loadingOlder) return;
    setLoadingOlder(true);
    try {
      const { messages, hasMore } = await fetchMessages(conversationId, { before: first.seq });
      setData((prev) => ({ ...prev, hasMore, messages: merge(prev.messages, messages) }));
    } catch { /* кнопку можно нажать ещё раз */ } finally {
      setLoadingOlder(false);
    }
  }, [conversationId, loadingOlder]);

  const reload = useCallback(() => {
    setData((prev) => ({ ...prev, load: 'loading', error: '' }));
    setReloadKey((key) => key + 1);
  }, []);

  return { ...data, presence, phase, send, discard, loadOlder, loadingOlder, reload };
}
