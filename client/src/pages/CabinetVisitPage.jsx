import { useCallback, useEffect, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { getErrorMessage, getStatus, isCanceled } from '../api';
import { fmtDate } from '../components/doctor/format';
import { printSheet } from '../components/doctor/openPrint';
import ReferralSheet from '../components/doctor/ReferralSheet';
import VisitSheet from '../components/VisitSheet';
import { downloadMyReferralDocx, downloadVisitDocx, fetchVisit } from '../historyApi';
import '../history.css';
import Banner from '../ui/Banner';
import Button from '../ui/Button';
import Icon from '../ui/Icon';
import Spinner from '../ui/Spinner';
import { useToast } from '../ui/toastContext';

const URGENCY = { planned: 'плановое', urgent: 'срочное' };

function VisitView({ visitId }) {
  const toast = useToast();
  const [state, setState] = useState({ phase: 'loading', data: null, error: '' });
  const [selected, setSelected] = useState(null); // id открытого направления
  const [busy, setBusy] = useState('');

  const load = useCallback((signal) => fetchVisit(visitId, signal)
    .then((data) => setState({ phase: 'ready', data, error: '' }))
    .catch((error) => {
      if (isCanceled(error)) return;
      setState({ phase: getStatus(error) === 404 ? 'missing' : 'error', data: null, error: getErrorMessage(error) });
    }), [visitId]);

  useEffect(() => {
    const controller = new AbortController();
    load(controller.signal);
    return () => controller.abort();
  }, [load]);

  function retry() {
    setState({ phase: 'loading', data: null, error: '' });
    load();
  }

  async function download(kind, action) {
    setBusy(kind);
    try {
      await action();
    } catch (error) {
      toast.error(getErrorMessage(error), { title: 'Не удалось скачать документ' });
    } finally {
      setBusy('');
    }
  }

  const back = <Link to="/cabinet/history" className="btn btn-secondary btn-sm"><Icon name="arrowLeft" size={15} />Назад к истории</Link>;

  if (state.phase === 'loading') {
    return (
      <>
        <div className="visit-toolbar">{back}</div>
        <section className="card"><div className="state" role="status"><div className="state-loading"><Spinner size={22} /><span>Загружаем документ приёма…</span></div></div></section>
      </>
    );
  }

  if (state.phase !== 'ready') {
    const missing = state.phase === 'missing';
    return (
      <>
        <div className="visit-toolbar">{back}</div>
        <Banner
          kind={missing ? 'warn' : 'error'}
          title={missing ? 'Приём не найден' : 'Не удалось открыть приём'}
          action={missing ? undefined : <Button size="sm" onClick={retry}>Повторить</Button>}
        >
          {missing ? 'Возможно, ссылка устарела. Вернитесь к истории и откройте приём из списка.' : state.error}
        </Banner>
      </>
    );
  }

  const { visit, card } = state.data;
  const referrals = state.data.referrals ?? [];
  const current = referrals.find((item) => item.id === selected);

  return (
    <>
      <title>{`Приём от ${fmtDate(visit.date)} — Твой талон`}</title>
      <div className="page-head">
        <div>
          <h1>Приём от {fmtDate(visit.date)}</h1>
          <p>{[visit.doctor?.name, visit.doctor?.specialty].filter(Boolean).join(', ')}</p>
        </div>
      </div>

      <div className="visit-toolbar no-print">
        {back}
        <span className="spacer" />
        <Button icon="download" loading={busy === 'visit'} onClick={() => download('visit', () => downloadVisitDocx(visit.id))}>Скачать Word</Button>
        <Button icon="copy" onClick={() => printSheet(`visit-${visit.id}`)}>Печать</Button>
      </div>
      <div className="visit-paper"><VisitSheet visit={visit} card={card} /></div>

      {referrals.length > 0 && (
        <section className="visit-refs">
          <h2>Направления</h2>
          <div className="visit-ref-list no-print">
            {referrals.map((item) => (
              <button
                key={item.id}
                type="button"
                className={`visit-ref-item ${selected === item.id ? 'is-active' : ''}`}
                aria-pressed={selected === item.id}
                onClick={() => setSelected(selected === item.id ? null : item.id)}
              >
                <strong>№ {item.number} · {item.toSpecialty}</strong>
                <small>от {fmtDate(item.issuedAt)}, {URGENCY[item.urgency] ?? 'плановое'}</small>
              </button>
            ))}
          </div>

          {current && (
            <>
              <div className="visit-toolbar no-print">
                <span className="spacer" />
                <Button icon="download" loading={busy === current.id} onClick={() => download(current.id, () => downloadMyReferralDocx(visit.id, current.id))}>Скачать Word</Button>
                <Button icon="copy" onClick={() => printSheet(`referral-${current.id}`)}>Печать</Button>
              </div>
              <div className="visit-paper"><ReferralSheet card={card} referral={{ ...current, _id: current.id }} /></div>
            </>
          )}
        </section>
      )}
    </>
  );
}

// key по номеру приёма: при переходе к другому приёму состояние страницы начинается заново
export default function CabinetVisitPage() {
  const { visitId } = useParams();
  return <VisitView key={visitId} visitId={visitId} />;
}
