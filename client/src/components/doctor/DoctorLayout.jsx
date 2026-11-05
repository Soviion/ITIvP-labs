import { useEffect, useState } from 'react';
import { Link, NavLink, Outlet, useLocation } from 'react-router-dom';
import { getErrorMessage, isCanceled } from '../../api';
import { useAuth } from '../../auth/context';
import { fetchDoctorMe } from '../../doctorApi';
import Icon from '../../ui/Icon';
import RetryBanner from '../../ui/RetryBanner';
import VisionToggle from '../../vision/VisionToggle';
import { useToast } from '../../ui/toastContext';
import '../../doctor.css';

export function ClinicMark({ size = 26 }) {
  return (
    <svg width={size} height={size} viewBox="0 0 32 32" aria-hidden="true" className="dr-mark">
      <rect width="32" height="32" rx="3" fill="currentColor" />
      <path d="M13 7h6v6h6v6h-6v6h-6v-6H7v-6h6z" fill="#fff" />
    </svg>
  );
}

// Разделы кабинета: «Записи» подсвечивается и на странице пациента, потому что она открывается из списка записей
const NAV = [
  { to: '/doctor', label: 'Записи', end: true, also: '/doctor/patients' },
  { to: '/doctor/profile', label: 'Профиль' },
  { to: '/doctor/settings', label: 'Настройки', adminOnly: true },
];

// Оболочка кабинета врача: своя шапка («Моя клиника»), без навигации для пациентов
export default function DoctorLayout() {
  const { signOut, isAdmin } = useAuth();
  const toast = useToast();
  const { pathname } = useLocation();
  const [doctor, setDoctor] = useState(null);
  const [problem, setProblem] = useState('');

  useEffect(() => { window.scrollTo(0, 0); }, [pathname]);

  useEffect(() => {
    const controller = new AbortController();
    fetchDoctorMe(controller.signal)
      .then(setDoctor)
      .catch((error) => { if (!isCanceled(error)) setProblem(getErrorMessage(error)); });
    return () => controller.abort();
  }, []);

  return (
    <div className="dr-shell">
      <header className="dr-top">
        <div className="dr-top-inner">
          <Link to="/doctor" className="dr-brand" aria-label="Моя клиника — записи ко мне">
            <ClinicMark />
            <span><strong>Моя клиника</strong><small>кабинет врача</small></span>
          </Link>
          <nav className="dr-nav" aria-label="Разделы кабинета">
            {NAV.filter((item) => !item.adminOnly || isAdmin).map((item) => (
              <NavLink
                key={item.to}
                to={item.to}
                end={item.end}
                className={({ isActive }) => `dr-nav-link ${isActive || (item.also && pathname.startsWith(item.also)) ? 'is-active' : ''}`}
              >
                {item.label}
              </NavLink>
            ))}
          </nav>
          <div className="dr-who">
            {doctor ? (
              <span className="dr-who-text"><strong>{doctor.name}</strong><small>{doctor.role === 'admin' ? 'Полный доступ' : doctor.specialty}</small></span>
            ) : (
              <span className="dr-who-text"><small>{problem || 'Загрузка…'}</small></span>
            )}
            <VisionToggle className="btn btn-secondary btn-sm a11y-btn" />
            <button type="button" className="btn btn-secondary btn-sm" onClick={() => { signOut(); toast.info('Вы вышли из аккаунта'); }}>
              <Icon name="logout" size={15} /><span>Выйти</span>
            </button>
          </div>
        </div>
        <RetryBanner />
      </header>

      <main className="dr-main" id="main-content" tabIndex={-1}>
        <Outlet context={{ doctor }} />
      </main>

      <footer className="dr-foot">
        <div className="dr-foot-inner">
          <span>Моя клиника · рабочее место врача</span>
          <Link to="/">Сайт для пациентов «Твой талон»</Link>
        </div>
      </footer>
    </div>
  );
}
