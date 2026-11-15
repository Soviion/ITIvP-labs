import { memo, useEffect, useRef } from 'react';
import { STATUSES } from '../constants';
import { fullName, shortName } from '../utils/appointments';
import Button from '../ui/Button';
import Spinner from '../ui/Spinner';

// Одна строка списка. memo: строка перерисовывается только когда изменилась её собственная запись.
function AppointmentRow({ item, onEdit, onDelete, onStatusChange }) {
  const busy = Boolean(item.pending);
  const ref = useRef(null);
  const specialty = item.doctor?.specialty?.name;

  // только что созданная или изменённая запись: при появлении строки прокручиваем к ней (она может быть ниже экрана)
  const appearedFresh = useRef(item.fresh);
  useEffect(() => {
    if (appearedFresh.current) ref.current?.scrollIntoView({ block: 'center', behavior: 'smooth' });
  }, []);

  return (
    <li ref={ref} className={`row ${busy ? 'is-pending' : ''} ${item.fresh ? 'is-fresh' : ''}`} aria-busy={busy || undefined}>
      <div className="cell-time">
        <strong>{item.time}</strong>
        <span>{item.durationMinutes} мин</span>
      </div>

      <div className="cell-main">
        <span className="cell-title">{fullName(item.patient) || 'Пациент не найден'}</span>
        <span className="cell-sub">{item.reason || 'Причина обращения не указана'}</span>
      </div>

      <div className="cell-doctor">
        <span className="cell-title">{shortName(item.doctor)}</span>
        <span className="cell-sub">
          {[specialty, item.cabinet && `каб. ${item.cabinet}`].filter(Boolean).join(' · ')}
        </span>
      </div>

      <div className="cell-status">
        <select
          className={`status-select s-${item.status}`}
          value={item.status}
          onChange={(event) => onStatusChange(item.id, event.target.value)}
          disabled={busy}
          aria-label={`Статус приёма: ${fullName(item.patient)}`}
        >
          {STATUSES.map((status) => (
            <option key={status.value} value={status.value}>{status.label}</option>
          ))}
        </select>
      </div>

      <div className="cell-actions">
        {busy ? (
          <span className="saving"><Spinner size={14} /> Сохраняем…</span>
        ) : (
          <>
            <Button variant="ghost" size="sm" icon="pencil" title="Редактировать" aria-label="Редактировать запись" onClick={() => onEdit(item)} />
            <Button variant="ghost" size="sm" icon="trash" className="btn-danger-ghost" title="Удалить" aria-label="Удалить запись" onClick={() => onDelete(item)} />
          </>
        )}
      </div>
    </li>
  );
}

export default memo(AppointmentRow);
