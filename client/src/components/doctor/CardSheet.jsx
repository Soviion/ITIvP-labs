import { BLOOD_TYPES } from '../../utils/patient';
import { getIn, setIn } from './cardDraft';
import { GENDER_LABELS, SOCIAL_TEXT, fmtDate, fmtDateTime } from './format';
import { PrintSheet } from './PrintSheet';

const fullName = (patient) => [patient?.lastName, patient?.firstName, patient?.middleName].filter(Boolean).join(' ');
const listText = (items, pick) => (items?.length ? items.map(pick).join('; ') : '');

// Строка таблицы документа. В режиме редактирования вместо текста показывается поле ввода
function Row({ label, editor, children }) {
  return (
    <tr>
      <th scope="row">{label}</th>
      <td className={editor ? 'is-editing' : undefined}>{editor ?? children}</td>
    </tr>
  );
}

function VisitBlock({ visit, index }) {
  const pressure = visit.vitals?.pressure?.systolic ? `${visit.vitals.pressure.systolic}/${visit.vitals.pressure.diastolic ?? ''}` : '';
  const vitals = [
    visit.vitals?.temperature ? `t ${visit.vitals.temperature} °C` : '',
    visit.vitals?.pulse ? `пульс ${visit.vitals.pulse}` : '',
    pressure ? `АД ${pressure}` : '',
  ].filter(Boolean).join(', ');
  const prescriptions = listText(visit.prescriptions, (item) => [item.drug, item.dose, item.days ? `${item.days} дн.` : ''].filter(Boolean).join(' '));

  const summary = [visit.diagnosis, visit.icdCode ? `(${visit.icdCode})` : ''].filter(Boolean).join(' ');

  return (
    <details className="doc-acc">
      <summary>
        <span className="doc-acc-label">Приём {index + 1} от {fmtDate(visit.date)}</span>
        <span className="doc-acc-text">{summary || 'без диагноза'}</span>
      </summary>
      <p className="doc-visit-title">
        {fmtDateTime(visit.date)}, {visit.doctor?.name}{visit.doctor?.specialty ? ` (${visit.doctor.specialty})` : ''}
      </p>
      <table className="doc-fields doc-fields-narrow">
        <tbody>
          <Row label="Жалобы">{visit.complaints}</Row>
          <Row label="Объективный осмотр">{[visit.examination, vitals].filter(Boolean).join('\n')}</Row>
          <Row label="Диагноз">{[visit.diagnosis, visit.icdCode ? `(МКБ-10: ${visit.icdCode})` : ''].filter(Boolean).join(' ')}</Row>
          <Row label="Лечение и назначения">{[visit.treatment, prescriptions].filter(Boolean).join('\n')}</Row>
          <Row label="Рекомендации">{visit.recommendations}</Row>
        </tbody>
      </table>
    </details>
  );
}

const URGENCY_TEXT = { planned: 'плановое', urgent: 'срочное' };

// Направление: в списке одна строка «№ … от …», по нажатию раскрываются все данные
function ReferralBlock({ item }) {
  return (
    <details className="doc-acc">
      <summary>
        <span className="doc-acc-label">№ {item.number} от {fmtDate(item.issuedAt)}</span>
        <span className="doc-acc-text">{`${item.toSpecialty}${item.toFacility ? `, ${item.toFacility}` : ''}. ${item.purpose}`}</span>
      </summary>
      <table className="doc-fields doc-fields-narrow">
        <tbody>
          <Row label="Куда направляется">{[item.toSpecialty, item.toFacility].filter(Boolean).join(', ')}</Row>
          <Row label="Срочность">{URGENCY_TEXT[item.urgency]}</Row>
          <Row label="Диагноз">{[item.diagnosis, item.icdCode ? `(МКБ-10: ${item.icdCode})` : ''].filter(Boolean).join(' ')}</Row>
          <Row label="Цель направления">{item.purpose}</Row>
          <Row label="Обследование и отметки">{item.notes}</Row>
          <Row label="Действительно до">{fmtDate(item.validUntil)}</Row>
          <Row label="Врач">{[item.doctor?.name, item.doctor?.specialty].filter(Boolean).join(', ')}</Row>
        </tbody>
      </table>
    </details>
  );
}

// Предпросмотр документа «Медицинская карта амбулаторного пациента». Те же разделы, что в Word-файле на сервере.
// editing + draft + onDraft: пустые поля врач заполняет прямо в листе.
export default function CardSheet({ card, photoUrl, editing = false, draft, onDraft, clinicName = 'Моя клиника' }) {
  const patient = card.patient ?? {};
  const anamnesis = card.anamnesis ?? {};
  const bmi = card.bmi ?? (card.heightCm && card.weightKg ? Math.round((card.weightKg / ((card.heightCm / 100) ** 2)) * 10) / 10 : '');

  const set = (path) => (event) => onDraft(setIn(draft, path, event.target.value));
  const text = (path, props = {}) => <input className="doc-input" value={getIn(draft, path)} onChange={set(path)} {...props} />;
  const area = (path) => <textarea className="doc-input" rows={2} value={getIn(draft, path)} onChange={set(path)} />;
  const e = (editor) => (editing ? editor : undefined);

  return (
    <PrintSheet id="card" className={editing ? 'is-editing' : ''}>
      <header className="doc-top">
        <div>
          <p className="doc-org">{clinicName}</p>
          <h2 className="doc-title">МЕДИЦИНСКАЯ КАРТА<br />АМБУЛАТОРНОГО ПАЦИЕНТА</h2>
          <p className="doc-number">Карта № {card.cardNumber}</p>
          <p className="doc-small">Дата заведения: {fmtDate(card.createdAt)}</p>
        </div>
        <div className="doc-photo">
          {photoUrl ? <img src={photoUrl} alt="Фото пациента" /> : <span>Нет фото</span>}
        </div>
      </header>

      <h3 className="doc-h">1. Данные пациента</h3>
      <table className="doc-fields">
        <tbody>
          <Row label="Фамилия, имя, отчество">{fullName(patient)}</Row>
          <Row label="Дата рождения">{fmtDate(patient.birthDate)}</Row>
          <Row label="Пол">{GENDER_LABELS[patient.gender]}</Row>
          <Row label="Телефон" editor={e(text('patient.phone', { placeholder: '+375(44)4444444' }))}>{patient.phone}</Row>
          <Row label="E-mail" editor={e(text('patient.email', { type: 'email' }))}>{patient.email}</Row>
          <Row label="Адрес проживания" editor={e(text('patient.address'))}>{patient.address}</Row>
          <Row
            label="Социальный статус"
            editor={e(
              <select className="doc-input" value={draft?.patient.socialStatus ?? ''} onChange={set('patient.socialStatus')}>
                <option value="" />
                {Object.entries(SOCIAL_TEXT).map(([value, label]) => <option key={value} value={value}>{label}</option>)}
              </select>,
            )}
          >
            {SOCIAL_TEXT[patient.socialStatus]}
          </Row>
          <Row label="Место работы или учёбы" editor={e(text('patient.workplace'))}>{patient.workplace}</Row>
          <Row label="Номер полиса" editor={e(text('patient.insuranceNumber'))}>{patient.insuranceNumber}</Row>
          <Row label="Доверенное лицо" editor={e(text('patient.trustedPerson'))}>{patient.trustedPerson}</Row>
        </tbody>
      </table>

      <h3 className="doc-h">2. Медицинские данные</h3>
      <table className="doc-fields">
        <tbody>
          <Row
            label="Группа крови"
            editor={e(
              <select className="doc-input" value={draft?.bloodType ?? ''} onChange={set('bloodType')}>
                <option value="" />
                {BLOOD_TYPES.map((type) => <option key={type} value={type}>{type}</option>)}
              </select>,
            )}
          >
            {card.bloodType}
          </Row>
          <Row label="Рост, см" editor={e(text('heightCm', { type: 'number', min: 30, max: 250, step: 1 }))}>{card.heightCm}</Row>
          <Row label="Вес, кг" editor={e(text('weightKg', { type: 'number', min: 2, max: 400, step: 0.1 }))}>{card.weightKg}</Row>
          <Row label="Индекс массы тела">{bmi}</Row>
          <Row label="Аллергии" editor={e(area('allergies'))}>{(card.allergies ?? []).join('; ')}</Row>
          <Row label="Заболевания" editor={e(area('diseases'))}>{listText(card.diseases, (item) => item.name)}</Row>
          <Row label="Принимаемые препараты" editor={e(area('medications'))}>
            {listText(card.medications, (item) => [item.name, item.dose].filter(Boolean).join(' '))}
          </Row>
        </tbody>
      </table>

      <h3 className="doc-h">3. Анамнез</h3>
      <table className="doc-fields">
        <tbody>
          <Row label="Наследственность" editor={e(area('anamnesis.family'))}>{anamnesis.family}</Row>
          <Row label="Вредные привычки" editor={e(area('anamnesis.habits'))}>{anamnesis.habits}</Row>
          <Row label="Операции и травмы" editor={e(area('anamnesis.surgeries'))}>{anamnesis.surgeries}</Row>
          <Row label="Инвалидность" editor={e(text('anamnesis.disability'))}>{anamnesis.disability}</Row>
          <Row label="Прочее" editor={e(area('anamnesis.notes'))}>{anamnesis.notes}</Row>
        </tbody>
      </table>

      <h3 className="doc-h">4. Приёмы и осмотры</h3>
      {card.visits?.length
        ? card.visits.map((visit, index) => <VisitBlock key={visit._id ?? index} visit={visit} index={index} />)
        : <p className="doc-empty">Записей о приёмах пока нет.</p>}

      <h3 className="doc-h">5. Выданные направления</h3>
      {card.referrals?.length ? (
        card.referrals.map((item) => <ReferralBlock key={item._id} item={item} />)
      ) : <p className="doc-empty">Направлений нет.</p>}

      <footer className="doc-sign">
        <p>Карту оформил(а): {card.createdBy?.name ?? '______________________'}</p>
        <p>Подпись: ______________________</p>
      </footer>
    </PrintSheet>
  );
}
