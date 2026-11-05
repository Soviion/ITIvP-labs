import { useCallback, useEffect, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { getErrorMessage, getFieldErrors, getStatus, isCanceled } from '../../api';
import CardSheet from '../../components/doctor/CardSheet';
import { draftToPayload, hasChanges, makeDraft } from '../../components/doctor/cardDraft';
import { ageText, dotDate, fmtDate } from '../../components/doctor/format';
import { PatientMark, StatusTag } from '../../components/doctor/PatientBadge';
import { printSheet } from '../../components/doctor/openPrint';
import ReferralModal from '../../components/doctor/ReferralModal';
import ReferralSheet from '../../components/doctor/ReferralSheet';
import VisitModal from '../../components/doctor/VisitModal';
import {
  createCard, downloadCardDocx, downloadReferralDocx, fetchCard, fetchDoctorPatient, fetchPatientPhoto, updateCard,
} from '../../doctorApi';
import Banner from '../../ui/Banner';
import Button from '../../ui/Button';
import Icon from '../../ui/Icon';
import Spinner from '../../ui/Spinner';
import { useToast } from '../../ui/toastContext';
import { SOCIAL_LABELS } from '../../utils/patient';

const GENDER = { male: 'Мужской', female: 'Женский' };

function Info({ label, children }) {
  return (
    <div>
      <dt>{label}</dt>
      <dd>{children || <span className="not-set">не указано</span>}</dd>
    </div>
  );
}

const joinList = (list) => (Array.isArray(list) && list.length ? list.join('; ') : '');

// Своё фото пациента: загружаем как blob (нужен токен), аватар-стикер на документ не идёт
function usePatientPhoto(patientId, avatar) {
  const [url, setUrl] = useState(null);
  const hasPhoto = avatar?.kind === 'photo';
  const version = avatar?.version;

  useEffect(() => {
    if (!hasPhoto) return undefined;
    const controller = new AbortController();
    let created = null;
    fetchPatientPhoto(patientId, controller.signal)
      .then((blob) => {
        created = URL.createObjectURL(blob);
        setUrl(created);
      })
      .catch(() => { /* без фото документ просто покажет рамку «Нет фото» */ });
    return () => {
      controller.abort();
      if (created) URL.revokeObjectURL(created);
      setUrl(null);
    };
  }, [patientId, hasPhoto, version]);

  return hasPhoto ? url : null;
}

// Профиль пациента из PostgreSQL: то, что пациент указал сам
function ProfilePanel({ data }) {
  const { patient, record, appointments } = data;
  const [showAll, setShowAll] = useState(false);
  const VISIBLE = 2; // сначала показываем две последние записи, остальные раскрываются стрелкой
  const shown = showAll ? appointments : appointments.slice(0, VISIBLE);
  const hidden = appointments.length - VISIBLE;
  return (
    <section className="card dr-profile">
      <header className="dr-panel-head">
        <h2>Профиль пациента</h2>
        <span className="dr-sub">заполнен самим пациентом</span>
      </header>
      <dl className="dr-info">
        <Info label="ФИО">{patient.fullName}</Info>
        <Info label="Пол">{GENDER[patient.gender]}</Info>
        <Info label="Дата рождения">{`${dotDate(patient.birthDate)} (${ageText(patient.birthDate)})`}</Info>
        <Info label="Телефон">{patient.phone}</Info>
        <Info label="E-mail">{patient.email}</Info>
        <Info label="Адрес">{patient.address}</Info>
        <Info label="Социальный статус">{SOCIAL_LABELS[patient.socialStatus]}</Info>
        <Info label="Место работы или учёбы">{patient.workplace}</Info>
        <Info label="Номер полиса">{patient.insuranceNumber}</Info>
        <Info label="Доверенное лицо">{patient.trustedPerson}</Info>
      </dl>

      <h3 className="dr-subhead">Медицинские данные</h3>
      <dl className="dr-info">
        <Info label="Группа крови">{record?.bloodType}</Info>
        <Info label="Рост">{record?.heightCm ? `${record.heightCm} см` : ''}</Info>
        <Info label="Вес">{record?.weightKg ? `${record.weightKg} кг` : ''}</Info>
        <Info label="Заболевания">{joinList(record?.diseases)}</Info>
        <Info label="Препараты">{joinList(record?.medications)}</Info>
        <Info label="Аллергии">{record?.allergies}</Info>
      </dl>

      <h3 className="dr-subhead">Записи к вам</h3>
      {appointments.length === 0 ? <p className="dr-sub dr-pad">Записей нет</p> : (
        <>
          <ul className="dr-visits">
            {shown.map((item) => (
              <li key={item.id}>
                <span>{dotDate(item.date)} в {item.time}</span>
                <StatusTag status={item.status} />
              </li>
            ))}
          </ul>
          {hidden > 0 && (
            <button type="button" className={`dr-more ${showAll ? 'is-open' : ''}`} aria-expanded={showAll} onClick={() => setShowAll((value) => !value)}>
              <Icon name="chevronDown" size={14} />
              {showAll ? 'Свернуть' : `Ещё ${hidden}`}
            </button>
          )}
        </>
      )}
    </section>
  );
}

// Личное дело в MongoDB: предпросмотр листа, редактирование, приёмы, направления, Word и печать
function CardPanel({ patientId, data, card, setCard, reload }) {
  const toast = useToast();
  const photoUrl = usePatientPhoto(patientId, data.patient.avatar);
  const [tab, setTab] = useState('document'); // document | referrals
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(null);
  const [saving, setSaving] = useState(false);
  const [formError, setFormError] = useState('');
  const [busy, setBusy] = useState('');
  const [visitOpen, setVisitOpen] = useState(false);
  const [referralOpen, setReferralOpen] = useState(false);
  const [selected, setSelected] = useState(null);

  const referrals = card.referrals ?? [];
  const current = referrals.find((item) => item._id === selected) ?? referrals[referrals.length - 1] ?? null;
  const freeAppointments = data.appointments.filter((item) => item.status === 'scheduled' && !(card.visits ?? []).some((visit) => visit.appointmentId === item.id));

  function startEdit() {
    setTab('document');
    setDraft(makeDraft(card));
    setFormError('');
    setEditing(true);
  }

  async function save() {
    setSaving(true);
    setFormError('');
    try {
      setCard(await updateCard(patientId, draftToPayload(draft, card)));
      setEditing(false);
      toast.success('Личное дело сохранено');
    } catch (error) {
      const fields = Object.values(getFieldErrors(error));
      setFormError([getErrorMessage(error), ...fields.slice(0, 2)].join(' — '));
    } finally {
      setSaving(false);
    }
  }

  async function download(kind, referralId) {
    setBusy(kind);
    try {
      const name = referralId ? await downloadReferralDocx(patientId, referralId) : await downloadCardDocx(patientId);
      toast.success(`Файл «${name}» сохранён`);
    } catch (error) {
      toast.error(getErrorMessage(error), { title: 'Не удалось скачать' });
    } finally {
      setBusy('');
    }
  }

  async function print(id) {
    try {
      await printSheet(id);
    } catch {
      toast.error('Не удалось открыть окно печати', { title: 'Печать' });
    }
  }

  return (
    <section className="card dr-card-panel">
      <header className="dr-panel-head dr-panel-head-row">
        <div>
          <h2>Личное дело</h2>
          <span className="dr-sub">карта № {card.cardNumber}</span>
        </div>
        {tab === 'document' && !editing && (
          <div className="dr-head-actions">
            <Button icon="download" loading={busy === 'card'} onClick={() => download('card')}>Скачать Word</Button>
            <Button icon="copy" onClick={() => print('card')}>Печать</Button>
          </div>
        )}
      </header>

      <div className="tabs" role="group" aria-label="Разделы личного дела">
        <button type="button" aria-pressed={tab === 'document'} className={`tab ${tab === 'document' ? 'is-active' : ''}`} onClick={() => setTab('document')}>Документ</button>
        <button type="button" aria-pressed={tab === 'referrals'} className={`tab ${tab === 'referrals' ? 'is-active' : ''}`} onClick={() => setTab('referrals')} disabled={editing}>
          Направления<span className="tab-count">{referrals.length}</span>
        </button>
      </div>

      {tab === 'document' && (
        <>
          <div className="dr-actions-bar">
            {editing ? (
              <>
                <Button variant="primary" icon="check" loading={saving} disabled={!hasChanges(draft, card)} onClick={save}>Сохранить</Button>
                <Button onClick={() => setEditing(false)} disabled={saving}>Отмена</Button>
              </>
            ) : (
              <>
                <Button icon="pencil" onClick={startEdit}>Заполнить / изменить</Button>
                <Button variant="primary" icon="plus" onClick={() => setVisitOpen(true)}>Добавить приём</Button>
                <Button icon="list" onClick={() => setReferralOpen(true)}>Выписать направление</Button>
              </>
            )}
          </div>
          {editing && (
            <div className="dr-gap">
              <Banner kind="info">Заполните пустые поля прямо в документе. ФИО, дата рождения и пол берутся из профиля пациента.</Banner>
            </div>
          )}
          {formError && <div className="dr-gap"><Banner kind="error">{formError}</Banner></div>}
          <div className="dr-paper">
            <CardSheet card={card} photoUrl={photoUrl} editing={editing} draft={draft} onDraft={setDraft} />
          </div>
        </>
      )}

      {tab === 'referrals' && (
        <>
          <div className="dr-actions-bar">
            <Button variant="primary" icon="plus" onClick={() => setReferralOpen(true)}>Выписать направление</Button>
            {current && (
              <>
                <span className="dr-spacer" />
                <Button icon="download" loading={busy === 'referral'} onClick={() => download('referral', current._id)}>Скачать Word</Button>
                <Button icon="copy" onClick={() => print(`referral-${current._id}`)}>Печать</Button>
              </>
            )}
          </div>

          {referrals.length === 0 ? (
            <div className="state state-center">
              <span className="state-icon"><Icon name="list" size={26} /></span>
              <h3>Направлений пока нет</h3>
              <p>Выпишите направление к специалисту или на исследование — оно сразу сохранится в личном деле.</p>
            </div>
          ) : (
            <>
              <ul className="dr-ref-list">
                {[...referrals].reverse().map((item) => (
                  <li key={item._id}>
                    <button type="button" className={current?._id === item._id ? 'is-active' : ''} onClick={() => setSelected(item._id)}>
                      <strong>№ {item.number}</strong>
                      <span>{item.toSpecialty}</span>
                      <small>{fmtDate(item.issuedAt)}{item.urgency === 'urgent' ? ' · срочно' : ''}</small>
                    </button>
                  </li>
                ))}
              </ul>
              <div className="dr-paper">
                <ReferralSheet card={card} referral={current} />
              </div>
            </>
          )}
        </>
      )}

      {visitOpen && (
        <VisitModal
          open
          patientId={patientId}
          appointments={freeAppointments}
          onClose={() => setVisitOpen(false)}
          onSaved={(updated, linked) => {
            setCard(updated);
            setVisitOpen(false);
            toast.success('Приём добавлен в личное дело');
            if (linked) reload(); // статус записи изменился
          }}
        />
      )}
      {referralOpen && (
        <ReferralModal
          open
          patientId={patientId}
          lastVisit={(card.visits ?? [])[(card.visits ?? []).length - 1]}
          onClose={() => setReferralOpen(false)}
          onSaved={(updated) => {
            setCard(updated);
            setReferralOpen(false);
            setSelected(null);
            setTab('referrals');
            toast.success('Направление выписано');
          }}
        />
      )}
    </section>
  );
}

export default function DoctorPatientPage() {
  const { patientId } = useParams();
  const toast = useToast();
  const [data, setData] = useState(null);
  const [card, setCard] = useState(null);
  const [phase, setPhase] = useState('loading'); // loading | ready | error | denied | missing
  const [error, setError] = useState('');
  const [attempt, setAttempt] = useState(0);
  const [creating, setCreating] = useState(false);

  const reload = useCallback(() => setAttempt((n) => n + 1), []);

  useEffect(() => {
    const controller = new AbortController();
    setPhase((prev) => (prev === 'ready' ? prev : 'loading'));
    (async () => {
      try {
        const info = await fetchDoctorPatient(patientId, controller.signal);
        const full = info.card ? await fetchCard(patientId, controller.signal) : null;
        setData(info);
        setCard(full);
        setPhase('ready');
      } catch (err) {
        if (isCanceled(err)) return;
        const status = getStatus(err);
        setError(getErrorMessage(err));
        setPhase(status === 403 ? 'denied' : status === 404 ? 'missing' : 'error');
      }
    })();
    return () => controller.abort();
  }, [patientId, attempt]);

  async function create() {
    setCreating(true);
    try {
      setCard(await createCard(patientId));
      toast.success('Личное дело создано');
    } catch (err) {
      toast.error(getErrorMessage(err), { title: 'Не удалось создать личное дело' });
    } finally {
      setCreating(false);
    }
  }

  const back = <Link to="/doctor" className="dr-back"><Icon name="arrowLeft" size={16} />Записи ко мне</Link>;

  if (phase === 'loading' || (phase === 'error' && !error)) {
    return (
      <>
        {back}
        <div className="state" role="status"><div className="state-loading"><Spinner size={22} /><span>Загружаем данные пациента…</span></div></div>
      </>
    );
  }

  if (phase === 'denied' || phase === 'missing' || phase === 'error') {
    const title = { denied: 'Нет доступа к пациенту', missing: 'Пациент не найден', error: 'Не удалось загрузить данные' }[phase];
    return (
      <>
        {back}
        <section className="card">
          <div className="state state-center" role="alert">
            <span className="state-icon state-icon-error"><Icon name={phase === 'error' ? 'wifiOff' : 'lock'} size={26} /></span>
            <h3>{title}</h3>
            <p>{phase === 'denied' ? 'Вы можете открывать только тех пациентов, которые записаны к вам на приём.' : error}</p>
            {phase === 'error' ? <Button variant="primary" icon="refresh" onClick={reload}>Повторить</Button> : <Link className="btn btn-secondary" to="/doctor">К списку записей</Link>}
          </div>
        </section>
      </>
    );
  }

  const { patient } = data;
  return (
    <>
      <title>{`${patient.fullName} — Моя клиника`}</title>
      {back}
      <div className="dr-patient-head">
        <PatientMark patient={patient} size={52} />
        <div>
          <h1>{patient.fullName}</h1>
          <p>{ageText(patient.birthDate)} · {GENDER[patient.gender]} · {patient.phone}</p>
        </div>
      </div>

      <div className="dr-columns">
        <ProfilePanel data={data} />

        {!data.mongoAvailable && !card ? (
          <section className="card dr-card-panel">
            <Banner kind="warn" title="Личные дела временно недоступны" action={<Button size="sm" onClick={reload}>Повторить</Button>}>
              Личное дело пока не открывается. Профиль пациента слева доступен.
            </Banner>
          </section>
        ) : card ? (
          <CardPanel patientId={patientId} data={data} card={card} setCard={setCard} reload={reload} />
        ) : (
          <section className="card dr-card-panel">
            <div className="state state-center">
              <span className="state-icon"><Icon name="user" size={26} /></span>
              <h3>Личное дело ещё не создано</h3>
              <p>Дело создаётся на основе профиля пациента: все данные, которые он указал сам, попадут в документ. Остальное вы заполните на осмотре.</p>
              <Button variant="primary" icon="plus" loading={creating} onClick={create}>Создать личное дело</Button>
            </div>
          </section>
        )}
      </div>
    </>
  );
}
