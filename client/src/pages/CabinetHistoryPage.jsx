import { useCallback, useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { getErrorMessage, isCanceled } from '../api';
import { fmtDateTime } from '../components/doctor/format';
import { fetchHistory } from '../historyApi';
import '../history.css';
import Banner from '../ui/Banner';
import Button from '../ui/Button';
import Icon from '../ui/Icon';
import Spinner from '../ui/Spinner';

// «Моя история болезни»: список приёмов, которые оформил врач. Клик по строке открывает документ приёма
export default function CabinetHistoryPage() {
  const navigate = useNavigate();
  const [state, setState] = useState({ phase: 'loading', data: [], mongoAvailable: true, error: '' });

  const load = useCallback((signal) => fetchHistory(signal)
    .then((result) => setState({ phase: 'ready', data: result.data ?? [], mongoAvailable: result.mongoAvailable !== false, error: '' }))
    .catch((error) => {
      if (isCanceled(error)) return;
      setState({ phase: 'error', data: [], mongoAvailable: true, error: getErrorMessage(error) });
    }), []);

  useEffect(() => {
    const controller = new AbortController();
    load(controller.signal);
    return () => controller.abort();
  }, [load]);

  function retry() {
    setState((prev) => ({ ...prev, phase: 'loading' }));
    load();
  }

  const { phase, data, mongoAvailable, error } = state;

  return (
    <>
      <title>История болезни — Твой талон</title>
      <div className="page-head">
        <div>
          <h1>История болезни</h1>
          <p>Ваши приёмы у врачей: заключения, назначения и выданные направления</p>
        </div>
      </div>

      {phase === 'loading' && (
        <section className="card"><div className="state" role="status"><div className="state-loading"><Spinner size={22} /><span>Загружаем историю приёмов…</span></div></div></section>
      )}

      {phase === 'error' && (
        <Banner kind="error" title="Не удалось загрузить историю" action={<Button size="sm" onClick={retry}>Повторить</Button>}>{error}</Banner>
      )}

      {phase === 'ready' && !mongoAvailable && (
        <Banner kind="warn" title="История приёмов временно недоступна" action={<Button size="sm" onClick={retry}>Повторить</Button>}>
          Попробуйте открыть этот раздел чуть позже.
        </Banner>
      )}

      {phase === 'ready' && mongoAvailable && data.length === 0 && (
        <section className="card">
          <div className="state state-center">
            <span className="state-icon"><Icon name="list" size={26} /></span>
            <h3>Пока нет оформленных приёмов</h3>
            <p>После визита к врачу здесь появится документ с заключением, назначениями и направлениями.</p>
            <Link to="/" className="btn btn-primary">Записаться на приём</Link>
          </div>
        </section>
      )}

      {phase === 'ready' && mongoAvailable && data.length > 0 && (
        <section className="card history-list">
          <table className="history-table" aria-label="История приёмов">
            <thead>
              <tr>
                <th scope="col">Дата и время</th>
                <th scope="col">Врач</th>
                <th scope="col">Диагноз</th>
                <th scope="col">Направления</th>
                <th scope="col"><span className="history-sr">Открыть</span></th>
              </tr>
            </thead>
            <tbody>
              {data.map((item) => (
                <tr key={item.id} onClick={() => navigate(`/cabinet/history/${item.id}`)}>
                  <td>
                    <div className="history-date">
                      <Link to={`/cabinet/history/${item.id}`} onClick={(event) => event.stopPropagation()}>{fmtDateTime(item.date)}</Link>
                    </div>
                  </td>
                  <td>
                    <strong>{item.doctor?.name}</strong>
                    <div className="history-sub">{item.doctor?.specialty}</div>
                  </td>
                  <td className="history-diagnosis">
                    <strong>{item.diagnosis}{item.icdCode ? ` (${item.icdCode})` : ''}</strong>
                    {item.complaints && <div className="history-sub">{item.complaints}</div>}
                  </td>
                  <td>{item.referralsCount ? <span className="chip chip-info chip-plain">Направлений: {item.referralsCount}</span> : <span className="history-sub">нет</span>}</td>
                  <td className="history-open"><Link to={`/cabinet/history/${item.id}`} className="btn btn-secondary btn-sm" onClick={(event) => event.stopPropagation()}>Открыть</Link></td>
                </tr>
              ))}
            </tbody>
          </table>
        </section>
      )}
    </>
  );
}
