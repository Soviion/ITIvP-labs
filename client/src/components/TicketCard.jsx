import { STATUS_LABELS } from '../constants';
import { shortName } from '../utils/appointments';
import { formatDayHeading, parseISO } from '../utils/dates';
import { canCancelTicket } from '../utils/tickets';
import Button from '../ui/Button';
import Spinner from '../ui/Spinner';

const MONTHS = ['янв', 'фев', 'мар', 'апр', 'мая', 'июн', 'июл', 'авг', 'сен', 'окт', 'ноя', 'дек'];

// Один талон: дата крупно слева, врач и причина в центре, статус и действия справа
export default function TicketCard({ item, onCancel, onEdit, onDelete }) {
  const date = parseISO(item.date);
  const heading = formatDayHeading(item.date);
  const busy = Boolean(item.pending);

  return (
    <li className={`ticket ${busy ? 'is-pending' : ''}`}>
      <div className="ticket-date">
        <strong>{date.getDate()}</strong>
        <span>{MONTHS[date.getMonth()]}</span>
      </div>
      <div className="ticket-main">
        <span className="ticket-when">{heading.relative ? `${heading.relative}, ` : ''}{heading.text.split(', ')[0].toLowerCase()} · {item.time}</span>
        <span className="cell-title">{shortName(item.doctor)}, {item.doctor?.specialty?.name}</span>
        <span className="cell-sub">
          {[item.cabinet && `Кабинет ${item.cabinet}`, item.reason].filter(Boolean).join(' · ') || 'Причина обращения не указана'}
        </span>
      </div>
      <div className="ticket-side">
        <span className={`pill s-${item.status}`}><i className="dot" />{STATUS_LABELS[item.status]}</span>
        {busy && <span className="saving"><Spinner size={14} /> Отменяем…</span>}
        {!busy && onDelete && (
          <div className="ticket-actions">
            <Button size="sm" icon="trash" onClick={() => onDelete(item)}>Удалить</Button>
          </div>
        )}
        {!busy && canCancelTicket(item) && (onEdit || onCancel) && (
          <div className="ticket-actions">
            {onEdit && <Button size="sm" icon="pencil" onClick={() => onEdit(item)}>Изменить</Button>}
            {onCancel && <Button size="sm" onClick={() => onCancel(item)}>Отменить</Button>}
          </div>
        )}
      </div>
    </li>
  );
}
