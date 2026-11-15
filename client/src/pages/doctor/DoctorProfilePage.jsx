import { useEffect, useState } from 'react';
import { getErrorMessage, isCanceled } from '../../api';
import { profileFor, yearsWord } from '../../data/doctorProfiles';
import { fetchDoctorMe } from '../../doctorApi';
import Banner from '../../ui/Banner';
import Button from '../../ui/Button';
import DoctorPhoto from '../../ui/DoctorPhoto';
import Spinner from '../../ui/Spinner';

const NOT_SET = <span className="not-set">не указано</span>;

function Row({ label, children }) {
  return (
    <div>
      <dt>{label}</dt>
      <dd>{children || NOT_SET}</dd>
    </div>
  );
}

// Сервер отдаёт ФИО одной строкой «Фамилия Имя Отчество» — для описания врача нужны части
function splitName(name = '') {
  const [lastName = '', firstName = '', ...rest] = name.split(/\s+/);
  return { lastName, firstName, middleName: rest.join(' ') || null };
}

function List({ title, items }) {
  if (!items?.length) return null;
  return (
    <section className="dr-profile-block">
      <h3 className="dr-subhead">{title}</h3>
      <ul className="dr-profile-list">{items.map((item) => <li key={item}>{item}</li>)}</ul>
    </section>
  );
}

// Профиль врача: пока заглушка только для чтения, данные берутся из справочника врачей и его описания.
// Редактирование появится позже.
export default function DoctorProfilePage() {
  const [state, setState] = useState({ phase: 'loading', doctor: null, error: '' });

  useEffect(() => {
    const controller = new AbortController();
    fetchDoctorMe(controller.signal)
      .then((doctor) => setState({ phase: 'ready', doctor, error: '' }))
      .catch((error) => { if (!isCanceled(error)) setState({ phase: 'error', doctor: null, error: getErrorMessage(error) }); });
    return () => controller.abort();
  }, []);

  const { doctor } = state;
  const isAdmin = doctor?.role === 'admin';
  const filled = Boolean(doctor?.profileFilled);

  const profile = filled
    ? profileFor({ id: doctor.id, email: doctor.email, specialty: { name: doctor.specialty }, ...splitName(doctor.name) })
    : null;

  let content;
  if (state.phase === 'loading') {
    content = <div className="state" role="status"><div className="state-loading"><Spinner size={22} /><span>Загружаем профиль…</span></div></div>;
  } else if (state.phase === 'error') {
    content = <Banner kind="error" title="Не удалось загрузить профиль">{state.error}</Banner>;
  } else if (isAdmin) {
    content = (
      <section className="card">
        <div className="state state-center">
          <h3>Администратор</h3>
          <p>Профиль врача для этой учётной записи не ведётся. У администратора полный доступ к записям и личным делам.</p>
        </div>
      </section>
    );
  } else {
    content = (
      <section className="card dr-profile-card">
        <div className="dr-profile-top">
          {profile
            ? <DoctorPhoto look={profile.look} photo={profile.photo} size={120} rounded={4} label={doctor.name} />
            : <span className="dr-profile-empty-photo" aria-hidden="true" />}
          <div>
            <h2>{doctor.name || NOT_SET}</h2>
            <p className="muted">{profile?.position ?? doctor.specialty ?? 'Специальность не указана'}</p>
            {profile && <p className="dr-sub">Стаж {profile.experience} {yearsWord(profile.experience)}</p>}
          </div>
          <Button icon="pencil" disabled title="Редактирование появится позже">Редактировать</Button>
        </div>

        <Banner kind="info">Редактирование профиля появится позже. Пока данные подтягиваются из справочника врачей.</Banner>

        {!filled && (
          <div className="state state-center dr-profile-unfilled">
            <h3>Профиль ещё не заполнен</h3>
            <p>Карточка врача в справочнике клиники пока не создана. Когда она появится, здесь будут ваши данные и описание.</p>
          </div>
        )}

        <dl className="dr-info dr-info-wide">
          <Row label="ФИО">{doctor.name}</Row>
          <Row label="Специальность">{doctor.specialty}</Row>
          <Row label="Почта">{doctor.email}</Row>
          <Row label="Телефон">{doctor.phone}</Row>
        </dl>

        {profile && (
          <>
            <section className="dr-profile-block">
              <h3 className="dr-subhead">О враче</h3>
              <p className="dr-profile-text">{profile.about}</p>
            </section>
            <List title="Направления работы" items={profile.focus} />
            <List title="Образование" items={profile.education?.map((item) => `${item.year} — ${item.title}${item.note ? `, ${item.note}` : ''}`)} />
            <List title="Карьера" items={profile.career?.map((item) => `${item.years} — ${item.place}, ${item.role}`)} />
            <List title="Достижения" items={profile.achievements} />
            <List title="Языки" items={profile.languages} />
          </>
        )}
      </section>
    );
  }

  return (
    <>
      <title>Профиль — Моя клиника</title>
      <div className="page-head">
        <div>
          <h1>Профиль</h1>
          <p>Ваши данные в клинике</p>
        </div>
      </div>
      {content}
    </>
  );
}
