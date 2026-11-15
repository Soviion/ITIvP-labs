import { Fragment, useEffect, useId, useRef, useState } from 'react';
import Banner from '../../ui/Banner';
import Button from '../../ui/Button';
import Modal from '../../ui/Modal';
import Spinner from '../../ui/Spinner';
import useConversation, { messageStatus } from './useConversation';
import '../../questions.css';

const MAX_LENGTH = 2000;
const PEER = { patient: 'Врач', doctor: 'Пациент' };
const TO = { patient: 'врачу', doctor: 'пациенту' };

const clock = (iso) => new Date(iso).toLocaleTimeString('ru-RU', { hour: '2-digit', minute: '2-digit' });
const day = (iso) => new Date(iso).toLocaleDateString('ru-RU');

function statusText(message, status, side) {
  switch (status) {
    case 'sending': return 'Отправляется…';
    case 'failed': return message.error ? `Не отправлено: ${message.error}` : 'Не отправлено';
    case 'queued': return `Принято. Будет доставлено, когда ${PEER[side].toLowerCase()} появится в сети`;
    case 'read': return 'Прочитано';
    default: return 'Доставлено';
  }
}

function Presence({ presence, side, connected }) {
  // пока нет связи с сервером, статус собеседника неизвестен: прежнее «в сети» было бы неправдой
  if (!connected) return <span className="qa-presence" role="status"><span className="qa-dot" aria-hidden="true" />Нет связи с сервером</span>;
  if (!presence.known) return <span className="qa-presence" role="status"><span className="qa-dot" aria-hidden="true" />Проверяем связь…</span>;
  return (
    <span className={`qa-presence ${presence.present ? 'is-online' : ''}`} role="status">
      <span className="qa-dot" aria-hidden="true" />
      {PEER[side]} {presence.present ? 'в сети' : 'не в сети'}
      {presence.present && presence.peerInChat ? ' · сейчас в этой беседе' : ''}
    </span>
  );
}

// Окно беседы «пациент — врач». Одно и то же окно для обеих сторон (side = patient | doctor).
// Сообщение всегда сохраняется на сервере; если собеседника нет в сети, оно ждёт его там, а здесь подписано «будет доставлено».
export default function QuestionWindow({ conversation: initial, side, onClose }) {
  const chat = useConversation({ conversationId: initial.id, side });
  const brief = chat.conversation ?? initial;
  const [text, setText] = useState('');
  const bodyRef = useRef(null);
  const inputRef = useRef(null);
  const nearBottom = useRef(true);
  const inputId = useId();

  // к новым сообщениям прокручиваем, только если читатель и так внизу (или сам только что написал)
  useEffect(() => {
    const body = bodyRef.current;
    if (body && nearBottom.current) body.scrollTop = body.scrollHeight;
  }, [chat.messages, chat.load]);

  useEffect(() => { inputRef.current?.focus(); }, []);

  const onScroll = () => {
    const body = bodyRef.current;
    nearBottom.current = body.scrollHeight - body.scrollTop - body.clientHeight < 80;
  };

  function submit(event) {
    event?.preventDefault();
    const value = text.trim();
    if (!value) return;
    setText('');
    nearBottom.current = true;
    inputRef.current?.focus();
    chat.send(value);
  }

  const onKeyDown = (event) => {
    if (event.key === 'Enter' && !event.shiftKey && !event.nativeEvent.isComposing) {
      event.preventDefault();
      submit();
    }
  };

  let lastDay = '';

  return (
    <Modal
      open
      onClose={onClose}
      variant="drawer"
      bare
      title={brief.counterpart.name}
      subtitle={<>{brief.counterpart.subtitle} · <Presence presence={chat.presence} side={side} connected={chat.phase === 'online'} /></>}
    >
      <div className="modal-body qa-body" ref={bodyRef} onScroll={onScroll}>
        {chat.phase !== 'online' && (
          <Banner kind="warn" title="Нет соединения с сервером">
            Пока связи нет, сообщения не отправятся: они будут помечены «не отправлено», и их можно повторить позже.
          </Banner>
        )}
        {chat.phase === 'online' && chat.presence.known && !chat.presence.present && (
          <p className="qa-hint">
            {side === 'patient'
              ? 'Врач сейчас не в сети. Вопрос будет доставлен, когда он появится, а ответ придёт сюда и загорится красным кружком у «Мои вопросы».'
              : 'Пациент сейчас не в сети. Ваш ответ дождётся его на сервере и будет доставлен, когда он вернётся.'}
          </p>
        )}

        {chat.load === 'loading' && <div className="state-loading"><Spinner size={18} />Загружаем переписку…</div>}
        {chat.load === 'error' && (
          <Banner kind="error" title="Не удалось загрузить переписку" action={<Button size="sm" icon="refresh" onClick={chat.reload}>Повторить</Button>}>
            {chat.error || 'Нет связи с сервером.'}
          </Banner>
        )}
        {chat.load === 'ready' && chat.hasMore && (
          <Button size="sm" loading={chat.loadingOlder} onClick={chat.loadOlder}>Показать более ранние сообщения</Button>
        )}
        {chat.load === 'ready' && chat.messages.length === 0 && (
          <p className="qa-empty">
            {side === 'patient' ? 'Опишите, что вас беспокоит, — врач ответит здесь. Не указывайте пароли и данные банковских карт.' : 'Сообщений пока нет.'}
          </p>
        )}

        <div role="log" aria-live="polite" aria-relevant="additions" aria-label="Переписка">
          <ol className="qa-list">
            {chat.messages.map((message) => {
              const own = message.from === side;
              const status = messageStatus(message, chat.peerReadSeq);
              const date = day(message.createdAt);
              const newDay = date !== lastDay;
              lastDay = date;
              return (
                <Fragment key={message.clientMsgId}>
                  {newDay && <li className="qa-day">{date}</li>}
                  <li className={`qa-msg ${own ? 'qa-msg-own' : 'qa-msg-peer'}`}>
                    <p className="qa-bubble"><span className="sr-only">{own ? 'Вы: ' : `${PEER[side]}: `}</span>{message.text}</p>
                    <span className="qa-meta">
                      <time dateTime={message.createdAt}>{clock(message.createdAt)}</time>
                      {own && <> · <span className={`qa-status qa-status-${status}`}>{statusText(message, status, side)}</span></>}
                      {status === 'failed' && (
                        <>
                          {' '}<button type="button" className="qa-link" onClick={() => chat.send(message.text, message)}>Повторить</button>
                          {' '}<button type="button" className="qa-link" onClick={() => chat.discard(message.clientMsgId)}>Удалить</button>
                        </>
                      )}
                    </span>
                  </li>
                </Fragment>
              );
            })}
          </ol>
        </div>
      </div>

      {/* вне прокручиваемой области: напоминание должно быть на виду всегда */}
      <p className="qa-note">Это не экстренная связь. При угрозе жизни звоните <b>103</b>.</p>

      <form className="modal-footer qa-composer" onSubmit={submit}>
        <div className="qa-input">
          <label htmlFor={inputId} className="sr-only">Сообщение {TO[side]}</label>
          <textarea
            id={inputId}
            ref={inputRef}
            rows={2}
            maxLength={MAX_LENGTH}
            value={text}
            onChange={(event) => setText(event.target.value)}
            onKeyDown={onKeyDown}
            placeholder="Напишите сообщение. Enter — отправить, Shift+Enter — новая строка"
          />
          {text.length > MAX_LENGTH - 200 && <span className="qa-count" aria-live="polite">{text.length}/{MAX_LENGTH}</span>}
        </div>
        <Button type="submit" variant="primary" icon="send" disabled={!text.trim()}>Отправить</Button>
      </form>
    </Modal>
  );
}
