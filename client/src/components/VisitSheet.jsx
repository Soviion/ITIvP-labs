import '../doctor.css';
import { PrintSheet } from './doctor/PrintSheet';
import { GENDER_LABELS, fmtDate, fmtDateTime } from './doctor/format';

const fullName = (patient) => [patient?.lastName, patient?.firstName, patient?.middleName].filter(Boolean).join(' ');

function Row({ label, children }) {
  return (
    <tr>
      <th scope="row">{label}</th>
      <td>{children}</td>
    </tr>
  );
}

// Документ «Протокол приёма»: то, что врач записал во время осмотра. Разметка та же, что у листа карты врача
export default function VisitSheet({ visit, card, clinicName = 'Моя клиника' }) {
  const patient = card?.patient ?? {};
  const pressure = visit.vitals?.pressure?.systolic ? `${visit.vitals.pressure.systolic}/${visit.vitals.pressure.diastolic ?? ''}` : '';
  const vitals = [
    visit.vitals?.temperature ? `t ${visit.vitals.temperature} °C` : '',
    visit.vitals?.pulse ? `пульс ${visit.vitals.pulse}` : '',
    pressure ? `АД ${pressure}` : '',
  ].filter(Boolean).join(', ');
  const prescriptions = (visit.prescriptions ?? [])
    .map((item) => [item.drug, item.dose, item.days ? `${item.days} дн.` : ''].filter(Boolean).join(' '))
    .join('; ');
  const doctor = [visit.doctor?.name, visit.doctor?.specialty].filter(Boolean).join(', ');

  return (
    <PrintSheet id={`visit-${visit.id}`}>
      <header className="doc-top">
        <div>
          <p className="doc-org">{clinicName}</p>
          <h2 className="doc-title">ПРОТОКОЛ ПРИЁМА ВРАЧА</h2>
          <p className="doc-number">Карта № {card?.cardNumber}</p>
          <p className="doc-small">Дата приёма: {fmtDateTime(visit.date)}</p>
        </div>
      </header>

      <h3 className="doc-h">Пациент</h3>
      <table className="doc-fields">
        <tbody>
          <Row label="Фамилия, имя, отчество">{fullName(patient)}</Row>
          <Row label="Дата рождения">{fmtDate(patient.birthDate)}</Row>
          <Row label="Пол">{GENDER_LABELS[patient.gender]}</Row>
          <Row label="Адрес проживания">{patient.address}</Row>
          <Row label="Номер полиса">{patient.insuranceNumber}</Row>
        </tbody>
      </table>

      <h3 className="doc-h">Приём</h3>
      <table className="doc-fields">
        <tbody>
          <Row label="Врач">{doctor}</Row>
          <Row label="Жалобы">{visit.complaints}</Row>
          <Row label="Объективный осмотр">{[visit.examination, vitals].filter(Boolean).join('\n')}</Row>
          <Row label="Диагноз">{[visit.diagnosis, visit.icdCode ? `(МКБ-10: ${visit.icdCode})` : ''].filter(Boolean).join(' ')}</Row>
          <Row label="Лечение и назначения">{[visit.treatment, prescriptions].filter(Boolean).join('\n')}</Row>
          <Row label="Рекомендации">{visit.recommendations}</Row>
        </tbody>
      </table>

      <footer className="doc-sign">
        <p>Врач: {doctor || '______________________'}</p>
        <p>Подпись: ______________________</p>
      </footer>
    </PrintSheet>
  );
}
