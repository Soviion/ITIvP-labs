import { useCallback, useMemo, useState } from 'react';
import { getErrorMessage, getFieldErrors } from '../api';
import { DEFAULT_FILTERS } from '../constants';
import useAppointments from '../hooks/useAppointments';
import useDirectory from '../hooks/useDirectory';
import {
  countByStatus,
  createEmptyDraft,
  draftFromItem,
  filterAppointments,
  fullName,
  groupByDate,
  sortAppointments,
} from '../utils/appointments';
import { formatDayHeading, formatShortDate } from '../utils/dates';
import AppointmentDrawer from '../components/AppointmentDrawer';
import AppointmentFilters from '../components/AppointmentFilters';
import AppointmentRow from '../components/AppointmentRow';
import ConfirmDialog from '../components/ConfirmDialog';
import { EmptyState, ErrorState, LoadingState, NoResults } from '../components/ListStates';
import Button from '../ui/Button';
import { useToast } from '../ui/toastContext';

export default function AppointmentsPage() {
  const toast = useToast();
  const { items, status, error, reload, add, update, changeStatus, remove } = useAppointments();
  const directory = useDirectory();

  const [filters, setFilters] = useState(DEFAULT_FILTERS);
  const [drawer, setDrawer] = useState(null); // { mode, draft, errors, formError, key } — открытая форма
  const [deleting, setDeleting] = useState(null); // запись, которую просят подтвердить удаление

  const counts = useMemo(() => countByStatus(items), [items]);
  const groups = useMemo(
    () => groupByDate(sortAppointments(filterAppointments(items, filters), filters.direction)),
    [items, filters],
  );
  const visibleCount = groups.reduce((sum, group) => sum + group.items.length, 0);

  const openCreate = () => setDrawer({ mode: 'create', draft: createEmptyDraft(), key: Date.now() });
  const openEdit = useCallback((item) => setDrawer({ mode: 'edit', draft: draftFromItem(item), key: Date.now() }), []);
  const askDelete = useCallback((item) => setDeleting(item), []);

  // Форма закрывается сразу — запись появляется в списке до ответа сервера (оптимистичное обновление).
  // Если сервер отказал, форма открывается снова с теми же данными и текстом ошибки.
  async function handleSubmit(draft) {
    const mode = drawer.mode;
    setDrawer(null);

    const related = {
      patientId: Number(draft.patientId),
      doctorId: Number(draft.doctorId),
      patient: directory.patients.find((patient) => String(patient.id) === draft.patientId) ?? null,
      doctor: directory.doctors.find((doctor) => String(doctor.id) === draft.doctorId) ?? null,
    };

    const result = mode === 'create' ? await add(draft, related) : await update(draft.id, draft, related);
    if (result.ok) {
      toast.success(mode === 'create' ? 'Запись создана' : 'Изменения сохранены');
    } else {
      setDrawer({ mode, draft, errors: getFieldErrors(result.error), formError: getErrorMessage(result.error), key: Date.now() });
    }
  }

  async function confirmDelete() {
    const item = deleting;
    setDeleting(null);
    const result = await remove(item.id);
    if (result.ok) toast.success('Запись удалена');
  }

  return (
    <>
      <title>Записи на приём — Регистратура</title>

      <div className="page-head">
        <div>
          <h1>Записи на приём</h1>
          <p>
            {status === 'ready'
              ? `Всего ${items.length}${visibleCount !== items.length ? `, по фильтру ${visibleCount}` : ''}`
              : 'Расписание приёмов клиники'}
          </p>
        </div>
        <Button variant="primary" icon="plus" onClick={openCreate} disabled={status === 'error'}>Новая запись</Button>
      </div>

      <AppointmentFilters
        filters={filters}
        onChange={setFilters}
        counts={status === 'ready' ? counts : {}}
        doctors={directory.doctors.filter((doctor) => doctor.isActive)}
        disabled={status !== 'ready'}
      />

      <section className="card list" aria-label="Список записей">
        {status === 'loading' && <LoadingState />}
        {status === 'error' && <ErrorState message={error} onRetry={reload} />}
        {status === 'ready' && items.length === 0 && <EmptyState onCreate={openCreate} />}
        {status === 'ready' && items.length > 0 && groups.length === 0 && <NoResults onReset={() => setFilters(DEFAULT_FILTERS)} />}

        {status === 'ready' && groups.length > 0 && (
          <>
            <div className="list-head" aria-hidden="true">
              <span>Время</span>
              <span>Пациент</span>
              <span>Врач</span>
              <span>Статус</span>
              <span />
            </div>
            {groups.map((group) => {
              const heading = formatDayHeading(group.date);
              return (
                <section key={group.date} className="day">
                  <h2 className="day-heading">
                    {heading.relative && <span className="day-rel">{heading.relative}</span>}
                    <span>{heading.text}</span>
                    <span className="day-count">{group.items.length}</span>
                  </h2>
                  <ul className="rows">
                    {group.items.map((item) => (
                      <AppointmentRow
                        key={item.uid ?? item.id}
                        item={item}
                        onEdit={openEdit}
                        onDelete={askDelete}
                        onStatusChange={changeStatus}
                      />
                    ))}
                  </ul>
                </section>
              );
            })}
          </>
        )}
      </section>

      <AppointmentDrawer drawer={drawer} directory={directory} onSubmit={handleSubmit} onClose={() => setDrawer(null)} />

      <ConfirmDialog
        open={Boolean(deleting)}
        title="Удалить запись?"
        confirmLabel="Удалить"
        danger
        onConfirm={confirmDelete}
        onClose={() => setDeleting(null)}
      >
        {deleting && (
          <p className="confirm-text">
            Запись пациента <strong>{fullName(deleting.patient)}</strong> на {formatShortDate(deleting.date)} в {deleting.time} будет удалена.
            Действие нельзя отменить.
          </p>
        )}
      </ConfirmDialog>
    </>
  );
}
