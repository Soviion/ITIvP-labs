import { useState } from 'react';
import { GENDERS } from '../constants';
import { getErrorMessage, getFieldErrors } from '../api';
import { todayISO } from '../utils/dates';
import { validatePatientDraft } from '../utils/appointments';
import Banner from '../ui/Banner';
import Button from '../ui/Button';
import Field from '../ui/Field';
import Modal from '../ui/Modal';

const EMPTY = { lastName: '', firstName: '', middleName: '', birthDate: '', gender: '', phone: '' };

function PatientForm({ onCreate, onClose }) {
  const [draft, setDraft] = useState(EMPTY);
  const [errors, setErrors] = useState({});
  const [formError, setFormError] = useState('');
  const [saving, setSaving] = useState(false);

  const bind = (name) => ({
    value: draft[name],
    onChange: (event) => {
      setDraft((prev) => ({ ...prev, [name]: event.target.value }));
      setErrors((prev) => ({ ...prev, [name]: undefined }));
    },
  });

  async function handleSubmit(event) {
    event.preventDefault();
    const found = validatePatientDraft(draft);
    setErrors(found);
    if (Object.keys(found).length) return;

    setSaving(true);
    setFormError('');
    try {
      await onCreate(draft);
    } catch (error) {
      setErrors(getFieldErrors(error));
      setFormError(getErrorMessage(error));
      setSaving(false);
    }
  }

  return (
    <form onSubmit={handleSubmit} noValidate className="modal-form">
      <div className="modal-body stack">
        {formError && <Banner kind="error">{formError}</Banner>}

        <div className="grid-2">
          <Field label="Фамилия" error={errors.lastName}>
            {(props) => <input {...props} {...bind('lastName')} autoFocus autoComplete="off" />}
          </Field>
          <Field label="Имя" error={errors.firstName}>
            {(props) => <input {...props} {...bind('firstName')} autoComplete="off" />}
          </Field>
        </div>

        <Field label="Отчество" optional error={errors.middleName}>
          {(props) => <input {...props} {...bind('middleName')} autoComplete="off" />}
        </Field>

        <div className="grid-2">
          <Field label="Дата рождения" error={errors.birthDate}>
            {(props) => <input {...props} {...bind('birthDate')} type="date" min="1900-01-01" max={todayISO()} />}
          </Field>
          <Field label="Пол" error={errors.gender}>
            {(props) => (
              <select {...props} {...bind('gender')}>
                <option value="">Выберите</option>
                {GENDERS.map((gender) => <option key={gender.value} value={gender.value}>{gender.label}</option>)}
              </select>
            )}
          </Field>
        </div>

        <Field label="Телефон" error={errors.phone} hint="В международном формате, например +375 29 123-45-67">
          {(props) => <input {...props} {...bind('phone')} type="tel" autoComplete="off" placeholder="+375 29 000-00-00" />}
        </Field>
      </div>

      <footer className="modal-footer">
        <Button onClick={onClose}>Отмена</Button>
        <Button type="submit" variant="primary" loading={saving}>Добавить пациента</Button>
      </footer>
    </form>
  );
}

export default function PatientModal({ open, onClose, onCreate }) {
  return (
    <Modal open={open} onClose={onClose} title="Новый пациент" subtitle="Карточка будет создана на сервере вместе с медицинской картой" bare>
      <PatientForm onCreate={onCreate} onClose={onClose} />
    </Modal>
  );
}
