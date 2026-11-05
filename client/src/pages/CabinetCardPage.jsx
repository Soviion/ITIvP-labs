import '../avatar.css';
import { useState } from 'react';
import { getErrorMessage, getFieldErrors, updatePatientProfile, updateRecord } from '../api';
import { useAuth } from '../auth/context';
import ListEditor from '../components/ListEditor';
import PatientFields from '../components/PatientFields';
import { formatShortDate } from '../utils/dates';
import { BLOOD_TYPES, SOCIAL_LABELS, ageOn, bodyMassIndex, fullPatientName, validateProfile } from '../utils/patient';
import Avatar from '../ui/Avatar';
import Field from '../ui/Field';
import Banner from '../ui/Banner';
import Button from '../ui/Button';
import Icon from '../ui/Icon';
import Spinner from '../ui/Spinner';
import { useToast } from '../ui/toastContext';

const GENDER_LABELS = { male: 'Мужской', female: 'Женский' };

function Row({ label, children }) {
  return (
    <div>
      <dt>{label}</dt>
      <dd>{children || <span className="not-set">не указано</span>}</dd>
    </div>
  );
}

// Блок «Личные данные»: просмотр и редактирование без перезагрузки страницы
function PersonalData({ patient }) {
  const { updateMe } = useAuth();
  const toast = useToast();
  const [editing, setEditing] = useState(false);
  const [values, setValues] = useState(patient);
  const [errors, setErrors] = useState({});
  const [formError, setFormError] = useState('');
  const [saving, setSaving] = useState(false);

  function startEdit() {
    setValues(patient);
    setErrors({});
    setFormError('');
    setEditing(true);
  }

  const setField = (name, value) => {
    setValues((prev) => ({ ...prev, [name]: value }));
    setErrors((prev) => ({ ...prev, [name]: undefined, ...(name === 'birthDate' ? { socialStatus: undefined, trustedPerson: undefined } : {}) }));
  };

  async function save(event) {
    event.preventDefault();
    const found = validateProfile(values);
    setErrors(found);
    if (Object.keys(found).length) return;

    setSaving(true);
    setFormError('');
    try {
      updateMe(await updatePatientProfile(values)); // шапка и карта обновятся сразу
      toast.success('Данные сохранены');
      setEditing(false);
    } catch (error) {
      setErrors(getFieldErrors(error));
      setFormError(getErrorMessage(error));
    } finally {
      setSaving(false);
    }
  }

  return (
    <section className="card section">
      <header className="section-head">
        <div className="section-icon"><Icon name="user" size={20} /></div>
        <div>
          <h2>Личные данные</h2>
          <p>Анкета, заполненная при регистрации</p>
        </div>
        {!editing && <Button icon="pencil" onClick={startEdit}>Редактировать</Button>}
      </header>

      {!editing ? (
        <dl className="info-list">
          <Row label="ФИО">{fullPatientName(patient)}</Row>
          <Row label="Пол">{GENDER_LABELS[patient.gender]}</Row>
          <Row label="Дата рождения">{`${formatShortDate(patient.birthDate)} (${ageOn(patient.birthDate)} лет)`}</Row>
          <Row label="Социальный статус">{SOCIAL_LABELS[patient.socialStatus]}</Row>
          <Row label="Телефон">{patient.phone}</Row>
          <Row label="Адрес проживания">{patient.address}</Row>
          <Row label="Место работы или учёбы">{patient.workplace}</Row>
          <Row label="Доверенное лицо">{patient.trustedPerson}</Row>
        </dl>
      ) : (
        <form onSubmit={save} noValidate className="stack">
          {formError && <Banner kind="error">{formError}</Banner>}
          <PatientFields values={values} errors={errors} onChange={setField} />
          <div className="section-actions">
            <Button type="submit" variant="primary" loading={saving}>Сохранить</Button>
            <Button onClick={() => setEditing(false)} disabled={saving}>Отмена</Button>
          </div>
        </form>
      )}
    </section>
  );
}

const toNumber = (text) => Number(String(text).trim().replace(',', '.'));

// Блок «Рост и вес»: пустое поле допустимо (значение сбрасывается), иначе проверяем диапазоны так же, как сервер
function BodyMeasures({ record, onSave }) {
  const [height, setHeight] = useState(record.heightCm ?? '');
  const [weight, setWeight] = useState(record.weightKg ?? '');
  const [errors, setErrors] = useState({});

  const heightText = String(height).trim();
  const weightText = String(weight).trim();
  const dirty = heightText !== String(record.heightCm ?? '') || weightText !== String(record.weightKg ?? '');
  const bmi = bodyMassIndex(heightText && toNumber(heightText), weightText && toNumber(weightText));

  function save(event) {
    event.preventDefault();
    const found = {};
    const h = toNumber(heightText);
    const w = toNumber(weightText);
    if (heightText && (!Number.isInteger(h) || h < 30 || h > 250)) found.height = 'Рост — целое число от 30 до 250 см';
    if (weightText && (!Number.isFinite(w) || w < 2 || w > 400)) found.weight = 'Вес — число от 2 до 400 кг';
    setErrors(found);
    if (Object.keys(found).length) return;
    onSave({ heightCm: heightText ? h : null, weightKg: weightText ? Math.round(w * 10) / 10 : null });
  }

  return (
    <section className="card section">
      <header className="section-head">
        <div>
          <h2>Рост и вес</h2>
          <p>Врач видит эти данные в вашей карте. Обновляйте их при изменении</p>
        </div>
      </header>
      <form onSubmit={save} noValidate className="measures">
        <Field label="Рост, см" error={errors.height}>
          {(props) => <input {...props} inputMode="numeric" value={height} onChange={(event) => { setHeight(event.target.value); setErrors((prev) => ({ ...prev, height: undefined })); }} placeholder="Например, 172" maxLength={3} />}
        </Field>
        <Field label="Вес, кг" error={errors.weight}>
          {(props) => <input {...props} inputMode="decimal" value={weight} onChange={(event) => { setWeight(event.target.value); setErrors((prev) => ({ ...prev, weight: undefined })); }} placeholder="Например, 68,5" maxLength={5} />}
        </Field>
        <div className="measures-bmi">
          <span className="muted">Индекс массы тела</span>
          <strong>{bmi ? `${bmi.value} — ${bmi.label}` : '—'}</strong>
        </div>
        <Button type="submit" variant="primary" disabled={!dirty}>Сохранить</Button>
      </form>
    </section>
  );
}

export default function CabinetCardPage() {
  const { patient, record, profile, profileError, retryProfile, updateMe } = useAuth();
  const toast = useToast();

  // Изменения карты применяются сразу, а при ошибке сервера возвращаются (как и в списке записей)
  async function saveRecord(changes) {
    const previous = record;
    updateMe({ record: { ...record, ...changes } });
    try {
      updateMe(await updateRecord(changes));
    } catch (error) {
      updateMe({ record: previous });
      toast.error(getErrorMessage(error), { title: 'Изменение не сохранено' });
    }
  }

  const bloodLocked = Boolean(record?.bloodTypeNextChangeAt && new Date(record.bloodTypeNextChangeAt) > new Date());

  let content;
  if (profile === 'loading' && !patient) {
    content = <section className="card"><div className="state"><div className="state-loading"><Spinner size={22} /><span>Загружаем медицинскую карту…</span></div></div></section>;
  } else if (profile === 'error') {
    content = (
      <Banner kind="error" title="Не удалось загрузить карту" action={<Button size="sm" onClick={retryProfile}>Повторить</Button>}>{profileError}</Banner>
    );
  } else if (!patient || !record) {
    content = <section className="card"><div className="state state-center"><h3>Карточка не найдена</h3><p>Медицинская карта ведётся только для пациентов.</p></div></section>;
  } else {
    content = (
      <div className="sections">
        <section className="card section card-head">
          <div className="card-owner">
            <Avatar patient={patient} name={fullPatientName(patient)} size={56} />
            <div>
              <span className="card-number">Карта № {record.cardNumber}</span>
              <h2>{fullPatientName(patient)}</h2>
            </div>
          </div>
          <label className="blood">
            <span>Группа крови</span>
            <select
              value={record.bloodType ?? ''}
              disabled={bloodLocked}
              onChange={(event) => saveRecord({ bloodType: event.target.value || null })}
              aria-label="Группа крови"
              title={bloodLocked ? `Изменить можно после ${new Date(record.bloodTypeNextChangeAt).toLocaleDateString('ru-RU')}` : undefined}
            >
              <option value="">Не указана</option>
              {BLOOD_TYPES.map((type) => <option key={type} value={type}>{type}</option>)}
            </select>
            <small className="blood-note">
              {bloodLocked ? `Менять можно раз в неделю. Следующее изменение: ${new Date(record.bloodTypeNextChangeAt).toLocaleDateString('ru-RU')}` : 'Менять можно раз в неделю'}
            </small>
          </label>
        </section>

        <PersonalData patient={patient} />

        <BodyMeasures key={`${record.heightCm}-${record.weightKg}`} record={record} onSave={saveRecord} />

        <ListEditor
          title="Заболевания"
          hint="Хронические и перенесённые заболевания. Сюда же попадают диагнозы, которые ставит врач на приёме"
          items={record.diseases}
          placeholder="Например, гипертония"
          emptyText="Заболевания не добавлены"
          onChange={(diseases) => saveRecord({ diseases })}
        />
        <ListEditor
          title="Принимаемые препараты"
          hint="Лекарства, которые вы принимаете, с дозировкой. Сюда же попадают назначения врача"
          items={record.medications}
          placeholder="Например, Эналаприл 10 мг утром"
          emptyText="Препараты не добавлены"
          onChange={(medications) => saveRecord({ medications })}
        />
      </div>
    );
  }

  return (
    <>
      <title>Медицинская карта — Твой талон</title>
      <div className="page-head"><div><h1>Моя медицинская карта</h1></div></div>
      {content}
    </>
  );
}
