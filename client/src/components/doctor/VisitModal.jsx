import { useState } from 'react';
import { addVisit } from '../../doctorApi';
import { getDetailMessages, getErrorMessage } from '../../api';
import Banner from '../../ui/Banner';
import Button from '../../ui/Button';
import Field from '../../ui/Field';
import Icon from '../../ui/Icon';
import Modal from '../../ui/Modal';

const ICD_RE = /^[A-Za-z]\d{2}(\.\d{1,2})?$/;
const emptyDrug = () => ({ drug: '', dose: '', days: '7' });

// Номер поля вида visits.0.vitals.temperature → temperature: сервер называет поля по полному пути
function leafErrors(error) {
  const details = error?.response?.data?.details;
  if (!Array.isArray(details)) return {};
  return Object.fromEntries(details.filter((item) => item.field).map((item) => [item.field.split('.').pop(), item.message]));
}

const numberOrUndefined = (value) => (value === '' ? undefined : Number(String(value).replace(',', '.')));

// Приём: жалобы, осмотр, показатели, диагноз, лечение и назначения. appointments — записи пациента к этому врачу
export default function VisitModal({ open, onClose, patientId, appointments, onSaved }) {
  // выше по дереву окно монтируется заново при каждом открытии, поэтому начальные значения считаем один раз
  const [appointmentId, setAppointmentId] = useState(() => String(appointments[0]?.id ?? ''));
  const [values, setValues] = useState({
    complaints: '', examination: '', temperature: '', pulse: '', systolic: '', diastolic: '',
    diagnosis: '', icdCode: '', treatment: '', recommendations: '',
  });
  const [drugs, setDrugs] = useState([]);
  const [errors, setErrors] = useState({});
  const [problem, setProblem] = useState('');
  const [saving, setSaving] = useState(false);

  const setValue = (name) => (event) => {
    setValues((prev) => ({ ...prev, [name]: event.target.value }));
    setErrors((prev) => ({ ...prev, [name]: undefined }));
  };
  const setDrug = (index, name, value) => setDrugs((prev) => prev.map((item, i) => (i === index ? { ...item, [name]: value } : item)));

  async function submit(event) {
    event.preventDefault();
    const found = {};
    if (!values.complaints.trim()) found.complaints = 'Опишите жалобы пациента';
    if (!values.diagnosis.trim()) found.diagnosis = 'Укажите диагноз';
    if (values.icdCode.trim() && !ICD_RE.test(values.icdCode.trim())) found.icdCode = 'Код вида J20.9';
    if (drugs.some((item) => !item.drug.trim() && (item.dose || item.days !== '7'))) found.drugs = 'У назначения не указан препарат';
    setErrors(found);
    if (Object.keys(found).length) return;

    const vitals = {
      temperature: numberOrUndefined(values.temperature),
      pulse: numberOrUndefined(values.pulse),
      pressure: values.systolic || values.diastolic
        ? { systolic: numberOrUndefined(values.systolic), diastolic: numberOrUndefined(values.diastolic) }
        : undefined,
    };

    setSaving(true);
    setProblem('');
    try {
      const card = await addVisit(patientId, {
        appointmentId: appointmentId || undefined,
        complaints: values.complaints.trim(),
        examination: values.examination.trim() || undefined,
        diagnosis: values.diagnosis.trim(),
        icdCode: values.icdCode.trim() || undefined,
        treatment: values.treatment.trim() || undefined,
        recommendations: values.recommendations.trim() || undefined,
        vitals,
        prescriptions: drugs.filter((item) => item.drug.trim()).map((item) => ({
          drug: item.drug.trim(),
          dose: item.dose.trim() || undefined,
          days: numberOrUndefined(item.days),
        })),
      });
      onSaved(card, Boolean(appointmentId));
    } catch (error) {
      setErrors(leafErrors(error));
      setProblem([getErrorMessage(error), ...getDetailMessages(error)].filter(Boolean).slice(0, 1).join(' '));
      setSaving(false);
    }
  }

  return (
    <Modal
      open={open}
      onClose={onClose}
      size="lg"
      title="Новый приём"
      subtitle="Запись появится в личном деле пациента"
      dismissible={!saving}
      footer={(
        <>
          <Button onClick={onClose} disabled={saving}>Отмена</Button>
          <Button type="submit" form="visit-form" variant="primary" loading={saving}>Сохранить приём</Button>
        </>
      )}
    >
      <form id="visit-form" onSubmit={submit} noValidate className="stack">
        {problem && <Banner kind="error">{problem}</Banner>}

        <Field label="Запись на приём" optional hint="После сохранения запись получит статус «Проведён»">
          {(props) => (
            <select {...props} className="select" value={appointmentId} onChange={(event) => setAppointmentId(event.target.value)}>
              <option value="">Без привязки к записи</option>
              {appointments.map((item) => <option key={item.id} value={item.id}>{item.date.replaceAll('-', '.')} в {item.time}</option>)}
            </select>
          )}
        </Field>

        <Field label="Жалобы" error={errors.complaints}>
          {(props) => <textarea {...props} rows={3} value={values.complaints} onChange={setValue('complaints')} autoFocus />}
        </Field>
        <Field label="Объективный осмотр" optional>
          {(props) => <textarea {...props} rows={3} value={values.examination} onChange={setValue('examination')} />}
        </Field>

        <div className="dr-grid-4">
          <Field label="Температура, °C" optional error={errors.temperature}>
            {(props) => <input {...props} type="number" step="0.1" min="30" max="45" value={values.temperature} onChange={setValue('temperature')} />}
          </Field>
          <Field label="Пульс" optional error={errors.pulse}>
            {(props) => <input {...props} type="number" min="20" max="250" value={values.pulse} onChange={setValue('pulse')} />}
          </Field>
          <Field label="АД верхнее" optional error={errors.systolic}>
            {(props) => <input {...props} type="number" min="50" max="300" value={values.systolic} onChange={setValue('systolic')} />}
          </Field>
          <Field label="АД нижнее" optional error={errors.diastolic}>
            {(props) => <input {...props} type="number" min="30" max="200" value={values.diastolic} onChange={setValue('diastolic')} />}
          </Field>
        </div>

        <div className="dr-grid-diag">
          <Field label="Диагноз" error={errors.diagnosis}>
            {(props) => <input {...props} value={values.diagnosis} onChange={setValue('diagnosis')} />}
          </Field>
          <Field label="Код МКБ-10" optional error={errors.icdCode}>
            {(props) => <input {...props} value={values.icdCode} onChange={setValue('icdCode')} placeholder="J20.9" />}
          </Field>
        </div>

        <Field label="Лечение" optional>
          {(props) => <textarea {...props} rows={2} value={values.treatment} onChange={setValue('treatment')} />}
        </Field>

        <fieldset className="dr-drugs">
          <legend>Назначения</legend>
          {drugs.map((item, index) => (
            // eslint-disable-next-line react/no-array-index-key
            <div className="dr-drug-row" key={index}>
              <input value={item.drug} onChange={(event) => setDrug(index, 'drug', event.target.value)} placeholder="Препарат" aria-label="Препарат" />
              <input value={item.dose} onChange={(event) => setDrug(index, 'dose', event.target.value)} placeholder="Дозировка" aria-label="Дозировка" />
              <input type="number" min="1" max="365" value={item.days} onChange={(event) => setDrug(index, 'days', event.target.value)} aria-label="Дней" title="Дней" />
              <Button variant="ghost" size="sm" icon="trash" aria-label="Убрать назначение" onClick={() => setDrugs((prev) => prev.filter((_, i) => i !== index))} />
            </div>
          ))}
          {errors.drugs && <p className="field-error">{errors.drugs}</p>}
          <Button size="sm" icon="plus" onClick={() => setDrugs((prev) => [...prev, emptyDrug()])}>Добавить назначение</Button>
        </fieldset>

        <Field label="Рекомендации" optional>
          {(props) => <textarea {...props} rows={2} value={values.recommendations} onChange={setValue('recommendations')} />}
        </Field>
        <p className="dr-hint"><Icon name="info" size={14} /> Сохранённый приём изменить нельзя — при ошибке добавьте уточняющую запись.</p>
      </form>
    </Modal>
  );
}
