import { useState } from 'react';
import { useAuth } from '../auth/context';
import useSlotHold from '../realtime/useSlotHold';
import { shortName } from '../utils/appointments';
import { formatDayHeading } from '../utils/dates';
import Button from '../ui/Button';
import Field from '../ui/Field';
import Modal from '../ui/Modal';
import SlotPicker from './SlotPicker';

function EditForm({ item, onSave, onClose }) {
  const { status, user } = useAuth();
  const [value, setValue] = useState({ date: item.date, time: item.time });
  const [reason, setReason] = useState(item.reason ?? '');

  // Бронь нового времени: пока пациент выбирает другой талон, его не займёт никто другой (текущее время записи не бронируется).
  // Бронь снимается при смене выбора, закрытии окна и сохранении; если она истекла, возвращается прежнее время записи
  const moved = value.date !== item.date || value.time !== item.time;
  const hold = useSlotHold({
    doctorId: item.doctorId,
    date: value.date,
    time: value.time,
    enabled: status === 'authed' && user?.role === 'patient' && moved,
    onLost: () => setValue({ date: item.date, time: item.time }),
  });

  const changed = value.date !== item.date || value.time !== item.time || reason.trim() !== (item.reason ?? '');
  const complete = Boolean(value.date && value.time);

  function submit(event) {
    event.preventDefault();
    const changes = {};
    if (value.date !== item.date || value.time !== item.time) Object.assign(changes, { date: value.date, time: value.time });
    if (reason.trim() !== (item.reason ?? '')) changes.reason = reason.trim();
    onSave(item, changes);
  }

  return (
    <form onSubmit={submit} className="modal-form" noValidate>
      <div className="modal-body stack">
        <p className="muted">
          {shortName(item.doctor)}, {item.doctor?.specialty?.name}. Сейчас: {formatDayHeading(item.date).text.toLowerCase()}, {item.time}.
        </p>
        <SlotPicker doctorId={item.doctorId} excludeId={item.id} value={value} onChange={(change) => setValue((prev) => ({ ...prev, ...change }))} hold={hold} />
        <Field label="Описание (причина обращения)" optional hint={`${reason.length} / 1000`}>
          {(props) => <textarea {...props} rows={3} maxLength={1000} value={reason} onChange={(event) => setReason(event.target.value)} placeholder="Жалобы, цель визита" />}
        </Field>
      </div>
      <footer className="modal-footer">
        <Button onClick={onClose}>Отмена</Button>
        <Button type="submit" variant="primary" disabled={!changed || !complete}>Сохранить</Button>
      </footer>
    </form>
  );
}

// Изменение времени и описания своей записи. Время выбирается среди свободных талонов того же врача.
export default function EditTicketModal({ item, onSave, onClose }) {
  return (
    <Modal open={Boolean(item)} onClose={onClose} title="Изменить запись" subtitle="Время и описание приёма" size="md" bare>
      {item && <EditForm key={item.id} item={item} onSave={onSave} onClose={onClose} />}
    </Modal>
  );
}
