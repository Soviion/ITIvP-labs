import { useCallback, useEffect, useId, useRef, useState } from 'react';
import { useRealtime, useSocketEvent } from '../realtime/hooks';
import './mood.css';

// Опрос «Как ваше настроение сегодня?» в правой панели. Работает по сокету (события mood:*):
// голос одного человека сразу меняет цифры у всех, у кого открыт сайт. Гости видят результаты, голосуют вошедшие, раз в сутки.

const MOODS = [
  { key: 'happy', label: 'Хорошее' },
  { key: 'neutral', label: 'Обычное' },
  { key: 'sad', label: 'Грустное' },
];
const ZERO = { happy: 0, neutral: 0, sad: 0 };

// Смайлы нарисованы сами: стандартные эмодзи на разных системах выглядят по-разному
const MOUTH = { happy: 'M12.5 24 Q20 31.5 27.5 24', neutral: 'M13.5 26.5 H26.5', sad: 'M12.5 29 Q20 22 27.5 29' };

function Face({ mood }) {
  return (
    <svg className="mood-face" viewBox="0 0 40 40" aria-hidden="true" focusable="false">
      <circle className="mood-face-bg" cx="20" cy="20" r="17.5" />
      {mood === 'sad' && <path className="mood-face-line" d="M10.5 14.5 L16 12.5 M29.5 14.5 L24 12.5" />}
      <circle className="mood-face-eye" cx="14.5" cy="18" r="2.1" />
      <circle className="mood-face-eye" cx="25.5" cy="18" r="2.1" />
      <path className="mood-face-line" d={MOUTH[mood]} />
    </svg>
  );
}

// Проценты так, чтобы в сумме всегда выходило 100 (метод наибольшего остатка)
function percents(counts, total) {
  if (!total) return { ...ZERO };
  const parts = MOODS.map(({ key }) => {
    const exact = (counts[key] * 100) / total;
    return { key, value: Math.floor(exact), rest: exact - Math.floor(exact) };
  });
  let left = 100 - parts.reduce((sum, part) => sum + part.value, 0);
  [...parts].sort((a, b) => b.rest - a.rest).forEach((part) => {
    if (left > 0) { part.value += 1; left -= 1; }
  });
  return Object.fromEntries(parts.map((part) => [part.key, part.value]));
}

// «проголосовал 1 человек», «проголосовали 2 человека», «проголосовали 5 человек», «проголосовал 21 человек»
function votersText(n) {
  const last = n % 10;
  const tens = n % 100;
  const one = last === 1 && tens !== 11;
  const few = last >= 2 && last <= 4 && (tens < 12 || tens > 14);
  return `${one ? 'проголосовал' : 'проголосовали'} ${n} ${few ? 'человека' : 'человек'}`;
}

const pick = (result) => ({ status: 'ready', total: result.total, counts: result.counts ?? ZERO, myVote: result.myVote ?? null, canVote: Boolean(result.canVote) });

export default function MoodPoll() {
  const { phase, request } = useRealtime();
  const [state, setState] = useState({ status: 'loading', total: 0, counts: ZERO, myVote: null, canVote: false });
  const [pending, setPending] = useState(null); // настроение, голос за которое сейчас отправляется
  const [note, setNote] = useState('');
  const [nudge, setNudge] = useState(0); // растёт, когда гость нажал на смайл: подсказка «войдите» на секунду подсвечивается
  const hintId = useId();
  const sequence = useRef(0);

  // Запрос текущих результатов. Устаревший ответ (пришёл позже нового) отбрасывается
  const load = useCallback(async () => {
    const mine = ++sequence.current;
    try {
      const result = await request('mood:get', {});
      if (mine === sequence.current) setState(pick(result));
    } catch {
      if (mine === sequence.current) setState((prev) => (prev.status === 'ready' ? prev : { ...prev, status: 'unavailable' }));
    }
  }, [request]);

  // Первая загрузка и каждое переподключение (пропущенные голоса подтянутся)
  useEffect(() => {
    if (phase !== 'online') return undefined;
    let cancelled = false;
    request('mood:get', {})
      .then((result) => { if (!cancelled) setState(pick(result)); })
      .catch(() => { if (!cancelled) setState((prev) => (prev.status === 'ready' ? prev : { ...prev, status: 'unavailable' })); });
    return () => { cancelled = true; };
  }, [phase, request]);

  // Кто-то проголосовал: обновляем цифры, свой выбор и право голоса остаются прежними
  useSocketEvent('mood:updated', ({ total, counts }) => {
    setState((prev) => (prev.status === 'ready' ? { ...prev, total, counts } : prev));
  });
  // Наступили новые сутки: опрос начинается заново
  useSocketEvent('mood:day', () => { setNote(''); load(); });

  async function vote(mood) {
    if (state.status !== 'ready' || pending || state.myVote) return;
    if (!state.canVote) { // гость: голосовать нельзя, подсказываем вход
      setNote('');
      setNudge((value) => value + 1);
      return;
    }
    setPending(mood);
    setNote('');
    try {
      setState(pick(await request('mood:vote', { mood })));
    } catch (error) {
      if (error.code === 409) await load(); // уже голосовал (например, в другой вкладке): покажем итог
      else if (error.code === 401) { setState((prev) => ({ ...prev, canVote: false })); setNudge((value) => value + 1); }
      else if (error.code === 503) setState((prev) => ({ ...prev, status: 'unavailable' }));
      else setNote(error.message);
    } finally {
      setPending(null);
    }
  }

  const { total, counts, myVote, canVote } = state;
  // нет связи с сервером, а результатов ещё не было: опрос недоступен (если результаты уже есть, показываем их)
  const offline = phase === 'offline' || phase === 'unauthorized';
  const status = state.status !== 'ready' && (state.status === 'unavailable' || offline) ? 'unavailable' : state.status;

  if (status === 'unavailable') {
    return (
      <section className="card side-card mood" aria-label="Опрос настроения">
        <h2 className="mood-title">Как ваше настроение сегодня?</h2>
        <p className="mood-off">
          Опрос временно недоступен.{' '}
          <button type="button" className="mood-retry" onClick={() => { setState((prev) => ({ ...prev, status: 'loading' })); load(); }}>Повторить</button>
        </p>
      </section>
    );
  }

  const ready = status === 'ready';
  const showStats = ready && total > 0 && (Boolean(myVote) || !canVote); // вошедший видит итог после своего голоса, гость сразу (если голоса есть)
  const share = percents(counts, total);

  return (
    <section className="card side-card mood" aria-label="Опрос настроения" aria-busy={!ready}>
      <h2 className="mood-title">Как ваше настроение сегодня?</h2>

      <ul className="mood-row">
        {MOODS.map(({ key, label }) => {
          const chosen = myVote === key;
          const label2 = showStats ? `${label}: ${counts[key]} (${share[key]}%)` : label;
          return (
            <li key={key} className={`mood-${key}`}>
              <button
                type="button"
                className={`mood-btn ${chosen ? 'is-chosen' : ''} ${pending === key ? 'is-pending' : ''}`}
                aria-pressed={chosen}
                aria-label={label2}
                aria-describedby={ready && !canVote && !myVote ? hintId : undefined}
                disabled={!ready || Boolean(myVote) || Boolean(pending)}
                onClick={() => vote(key)}
                title={label}
              >
                <Face mood={key} />
                <span className="mood-label">{label}</span>
              </button>
              {showStats && (
                <div className="mood-stat" aria-hidden="true">
                  <div className="mood-bar"><span style={{ '--w': `${share[key]}%` }} /></div>
                  <span className="mood-pct"><b>{share[key]}%</b> · {counts[key]}</span>
                </div>
              )}
            </li>
          );
        })}
      </ul>

      {note && <p className="mood-note" role="alert">{note}</p>}

      {ready && (
        <div className="mood-foot">
          <p className="mood-total" role="status">
            {total > 0 ? <>Сегодня <strong>{votersText(total)}</strong></> : 'Сегодня пока никто не проголосовал'}
          </p>
          {!canVote && !myVote && (
            <p id={hintId} key={nudge} className={`mood-hint ${nudge ? 'is-nudged' : ''}`}>Войдите, чтобы проголосовать</p>
          )}
          {myVote && <p className="mood-thanks">Ваш голос учтён. Статистика анонимная</p>}
        </div>
      )}
    </section>
  );
}
