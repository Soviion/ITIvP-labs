import { useEffect, useRef, useState } from 'react';
import { getErrorMessage, isCanceled } from '../../api';
import { fetchConversations } from '../../questionsApi';
import { useLiveRefresh } from '../../realtime/hooks';
import Banner from '../../ui/Banner';
import Button from '../../ui/Button';
import Icon from '../../ui/Icon';
import Spinner from '../../ui/Spinner';
import ConversationList from './ConversationList';
import QuestionWindow from './QuestionWindow';
import '../../questions.css';

// Страница «Вопросы» для обеих сторон: у пациента — «Мои вопросы», у врача — «Вопросы пациентов».
// Список обновляется сам: счётчики меняются на каждое сообщение и на каждое «прочитано» (сигнал unread:changed)
export default function QuestionsPage({ side, title, siteName, lead, emptyText, emptyAction }) {
  const [state, setState] = useState({ phase: 'loading', items: [], error: '' });
  const [selected, setSelected] = useState(null);
  const [attempt, setAttempt] = useState(0);
  const seq = useRef(0); // «старый» ответ, пришедший позже нового, отбрасывается

  useEffect(() => {
    const controller = new AbortController();
    seq.current += 1;
    fetchConversations(controller.signal)
      .then((items) => setState({ phase: 'ready', items, error: '' }))
      .catch((error) => {
        if (!isCanceled(error)) setState((prev) => ({ ...prev, phase: 'error', error: getErrorMessage(error) }));
      });
    return () => controller.abort();
  }, [attempt]);

  const refresh = () => {
    seq.current += 1;
    const mine = seq.current;
    fetchConversations()
      .then((items) => { if (mine === seq.current) setState({ phase: 'ready', items, error: '' }); })
      .catch(() => { /* прежний список остаётся */ });
  };
  useLiveRefresh('unread:changed', refresh);

  const retry = () => {
    setState((prev) => ({ ...prev, phase: 'loading', error: '' }));
    setAttempt((n) => n + 1);
  };

  const close = () => {
    setSelected(null);
    refresh(); // кружки и последнее сообщение обновятся сразу после закрытия окна
  };

  return (
    <>
      <title>{`${title} — ${siteName}`}</title>
      <div className="page-head">
        <div>
          <h1>{title}</h1>
          <p>{lead}</p>
        </div>
      </div>

      <section className="card qa-card" aria-label={title}>
        {state.phase === 'loading' && <div className="state"><div className="state-loading"><Spinner size={22} /><span>Загружаем беседы…</span></div></div>}
        {state.phase === 'error' && (
          <div className="state">
            <Banner kind="error" title="Не удалось загрузить беседы" action={<Button size="sm" icon="refresh" onClick={retry}>Повторить</Button>}>
              {state.error || 'Нет связи с сервером.'}
            </Banner>
          </div>
        )}
        {state.phase === 'ready' && state.items.length === 0 && (
          <div className="state state-center">
            <span className="state-icon"><Icon name="message" size={26} /></span>
            <h3>Пока нет ни одной беседы</h3>
            <p>{emptyText}</p>
            {emptyAction}
          </div>
        )}
        {state.phase === 'ready' && state.items.length > 0 && <ConversationList items={state.items} onOpen={setSelected} />}
      </section>

      {selected && <QuestionWindow key={selected.id} conversation={selected} side={side} onClose={close} />}
    </>
  );
}
