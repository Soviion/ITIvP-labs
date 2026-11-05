import { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { fullName, shortName } from '../utils/appointments';
import { formatDayHeading } from '../utils/dates';
import { updatePendingSlot } from '../utils/pendingSlot';
import { doctorTitle, profileFor } from '../data/doctorProfiles';
import Button from '../ui/Button';
import DoctorPhoto from '../ui/DoctorPhoto';
import Icon from '../ui/Icon';
import Spinner from '../ui/Spinner';
import SlotPicker from './SlotPicker';

// Выбор врача, даты и времени. Работает без входа в систему: расписание открыто всем.
// Выбор запоминается (sessionStorage): можно уйти в профиль врача или на регистрацию и вернуться с теми же данными.
// onSubmit(selection, doctor) вызывается по кнопке «Записаться».
export default function BookingPanel({ doctors, initial, mode, onSubmit, refreshKey = 0 }) {
  const [specialty, setSpecialty] = useState('all');
  const [selection, setSelection] = useState({ doctorId: initial?.doctorId ?? null, date: initial?.date ?? null, time: initial?.time ?? null });

  useEffect(() => { updatePendingSlot(selection); }, [selection]);

  const specialties = useMemo(() => [...new Set(doctors.list.map((d) => d.specialty?.name).filter(Boolean))], [doctors.list]);
  const visibleDoctors = doctors.list.filter((d) => specialty === 'all' || d.specialty?.name === specialty);
  const doctor = doctors.list.find((d) => d.id === selection.doctorId);

  const pickDoctor = (id) => {
    if (id !== selection.doctorId) setSelection({ doctorId: id, date: null, time: null });
  };

  const heading = selection.date ? formatDayHeading(selection.date) : null;
  const ready = doctor && selection.date && selection.time;

  return (
    <section className="card booking" aria-label="Запись на приём">
      {/* ---------- 1. Врач ---------- */}
      <div className="bstep">
        <header><span className="rstep-num">1</span><h2>Выберите врача</h2></header>

        {(doctors.status === 'loading' || (doctors.status === 'error' && !doctors.error)) && <div className="state-loading"><Spinner size={18} />Загружаем список врачей…</div>}
        {doctors.status === 'error' && doctors.error && (
          <div className="inline-error">
            <p>{doctors.error}</p>
            <Button size="sm" icon="refresh" onClick={doctors.reload}>Повторить</Button>
          </div>
        )}
        {doctors.status === 'ready' && (
          <>
            <div className="chip-filter" role="group" aria-label="Специальность">
              {['all', ...specialties].map((name) => (
                <button key={name} type="button" className={`chip-btn ${specialty === name ? 'is-active' : ''}`} onClick={() => setSpecialty(name)}>
                  {name === 'all' ? 'Все специальности' : name}
                </button>
              ))}
            </div>
            <div className="doctor-grid">
              {visibleDoctors.map((d) => (
                <button key={d.id} type="button" className={`doctor ${d.id === selection.doctorId ? 'is-selected' : ''}`} onClick={() => pickDoctor(d.id)} aria-pressed={d.id === selection.doctorId}>
                  <DoctorPhoto look={profileFor(d).look} photo={profileFor(d).photo} size={44} rounded={999} />
                  <span className="doctor-info">
                    <strong>{fullName(d)}</strong>
                    <span>{d.specialty?.name}</span>
                  </span>
                </button>
              ))}
            </div>
          </>
        )}
      </div>

      {/* ---------- 2–3. Дата и время ---------- */}
      <SlotPicker
        numbered
        doctorId={selection.doctorId}
        value={selection}
        onChange={(change) => setSelection((prev) => ({ ...prev, ...change }))}
        refreshKey={refreshKey}
      />

      {/* ---------- Итог ---------- */}
      <footer className={`booking-bar ${ready ? 'is-ready' : ''}`}>
        <div className="booking-summary">
          {doctor ? (
            <>
              <strong>{shortName(doctor)}, {doctorTitle(doctor)}</strong>
              <span>
                {ready ? (
                  <>
                    <Icon name="calendar" size={14} /> {heading.relative ? `${heading.relative}, ` : ''}{heading.text.toLowerCase()} <Icon name="clock" size={14} /> {selection.time}
                  </>
                ) : 'Выберите дату и время приёма'}
              </span>
            </>
          ) : (
            <span className="muted">Выберите врача, дату и время приёма</span>
          )}
        </div>
        <div className="booking-actions">
          {doctor && (
            <Link to={`/doctors/${doctor.id}`} state={{ name: shortName(doctor) }} className="btn btn-secondary">Подробнее о враче</Link>
          )}
          <Button variant="primary" disabled={!ready || mode === 'staff' || mode === 'loading'} onClick={() => onSubmit(selection, doctor)}>Записаться</Button>
        </div>
      </footer>
    </section>
  );
}
