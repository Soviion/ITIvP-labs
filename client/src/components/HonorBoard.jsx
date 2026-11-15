import { useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { profileFor, yearsWord } from '../data/doctorProfiles';
import { fullName, shortName } from '../utils/appointments';
import DoctorPhoto from '../ui/DoctorPhoto';
import Icon from '../ui/Icon';
import Spinner from '../ui/Spinner';

// Детерминированный «случайный» порядок: при каждом открытии или обновлении страницы зерно новое
function shuffled(list, seed) {
  let state = Math.floor(seed * 2 ** 31) || 1;
  const next = () => { state = (state * 1664525 + 1013904223) % 2 ** 32; return state / 2 ** 32; };
  const result = [...list];
  for (let i = result.length - 1; i > 0; i -= 1) {
    const j = Math.floor(next() * (i + 1));
    [result[i], result[j]] = [result[j], result[i]];
  }
  return result;
}

// «Доска почёта»: до трёх случайных врачей с фото, должностью и кнопкой «Подробнее»
export default function HonorBoard({ doctors }) {
  const [seed] = useState(Math.random);
  const picked = useMemo(() => shuffled(doctors.list, seed).slice(0, 3), [doctors.list, seed]);

  return (
    <section className="card side-card honor" aria-label="Доска почёта">
      <header>
        <h2><Icon name="award" size={17} /> Доска почёта</h2>
        <span className="honor-sub">наши врачи</span>
      </header>
      {(doctors.status === 'loading' || (doctors.status === 'error' && !doctors.error)) && <div className="state-loading"><Spinner size={18} />Загружаем…</div>}
      {doctors.status === 'error' && doctors.error && <p className="muted">Не удалось загрузить врачей.</p>}
      <ul>
        {picked.map((doctor) => {
          const profile = profileFor(doctor);
          return (
            <li key={doctor.id} className="honor-item">
              <DoctorPhoto look={profile.look} photo={profile.photo} size={56} rounded={12} label={fullName(doctor)} />
              <div className="honor-info">
                <strong>{fullName(doctor)}</strong>
                <span>{profile.position}</span>
                <span className="honor-exp">Стаж {profile.experience} {yearsWord(profile.experience)}</span>
              </div>
              <Link to={`/doctors/${doctor.id}`} state={{ name: shortName(doctor) }} className="btn btn-secondary btn-sm">Подробнее</Link>
            </li>
          );
        })}
      </ul>
    </section>
  );
}
