import { useCallback, useEffect, useRef, useState, useSyncExternalStore } from 'react';
import { getErrorMessage, getStatus, isCanceled } from '../../api';
import Icon from '../../ui/Icon';
import { MAX_HISTORY, MAX_QUESTION, askAssistant } from './assistantApi';
import './assistant.css';

const STORAGE_KEY = 'talon.assistant.chat';
const QUICK = ['Как записаться к врачу?', 'Как отменить или перенести талон?', 'Что взять с собой на приём?', 'График работы'];

// ---------- адрес страницы: виджет подключён вне роутера, поэтому следим за историей браузера сами ----------
const NAVIGATE_EVENT = 'talon:navigate';
let historyPatched = false;
function patchHistory() {
  if (historyPatched) return;
  historyPatched = true;
  ['pushState', 'replaceState'].forEach((method) => {
    const original = window.history[method];
    window.history[method] = function patched(...args) {
      const result = original.apply(this, args);
      window.dispatchEvent(new Event(NAVIGATE_EVENT));
      return result;
    };
  });
}
function subscribePath(callback) {
  patchHistory();
  window.addEventListener('popstate', callback);
  window.addEventListener(NAVIGATE_EVENT, callback);
  return () => {
    window.removeEventListener('popstate', callback);
    window.removeEventListener(NAVIGATE_EVENT, callback);
  };
}
const getPath = () => window.location.pathname;

// переход по ссылке без перезагрузки страницы (роутер слушает popstate)
function goTo(event, to) {
  if (event.metaKey || event.ctrlKey || event.shiftKey || event.button !== 0) return;
  event.preventDefault();
  window.history.pushState({}, '', to);
  window.dispatchEvent(new PopStateEvent('popstate'));
}

// ---------- сохранение диалога на время сессии ----------
function loadMessages() {
  try {
    const saved = JSON.parse(sessionStorage.getItem(STORAGE_KEY) ?? '[]');
    return Array.isArray(saved) ? saved.filter((m) => m && typeof m.content === 'string') : [];
  } catch {
    return [];
  }
}
function saveMessages(messages) {
  try {
    sessionStorage.setItem(STORAGE_KEY, JSON.stringify(messages.slice(-40)));
  } catch { /* без sessionStorage диалог живёт до перезагрузки страницы */ }
}

let seq = 0;
const nextId = () => `m${Date.now()}-${++seq}`;

function Message({ message }) {
  if (message.role === 'system') {
    return (
      <li className="as-msg as-system">
        {message.kind === 'down' ? (
          <>Помощник сейчас недоступен. Загляните в раздел <a href="/contacts" onClick={(event) => goTo(event, '/contacts')}>«Контакты и FAQ»</a>.</>
        ) : message.content}
      </li>
    );
  }
  return (
    <li className={`as-msg ${message.role === 'user' ? 'as-user' : 'as-bot'}`}>
      <span className="as-text">{message.content}</span>
      {message.role === 'assistant' && message.source === 'static' && <small className="as-source">Справочный ответ</small>}
    </li>
  );
}

export default function ChatWidget() {
  const path = useSyncExternalStore(subscribePath, getPath);
  const [open, setOpen] = useState(false);
  const [messages, setMessages] = useState(loadMessages);
  const [text, setText] = useState('');
  const [pending, setPending] = useState(false);
  const fabRef = useRef(null);
  const inputRef = useRef(null);
  const listRef = useRef(null);
  const abortRef = useRef(null);
  const busyRef = useRef(false);

  const hidden = path === '/doctor' || path.startsWith('/doctor/'); // в кабинете врача помощник пациентов не нужен

  // диалог сохраняется на время сессии
  useEffect(() => { saveMessages(messages); }, [messages]);

  // пока чат открыт, кнопка «Наверх» уходит из угла, чтобы не перекрывать окно
  useEffect(() => {
    document.body.classList.toggle('assistant-open', open && !hidden);
    return () => document.body.classList.remove('assistant-open');
  }, [open, hidden]);

  // при открытии фокус в поле ввода
  useEffect(() => {
    if (open) inputRef.current?.focus();
  }, [open]);

  // новые сообщения прокручивают список вниз
  useEffect(() => {
    const list = listRef.current;
    if (list) list.scrollTop = list.scrollHeight;
  }, [messages, pending, open]);

  // поле ввода растёт до трёх строк
  useEffect(() => {
    const field = inputRef.current;
    if (!field) return;
    field.style.height = 'auto';
    field.style.height = `${Math.min(field.scrollHeight, parseFloat(getComputedStyle(field).maxHeight) || 78)}px`;
  }, [text, open]);

  // уход со страницы отменяет запрос, который ещё идёт
  useEffect(() => () => abortRef.current?.abort(), []);

  const close = useCallback(() => {
    setOpen(false);
    fabRef.current?.focus();
  }, []);

  const send = useCallback(async (raw) => {
    const question = raw.trim();
    if (!question || question.length > MAX_QUESTION || busyRef.current) return;
    busyRef.current = true;

    const history = messages
      .filter((m) => m.role === 'user' || m.role === 'assistant')
      .slice(-MAX_HISTORY)
      .map(({ role, content }) => ({ role, content }));

    setMessages((list) => [...list, { id: nextId(), role: 'user', content: question }]);
    setText('');
    setPending(true);
    const controller = new AbortController();
    abortRef.current = controller;

    try {
      const data = await askAssistant(question, history, controller.signal);
      setMessages((list) => [...list, { id: nextId(), role: 'assistant', content: data.answer, source: data.source }]);
    } catch (error) {
      if (isCanceled(error)) return;
      const status = getStatus(error);
      if (status === 429) {
        setMessages((list) => [...list, { id: nextId(), role: 'system', kind: 'limit', content: 'Слишком много вопросов, подождите немного' }]);
      } else if (error?.response || getErrorMessage(error)) {
        setMessages((list) => [...list, { id: nextId(), role: 'system', kind: 'down' }]);
      }
      // нет связи с сервером: в чат ничего не пишем, об этом сообщает окно «Нет связи с сервером»
    } finally {
      busyRef.current = false;
      setPending(false);
      inputRef.current?.focus();
    }
  }, [messages]);

  function clearDialog() {
    abortRef.current?.abort();
    busyRef.current = false;
    setPending(false);
    setMessages([]);
    setText('');
    inputRef.current?.focus();
  }

  function onKeyDown(event) {
    if (event.key === 'Enter' && !event.shiftKey && !event.nativeEvent.isComposing) {
      event.preventDefault();
      send(text);
    }
  }

  if (hidden) return null;

  if (!open) {
    return (
      <button ref={fabRef} type="button" className="btn btn-primary as-fab" onClick={() => setOpen(true)} aria-label="Открыть помощника" aria-haspopup="dialog">
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
          <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" />
        </svg>
        <span>Помощник</span>
      </button>
    );
  }

  const left = MAX_QUESTION - text.length;
  const empty = messages.length === 0;

  return (
    <section className="as-panel" role="dialog" aria-label="Помощник «Твой талон»" onKeyDown={(event) => { if (event.key === 'Escape') close(); }}>
      <header className="as-head">
        <strong>Помощник «Твой талон»</strong>
        <div className="as-head-actions">
          <button type="button" className="btn btn-ghost btn-icon" onClick={clearDialog} disabled={empty && !pending} aria-label="Очистить диалог" title="Очистить диалог"><Icon name="trash" size={17} /></button>
          <button type="button" className="btn btn-ghost btn-icon" onClick={close} aria-label="Свернуть" title="Свернуть"><Icon name="chevronDown" size={18} /></button>
        </div>
      </header>

      <p className="as-hint">Подскажу, как записаться на приём и пользоваться сайтом. Медицинских советов не даю.</p>

      <ul ref={listRef} className="as-list" role="log" aria-live="polite" aria-relevant="additions" aria-label="Диалог с помощником">
        {empty && (
          <li className="as-quick">
            {QUICK.map((question) => (
              <button key={question} type="button" className="as-chip" onClick={() => send(question)} disabled={pending}>{question}</button>
            ))}
          </li>
        )}
        {messages.map((message) => <Message key={message.id ?? message.content} message={message} />)}
        {pending && <li className="as-msg as-bot as-typing" aria-label="Помощник печатает">Печатает<span className="as-dots" aria-hidden="true"><i /><i /><i /></span></li>}
      </ul>

      <form className="as-form" onSubmit={(event) => { event.preventDefault(); send(text); }}>
        <div className="as-field">
          <textarea
            ref={inputRef}
            rows={1}
            value={text}
            maxLength={MAX_QUESTION}
            placeholder="Напишите вопрос"
            aria-label="Ваш вопрос"
            onChange={(event) => setText(event.target.value)}
            onKeyDown={onKeyDown}
          />
          <small className={`as-count ${left <= 50 ? 'is-low' : ''}`} aria-hidden="true">{text.length} / {MAX_QUESTION}</small>
        </div>
        <button type="submit" className="btn btn-primary as-send" disabled={pending || !text.trim()}>Отправить</button>
      </form>
    </section>
  );
}
