import { Fragment, useCallback, useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { getErrorMessage, isCanceled } from '../../api';
import { useAuth } from '../../auth/context';
import useDoctors from '../../hooks/useDoctors';
import { ageText, dotDate } from '../../components/doctor/format';
import { PatientMark, StatusTag } from '../../components/doctor/PatientBadge';
import { STATUSES } from '../../constants';
import { fetchDoctorAppointments } from '../../doctorApi';
import Banner from '../../ui/Banner';
import Button from '../../ui/Button';
import Icon from '../../ui/Icon';
import Spinner from '../../ui/Spinner';

const PERIODS = [
  { value: 'soon', label: 'Сегодня и завтра' },
  { value: 'today', label: 'Сегодня' },
  { value: 'upcoming', label: 'Предстоящие' },
  { value: 'past', label: 'Прошедшие' },
  { value: 'all', label: 'Все' },
];

// Главный экран врача: записи пациентов к нему. Администратор видит записи всех врачей и может выбрать одного
export default function DoctorAppointmentsPage() {
  const { isAdmin } = useAuth();
  const doctors = useDoctors();
  const [doctorId, setDoctorId] = useState('');
  const [period, setPeriod] = useState('soon');
  const [status, setStatus] = useState('all');
  const [query, setQuery] = useState('');
  const [state, setState] = useState({ phase: 'loading', data: [], today: '', tomorrow: '', mongoAvailable: true, error: '' });
  const [attempt, setAttempt] = useState(0);

  useEffect(() => {
    const controller = new AbortController();
    setState((prev) => ({ ...prev, phase: 'loading', error: '' }));
    fetchDoctorAppointments(period, controller.signal, isAdmin ? doctorId : '')
      .then((result) => setState({ phase: 'ready', data: result.data, today: result.today, tomorrow: result.tomorrow, mongoAvailable: result.mongoAvailable, error: '' }))
      .catch((error) => {
        if (isCanceled(error)) return;
        setState((prev) => ({ ...prev, phase: 'error', error: getErrorMessage(error) }));
      });
    return () => controller.abort();
  }, [period, attempt, isAdmin, doctorId]);

  const retry = useCallback(() => setAttempt((n) => n + 1), []);

  const visible = useMemo(() => {
    const needle = query.trim().toLowerCase();
    return state.data.filter((item) => (
      (status === 'all' || item.status === status)
      && (!needle || (item.patient?.fullName ?? '').toLowerCase().includes(needle))
    ));
  }, [state.data, status, query]);

  const filtered = Boolean(query.trim()) || status !== 'all';

  // «Сегодня и завтра»: записи идут двумя блоками, пустой день тоже показываем, чтобы было видно, что записей нет
  const groups = useMemo(() => {
    if (period !== 'soon') return null;
    return [
      { key: state.today, title: 'Сегодня' },
      { key: state.tomorrow, title: 'Завтра' },
    ].map((day) => ({ ...day, items: visible.filter((item) => item.date === day.key) }));
  }, [period, state.today, state.tomorrow, visible]);

  return (
    <>
      <title>{isAdmin ? 'Записи всех врачей' : 'Записи ко мне'} — Моя клиника</title>
      <div className="page-head">
        <div>
          <h1>{isAdmin ? 'Записи всех врачей' : 'Записи ко мне'}</h1>
          <p>{state.today ? `Сегодня ${dotDate(state.today)}` : 'Пациенты, записанные на приём к вам'}</p>
        </div>
      </div>

      {!state.mongoAvailable && state.phase === 'ready' && (
        <div className="dr-gap">
          <Banner kind="warn" title="Личные дела временно недоступны">Список записей работает, но личные дела пациентов сейчас не открываются.</Banner>
        </div>
      )}

      <section className="card dr-list">
        <div className="tabs" role="group" aria-label="Период">
          {PERIODS.map((item) => (
            <button
              key={item.value}
              type="button"
              aria-pressed={period === item.value}
              className={`tab ${period === item.value ? 'is-active' : ''}`}
              onClick={() => setPeriod(item.value)}
            >
              {item.label}
            </button>
          ))}
        </div>

        <div className="dr-toolbar">
          <label className="search">
            <Icon name="search" size={16} />
            <input type="search" value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Поиск по ФИО пациента" aria-label="Поиск по ФИО пациента" />
          </label>
          {isAdmin && (
            <select className="select" value={doctorId} onChange={(event) => setDoctorId(event.target.value)} aria-label="Фильтр по врачу">
              <option value="">Все врачи</option>
              {doctors.list.map((doctor) => <option key={doctor.id} value={doctor.id}>{doctor.fullName ?? `${doctor.lastName} ${doctor.firstName}`}</option>)}
            </select>
          )}
          <select className="select" value={status} onChange={(event) => setStatus(event.target.value)} aria-label="Фильтр по статусу">
            <option value="all">Любой статус</option>
            {STATUSES.map((item) => <option key={item.value} value={item.value}>{item.label}</option>)}
          </select>
        </div>

        {(state.phase === 'loading' || (state.phase === 'error' && !state.error)) && (
          <div className="state" role="status">
            <div className="state-loading"><Spinner size={22} /><span>Загружаем записи…</span></div>
          </div>
        )}

        {state.phase === 'error' && state.error && (
          <div className="state state-center" role="alert">
            <span className="state-icon state-icon-error"><Icon name="wifiOff" size={26} /></span>
            <h3>Не удалось загрузить записи</h3>
            <p>{state.error}</p>
            <Button variant="primary" icon="refresh" onClick={retry}>Повторить</Button>
          </div>
        )}

        {state.phase === 'ready' && visible.length === 0 && !groups && (
          <div className="state state-center">
            <span className="state-icon"><Icon name="calendar" size={26} /></span>
            <h3>{filtered ? 'Ничего не найдено' : 'Записей нет'}</h3>
            <p>{filtered ? 'Измените поисковый запрос или статус.' : isAdmin ? 'На выбранный период записей нет.' : 'На выбранный период к вам никто не записан.'}</p>
            {filtered && <Button onClick={() => { setQuery(''); setStatus('all'); }}>Сбросить фильтры</Button>}
          </div>
        )}

        {state.phase === 'ready' && (groups || visible.length > 0) && (
          <div className="dr-table-wrap">
            <table className="dr-table" aria-label="Записи пациентов">
              <thead>
                <tr>
                  <th scope="col">Дата и время</th>
                  {isAdmin && <th scope="col">Врач</th>}
                  <th scope="col">Пациент</th>
                  <th scope="col">Телефон</th>
                  <th scope="col">Статус</th>
                  <th scope="col">Личное дело</th>
                  <th scope="col"><span className="dr-sr">Действия</span></th>
                </tr>
              </thead>
              <tbody>
                {(groups ?? [{ key: 'all', items: visible }]).map((group) => (
                  <Fragment key={group.key}>
                    {groups && (
                      <tr className="dr-group">
                        <th colSpan={isAdmin ? 7 : 6} scope="colgroup">
                          {group.title}, {dotDate(group.key)}
                          <span className="dr-sub">{group.items.length ? `записей: ${group.items.length}` : 'записей нет'}</span>
                        </th>
                      </tr>
                    )}
                    {group.items.map((item) => (
                  <tr key={item.id}>
                    <td className="dr-nowrap">
                      <strong>{item.time}</strong>
                      <span className="dr-sub">{dotDate(item.date)}{item.cabinet ? `, каб. ${item.cabinet}` : ''}</span>
                    </td>
                    {isAdmin && (
                      <td>
                        <strong>{item.doctor?.name ?? '—'}</strong>
                        <span className="dr-sub">{item.doctor?.specialty}</span>
                      </td>
                    )}
                    <td>
                      <div className="dr-person">
                        <PatientMark patient={item.patient} />
                        <div>
                          <strong>{item.patient?.fullName ?? 'Пациент не найден'}</strong>
                          <span className="dr-sub">{item.patient ? `${ageText(item.patient.birthDate)}, ${item.patient.gender === 'female' ? 'жен.' : 'муж.'}` : ''}</span>
                        </div>
                      </div>
                    </td>
                    <td className="dr-nowrap">{item.patient?.phone}</td>
                    <td><StatusTag status={item.status} /></td>
                    <td>
                      {item.hasCard === null ? <span className="dr-sub">нет данных</span>
                        : item.hasCard ? <span className="dr-tag dr-tag-ok"><Icon name="check" size={13} />Есть</span>
                          : <span className="dr-tag">Не создано</span>}
                    </td>
                    <td className="dr-actions">
                      {item.patient && <Link className="btn btn-secondary btn-sm" to={`/doctor/patients/${item.patient.id}`}>Подробнее</Link>}
                    </td>
                  </tr>
                    ))}
                  </Fragment>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </>
  );
}
