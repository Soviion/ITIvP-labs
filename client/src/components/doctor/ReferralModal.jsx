import { useState } from 'react';
import { getErrorMessage } from '../../api';
import { addReferral } from '../../doctorApi';
import Banner from '../../ui/Banner';
import Button from '../../ui/Button';
import Field from '../../ui/Field';
import Modal from '../../ui/Modal';
import { toInputDate } from './format';

const ICD_RE = /^[A-Za-z]\d{2}(\.\d{1,2})?$/;
const SPECIALTIES = [
  'Терапевт', 'Кардиолог', 'Невролог', 'Хирург', 'Офтальмолог', 'Отоларинголог (ЛОР)', 'Эндокринолог',
  'Гастроэнтеролог', 'Дерматолог', 'Уролог', 'Гинеколог', 'Травматолог-ортопед',
  'Общий анализ крови', 'Рентгенография', 'УЗИ', 'ЭКГ', 'МРТ', 'КТ',
];

function leafErrors(error) {
  const details = error?.response?.data?.details;
  if (!Array.isArray(details)) return {};
  return Object.fromEntries(details.filter((item) => item.field).map((item) => [item.field.split('.').pop(), item.message]));
}

const inThirtyDays = () => toInputDate(new Date(Date.now() + 30 * 24 * 3600 * 1000));

// Форма направления. Диагноз по умолчанию подставляется из последнего приёма
export default function ReferralModal({ open, onClose, patientId, lastVisit, onSaved }) {
  const [values, setValues] = useState(() => ({
    toSpecialty: '', toFacility: '', urgency: 'planned',
    diagnosis: lastVisit?.diagnosis ?? '', icdCode: lastVisit?.icdCode ?? '',
    purpose: '', notes: '', validUntil: inThirtyDays(),
  }));
  const [errors, setErrors] = useState({});
  const [problem, setProblem] = useState('');
  const [saving, setSaving] = useState(false);

  const setValue = (name) => (event) => {
    setValues((prev) => ({ ...prev, [name]: event.target.value }));
    setErrors((prev) => ({ ...prev, [name]: undefined }));
  };

  async function submit(event) {
    event.preventDefault();
    const found = {};
    if (!values.toSpecialty.trim()) found.toSpecialty = 'Укажите специалиста или вид исследования';
    if (!values.purpose.trim()) found.purpose = 'Укажите цель направления';
    if (values.icdCode.trim() && !ICD_RE.test(values.icdCode.trim())) found.icdCode = 'Код вида J20.9';
    if (!values.validUntil) found.validUntil = 'Укажите срок действия';
    else if (values.validUntil < toInputDate(new Date())) found.validUntil = 'Срок не может быть в прошлом';
    setErrors(found);
    if (Object.keys(found).length) return;

    setSaving(true);
    setProblem('');
    try {
      const card = await addReferral(patientId, {
        toSpecialty: values.toSpecialty.trim(),
        toFacility: values.toFacility.trim() || undefined,
        urgency: values.urgency,
        diagnosis: values.diagnosis.trim() || undefined,
        icdCode: values.icdCode.trim() || undefined,
        purpose: values.purpose.trim(),
        notes: values.notes.trim() || undefined,
        validUntil: values.validUntil,
      });
      onSaved(card);
    } catch (error) {
      setErrors(leafErrors(error));
      setProblem(getErrorMessage(error));
      setSaving(false);
    }
  }

  return (
    <Modal
      open={open}
      onClose={onClose}
      size="md"
      title="Выписать направление"
      subtitle="Документ можно распечатать или скачать в Word"
      dismissible={!saving}
      footer={(
        <>
          <Button onClick={onClose} disabled={saving}>Отмена</Button>
          <Button type="submit" form="referral-form" variant="primary" loading={saving}>Выписать</Button>
        </>
      )}
    >
      <form id="referral-form" onSubmit={submit} noValidate className="stack">
        {problem && <Banner kind="error">{problem}</Banner>}

        <Field label="Куда направляется" error={errors.toSpecialty} hint="Специалист или вид исследования">
          {(props) => (
            <>
              <input {...props} list="referral-specialties" value={values.toSpecialty} onChange={setValue('toSpecialty')} autoFocus />
              <datalist id="referral-specialties">{SPECIALTIES.map((name) => <option key={name} value={name} />)}</datalist>
            </>
          )}
        </Field>
        <Field label="Учреждение" optional>
          {(props) => <input {...props} value={values.toFacility} onChange={setValue('toFacility')} placeholder="Например, областная больница" />}
        </Field>

        <div className="grid-2">
          <Field label="Срочность">
            {(props) => (
              <select {...props} className="select" value={values.urgency} onChange={setValue('urgency')}>
                <option value="planned">Плановое</option>
                <option value="urgent">Срочное</option>
              </select>
            )}
          </Field>
          <Field label="Действительно до" error={errors.validUntil}>
            {(props) => <input {...props} type="date" value={values.validUntil} onChange={setValue('validUntil')} />}
          </Field>
        </div>

        <div className="dr-grid-diag">
          <Field label="Диагноз" optional>
            {(props) => <input {...props} value={values.diagnosis} onChange={setValue('diagnosis')} />}
          </Field>
          <Field label="Код МКБ-10" optional error={errors.icdCode}>
            {(props) => <input {...props} value={values.icdCode} onChange={setValue('icdCode')} placeholder="I10" />}
          </Field>
        </div>

        <Field label="Цель направления" error={errors.purpose}>
          {(props) => <textarea {...props} rows={3} value={values.purpose} onChange={setValue('purpose')} />}
        </Field>
        <Field label="Проведённое обследование и отметки" optional>
          {(props) => <textarea {...props} rows={2} value={values.notes} onChange={setValue('notes')} />}
        </Field>
      </form>
    </Modal>
  );
}
