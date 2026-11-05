import { PrintSheet } from './PrintSheet';
import { fmtDate } from './format';

const URGENCY = { planned: 'плановое', urgent: 'СРОЧНОЕ' };
const fullName = (patient) => [patient?.lastName, patient?.firstName, patient?.middleName].filter(Boolean).join(' ');

function Line({ label, children }) {
  return (
    <tr>
      <th scope="row">{label}</th>
      <td>{children}</td>
    </tr>
  );
}

// Направление: официальная шапка, данные пациента, поля, подпись врача и место для печати (М.П.)
export default function ReferralSheet({ card, referral, clinicName = 'Моя клиника' }) {
  const patient = card.patient ?? {};
  return (
    <PrintSheet id={`referral-${referral._id}`}>
      <header className="ref-head">
        <div>
          <div className="ref-ministry">Министерство здравоохранения<br />Республики Беларусь</div>
          <div className="ref-org">Учреждение здравоохранения «{clinicName}»</div>
        </div>
        <div className="ref-meta">
          <span>Номер направления</span>
          <strong>{referral.number}</strong>
          <span>Дата выдачи</span>
          <strong>{fmtDate(referral.issuedAt)}</strong>
        </div>
      </header>
      <hr className="ref-rule" />

      <h2 className="ref-title">НАПРАВЛЕНИЕ</h2>
      <p className="ref-sub">{referral.toSpecialty}{referral.urgency === 'urgent' ? ' — срочно' : ''}</p>

      <table className="doc-fields">
        <tbody>
          <Line label="Пациент">{fullName(patient)}</Line>
          <Line label="Дата рождения">{fmtDate(patient.birthDate)}</Line>
          <Line label="Номер медицинской карты">{card.cardNumber}</Line>
          <Line label="Адрес проживания">{patient.address}</Line>
          <Line label="Номер полиса">{patient.insuranceNumber}</Line>
        </tbody>
      </table>

      <table className="doc-fields ref-gap">
        <tbody>
          <Line label="Куда направляется">{[referral.toSpecialty, referral.toFacility].filter(Boolean).join(', ')}</Line>
          <Line label="Срочность">{URGENCY[referral.urgency]}</Line>
          <Line label="Диагноз">{[referral.diagnosis, referral.icdCode ? `(МКБ-10: ${referral.icdCode})` : ''].filter(Boolean).join(' ')}</Line>
          <Line label="Цель направления">{referral.purpose}</Line>
          <Line label="Проведённое обследование и отметки">{referral.notes}</Line>
          <Line label="Действительно до">{fmtDate(referral.validUntil)}</Line>
        </tbody>
      </table>

      <div className="ref-sign">
        <div>
          <span className="ref-small">Врач</span>
          <strong>{referral.doctor?.name}{referral.doctor?.specialty ? `, ${referral.doctor.specialty}` : ''}</strong>
          <span className="ref-line">Подпись</span>
          <span className="ref-small">Дата {fmtDate(referral.issuedAt)}</span>
        </div>
        <div className="ref-stamp" aria-label="Место для печати">М.П.</div>
      </div>
    </PrintSheet>
  );
}
