import { useEffect, useState } from 'react';
import { Link, useLocation, useNavigate, useParams } from 'react-router-dom';
import { fetchDoctor, getErrorMessage, isCanceled } from '../api';
import { profileFor, yearsWord } from '../data/doctorProfiles';
import { fullName, shortName } from '../utils/appointments';
import { readPendingSlot, updatePendingSlot } from '../utils/pendingSlot';
import Banner from '../ui/Banner';
import Button from '../ui/Button';
import DoctorPhoto from '../ui/DoctorPhoto';
import Icon from '../ui/Icon';
import Spinner from '../ui/Spinner';

function Timeline({ items, render }) {
  return (
    <ol className="timeline">
      {items.map((item, index) => (
        <li key={index}>
          <span className="timeline-year">{render.when(item)}</span>
          <div>
            <strong>{render.title(item)}</strong>
            <span>{render.note(item)}</span>
          </div>
        </li>
      ))}
    </ol>
  );
}

// Профиль врача (статический): кто это, где учился и работал, чем может помочь.
// Выбранные на главной врач, дата и время сохраняются, поэтому вернуться можно по хлебным крошкам или кнопке «Назад».
export default function DoctorPage() {
  const { id } = useParams();
  const navigate = useNavigate();
  const location = useLocation();
  const [state, setState] = useState({ status: 'loading', doctor: null, error: '' });
  const [reloadKey, setReloadKey] = useState(0);

  useEffect(() => {
    const controller = new AbortController();
    fetchDoctor(id, controller.signal)
      .then((doctor) => setState({ status: 'ready', doctor, error: '' }))
      .catch((error) => { if (!isCanceled(error)) setState({ status: 'error', doctor: null, error: getErrorMessage(error) }); });
    return () => controller.abort();
  }, [id, reloadKey]);

  // при прямом заходе по ссылке имя врача в хлебных крошках появляется после загрузки
  const loadedName = state.doctor ? shortName(state.doctor) : null;
  useEffect(() => {
    if (loadedName && location.state?.name !== loadedName) navigate(location.pathname, { replace: true, state: { name: loadedName } });
  }, [loadedName, location.pathname, location.state?.name, navigate]);

  if (state.status === 'loading') {
    return <section className="card"><div className="state"><div className="state-loading"><Spinner size={22} /><span>Загружаем профиль врача…</span></div></div></section>;
  }
  if (state.status === 'error') {
    return (
      <Banner kind="error" title="Не удалось загрузить профиль" action={<Button size="sm" onClick={() => { setState({ status: 'loading', doctor: null, error: '' }); setReloadKey((k) => k + 1); }}>Повторить</Button>}>
        {state.error}
      </Banner>
    );
  }

  const { doctor } = state;
  const profile = profileFor(doctor);

  // «Записаться к этому врачу»: подставляем врача в черновик (дату и время сохраняем, если врач тот же)
  function chooseDoctor() {
    const draft = readPendingSlot();
    updatePendingSlot(draft?.doctorId === doctor.id ? draft : { doctorId: doctor.id, date: null, time: null });
    navigate('/');
  }

  return (
    <>
      <title>{`${fullName(doctor)} — Твой талон`}</title>
      <section className="card doctor-hero">
        <DoctorPhoto look={profile.look} photo={profile.photo} size={168} rounded={20} label={fullName(doctor)} />
        <div className="doctor-hero-main">
          <span className="doctor-badge">{doctor.specialty?.name}</span>
          <h1>{fullName(doctor)}</h1>
          <p className="doctor-position">{profile.position}</p>
          <blockquote>«{profile.quote}»</blockquote>
          <div className="doctor-facts">
            <span><Icon name="award" size={15} /> Стаж {profile.experience} {yearsWord(profile.experience)}</span>
            <span><Icon name="clock" size={15} /> Практика с {profile.startYear} года</span>
            <span><Icon name="user" size={15} /> {profile.languages.join(', ')}</span>
          </div>
          <div className="doctor-actions">
            <Button variant="primary" icon="calendar" onClick={chooseDoctor}>Записаться к врачу</Button>
            <Link to="/" className="btn btn-secondary"><Icon name="arrowLeft" size={16} />Назад к записи</Link>
          </div>
        </div>
      </section>

      <div className="doctor-cols">
        <div className="stack">
          <section className="card section">
            <h2>О враче</h2>
            <p className="section-text">{profile.about}</p>
          </section>
          <section className="card section">
            <h2>С чем можно обратиться</h2>
            <ul className="check-list">
              {profile.focus.map((item) => <li key={item}><Icon name="check" size={15} strokeWidth={3} />{item}</li>)}
            </ul>
          </section>
          <section className="card section">
            <h2>Достижения</h2>
            <ul className="check-list star">
              {profile.achievements.map((item) => <li key={item}><Icon name="award" size={15} />{item}</li>)}
            </ul>
          </section>
        </div>
        <div className="stack">
          <section className="card section">
            <h2>Образование</h2>
            <Timeline items={profile.education} render={{ when: (i) => i.year, title: (i) => i.title, note: (i) => i.note }} />
          </section>
          <section className="card section">
            <h2>Опыт работы</h2>
            <Timeline items={profile.career} render={{ when: (i) => i.years, title: (i) => i.place, note: (i) => i.role }} />
          </section>
        </div>
      </div>
    </>
  );
}
