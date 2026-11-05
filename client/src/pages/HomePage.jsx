import { useMemo, useState } from 'react';
import { Link, Navigate, useLocation, useNavigate } from 'react-router-dom';
import { bookAppointment, getErrorMessage, getStatus } from '../api';
import { useAuth } from '../auth/context';
import BookingPanel from '../components/BookingPanel';
import HonorBoard from '../components/HonorBoard';
import LoginPanel from '../components/LoginPanel';
import TicketCard from '../components/TicketCard';
import useDoctors from '../hooks/useDoctors';
import useMyAppointments from '../hooks/useMyAppointments';
import { doctorTitle } from '../data/doctorProfiles';
import { shortName } from '../utils/appointments';
import { formatDayHeading } from '../utils/dates';
import { clearPendingSlot, readPendingSlot, savePendingSlot } from '../utils/pendingSlot';
import { MAX_ACTIVE_TICKETS, byTimeAsc, isActiveTicket } from '../utils/tickets';
import Banner from '../ui/Banner';
import Button from '../ui/Button';
import Field from '../ui/Field';
import Icon from '../ui/Icon';
import Modal from '../ui/Modal';
import Spinner from '../ui/Spinner';
import { useToast } from '../ui/toastContext';

// Справа для вошедшего пациента: ближайшая запись
function NextTicket({ mine }) {
  const { items, status, error } = mine;
  const next = useMemo(() => items.filter(isActiveTicket).sort(byTimeAsc)[0], [items]);
  return (
    <section className="card side-card">
      <header>
        <h2>Ближайшая запись</h2>
        <Link to="/cabinet/tickets">Все талоны</Link>
      </header>
      {(status === 'loading' || (status === 'error' && !error)) && <div className="state-loading"><Spinner size={18} />Загружаем…</div>}
      {status === 'error' && error && <p className="muted">Не удалось загрузить записи.</p>}
      {status === 'ready' && !next && (
        <div className="side-empty">
          <Icon name="calendar" size={22} />
          <p>Нет ближайших записей</p>
        </div>
      )}
      {status === 'ready' && next && <ul className="side-ticket"><TicketCard item={next} /></ul>}
    </section>
  );
}

function StaffCard() {
  return (
    <section className="card side-card">
      <header><h2>Вы вошли как сотрудник</h2></header>
      <p className="muted">Записи пациентов, создание и изменение талонов ведутся в регистратуре.</p>
      <Link to="/staff" className="btn btn-primary btn-block"><Icon name="list" size={16} />Открыть регистратуру</Link>
    </section>
  );
}

export default function HomePage() {
  const { status, user, isStaff } = useAuth();
  const location = useLocation();
  const navigate = useNavigate();
  const toast = useToast();

  // роль приходит вместе с профилем: пока её нет, режим «loading» (и лишних запросов кабинета не делаем)
  const mode = status !== 'authed' ? 'guest' : !user.role ? 'loading' : isStaff ? 'staff' : 'patient';
  const doctors = useDoctors();
  const mine = useMyAppointments({ enabled: mode === 'patient' });
  const activeCount = mine.items.filter(isActiveTicket).length;
  const [pending] = useState(readPendingSlot); // талон, выбранный до регистрации или входа
  const [confirm, setConfirm] = useState(null); // { selection, doctor }
  const [reason, setReason] = useState('');
  const [booking, setBooking] = useState(false);
  const [bookingError, setBookingError] = useState('');
  const [refreshKey, setRefreshKey] = useState(0);

  // после входа возвращаем на страницу, которую пациент пытался открыть
  if (status === 'authed' && location.state?.from) return <Navigate to={location.state.from} replace />;

  function handleSubmit(selection, doctor) {
    if (mode === 'guest') {
      // без аккаунта талон не закрепить: запоминаем выбор и ведём на регистрацию
      savePendingSlot(selection);
      navigate('/register');
      return;
    }
    if (mine.status === 'ready' && activeCount >= MAX_ACTIVE_TICKETS) {
      toast.error(`Можно иметь не больше ${MAX_ACTIVE_TICKETS} активных записей. Отмените одну из них`, { title: 'Достигнут лимит' });
      return;
    }
    setReason('');
    setBookingError('');
    setConfirm({ selection, doctor });
  }

  async function confirmBooking() {
    setBooking(true);
    setBookingError('');
    try {
      await bookAppointment({ ...confirm.selection, reason });
      clearPendingSlot();
      setConfirm(null);
      toast.success('Вы записаны на приём');
      navigate('/cabinet/tickets');
    } catch (error) {
      setBookingError(getErrorMessage(error));
      if (getStatus(error) === 409 || getStatus(error) === 400) setRefreshKey((k) => k + 1); // обновим список талонов
      setBooking(false);
    }
  }

  return (
    <>
      <title>Запись на приём — Твой талон</title>
      <div className="page-head">
        <div>
          <h1>Запись на приём</h1>
          <p>Свободные талоны к врачам на ближайшие две недели</p>
        </div>
      </div>

      {mode === 'patient' && pending?.fromGuest && (
        <Banner kind="info" title="Талон выбран до входа">Проверьте врача, дату и время и нажмите «Записаться».</Banner>
      )}

      <div className="home">
        <BookingPanel doctors={doctors} initial={pending} mode={mode} onSubmit={handleSubmit} refreshKey={refreshKey} />
        <aside className="side">
          {mode === 'guest' && <LoginPanel registeredEmail={location.state?.registered} />}
          {mode === 'patient' && <NextTicket mine={mine} />}
          {mode === 'staff' && <StaffCard />}
          {mode === 'loading' && <section className="card side-card"><div className="state-loading"><Spinner size={18} />Загружаем профиль…</div></section>}
          <HonorBoard doctors={doctors} />
        </aside>
      </div>

      <Modal
        open={Boolean(confirm)}
        onClose={() => !booking && setConfirm(null)}
        title="Подтвердите запись"
        size="sm"
        footer={(
          <>
            <Button onClick={() => setConfirm(null)} disabled={booking}>Отмена</Button>
            <Button variant="primary" loading={booking} onClick={confirmBooking}>Записаться</Button>
          </>
        )}
      >
        {confirm && (
          <div className="stack">
            <dl className="info-list">
              <div><dt>Врач</dt><dd>{shortName(confirm.doctor)}, {doctorTitle(confirm.doctor)}</dd></div>
              <div><dt>Дата</dt><dd>{formatDayHeading(confirm.selection.date).text}</dd></div>
              <div><dt>Время</dt><dd>{confirm.selection.time}</dd></div>
            </dl>
            {bookingError && <Banner kind="error">{bookingError}</Banner>}
            <Field label="Причина обращения" optional hint={`${reason.length} / 1000`}>
              {(props) => <textarea {...props} rows={3} maxLength={1000} value={reason} onChange={(event) => setReason(event.target.value)} placeholder="Жалобы, цель визита" />}
            </Field>
          </div>
        )}
      </Modal>
    </>
  );
}
