import { useMemo, useState } from 'react';
import { DURATIONS, STATUSES } from '../constants';
import { fullName, shortName, validateDraft } from '../utils/appointments';
import Banner from '../ui/Banner';
import Button from '../ui/Button';
import Field from '../ui/Field';
import Modal from '../ui/Modal';
import PatientModal from './PatientModal';

function AppointmentForm({ mode, initial, serverErrors, formError, directory, onSubmit, onClose }) {
  const [draft, setDraft] = useState(initial);
  const [errors, setErrors] = useState(serverErrors ?? {});
  const [patientModal, setPatientModal] = useState(false);

  const { patients, doctors } = directory;
  const sortedPatients = useMemo(
    () => [...patients].sort((a, b) => fullName(a).localeCompare(fullName(b), 'ru')),
    [patients],
  );
  // врач, который уже не ведёт приём, остаётся в списке, если выбран в редактируемой записи
  const doctorOptions = useMemo(
    () => doctors.filter((doctor) => doctor.isActive || String(doctor.id) === initial.doctorId),
    [doctors, initial.doctorId],
  );
  const durations = DURATIONS.includes(Number(draft.durationMinutes))
    ? DURATIONS
    : [...DURATIONS, Number(draft.durationMinutes)].sort((a, b) => a - b);

  const setField = (name, value) => {
    setDraft((prev) => ({ ...prev, [name]: value }));
    setErrors((prev) => ({ ...prev, [name]: undefined }));
  };
  const bind = (name) => ({ value: draft[name], onChange: (event) => setField(name, event.target.value) });

  function handleSubmit(event) {
    event.preventDefault();
    const found = validateDraft(draft);
    setErrors(found);
    if (Object.keys(found).length === 0) onSubmit(draft);
  }

  async function handleCreatePatient(patientDraft) {
    const patient = await directory.addPatient(patientDraft);
    setField('patientId', String(patient.id));
    setPatientModal(false);
  }

  const directoryReady = directory.status === 'ready';

  return (
    <>
      <form id="appointment-form" onSubmit={handleSubmit} noValidate className="modal-form">
        <div className="modal-body stack">
          {formError && <Banner kind="error" title="Не удалось сохранить">{formError}</Banner>}
          {directory.status === 'error' && (
            <Banner kind="warn" title="Справочники не загружены" action={<Button size="sm" onClick={directory.reload}>Повторить</Button>}>
              {directory.error}
            </Banner>
          )}

          <Field label="Пациент" error={errors.patientId}>
            {(props) => (
              <div className="select-with-action">
                <select {...props} {...bind('patientId')} disabled={!directoryReady}>
                  <option value="">{directory.status === 'loading' ? 'Загрузка списка…' : 'Выберите пациента'}</option>
                  {sortedPatients.map((patient) => (
                    <option key={patient.id} value={String(patient.id)}>{fullName(patient)}</option>
                  ))}
                </select>
                <Button icon="plus" onClick={() => setPatientModal(true)} disabled={!directoryReady}>Новый</Button>
              </div>
            )}
          </Field>

          <Field label="Врач" error={errors.doctorId}>
            {(props) => (
              <select {...props} {...bind('doctorId')} disabled={!directoryReady}>
                <option value="">{directory.status === 'loading' ? 'Загрузка списка…' : 'Выберите врача'}</option>
                {doctorOptions.map((doctor) => (
                  <option key={doctor.id} value={String(doctor.id)}>
                    {shortName(doctor)} — {doctor.specialty?.name}
                  </option>
                ))}
              </select>
            )}
          </Field>

          <div className="grid-3">
            <Field label="Дата" error={errors.date}>
              {(props) => <input {...props} {...bind('date')} type="date" />}
            </Field>
            <Field label="Время" error={errors.time}>
              {(props) => <input {...props} {...bind('time')} type="time" step="300" />}
            </Field>
            <Field label="Длительность" error={errors.durationMinutes}>
              {(props) => (
                <select {...props} value={draft.durationMinutes} onChange={(event) => setField('durationMinutes', Number(event.target.value))}>
                  {durations.map((minutes) => <option key={minutes} value={minutes}>{minutes} мин</option>)}
                </select>
              )}
            </Field>
          </div>

          <div className="grid-2">
            <Field label="Кабинет" optional error={errors.cabinet}>
              {(props) => <input {...props} {...bind('cabinet')} maxLength={10} placeholder="204" autoComplete="off" />}
            </Field>
            <Field label="Статус" error={errors.status}>
              {(props) => (
                <select {...props} {...bind('status')}>
                  {STATUSES.map((status) => <option key={status.value} value={status.value}>{status.label}</option>)}
                </select>
              )}
            </Field>
          </div>

          <Field label="Причина обращения" optional error={errors.reason} hint={`${draft.reason.length} / 1000`}>
            {(props) => <textarea {...props} {...bind('reason')} rows={4} placeholder="Жалобы, цель визита" />}
          </Field>
        </div>

        <footer className="modal-footer">
          <Button onClick={onClose}>Отмена</Button>
          <Button type="submit" variant="primary" icon={mode === 'create' ? 'plus' : 'check'}>
            {mode === 'create' ? 'Создать запись' : 'Сохранить'}
          </Button>
        </footer>
      </form>

      <PatientModal open={patientModal} onClose={() => setPatientModal(false)} onCreate={handleCreatePatient} />
    </>
  );
}

export default function AppointmentDrawer({ drawer, directory, onSubmit, onClose }) {
  const open = Boolean(drawer);
  return (
    <Modal
      open={open}
      onClose={onClose}
      variant="drawer"
      title={drawer?.mode === 'edit' ? 'Редактирование записи' : 'Новая запись на приём'}
      subtitle={drawer?.mode === 'edit' ? 'Изменения сохраняются на сервере' : 'Пациент, врач и время приёма'}
      bare
    >
      {open && (
        <AppointmentForm
          key={drawer.key}
          mode={drawer.mode}
          initial={drawer.draft}
          serverErrors={drawer.errors}
          formError={drawer.formError}
          directory={directory}
          onSubmit={onSubmit}
          onClose={onClose}
        />
      )}
    </Modal>
  );
}
