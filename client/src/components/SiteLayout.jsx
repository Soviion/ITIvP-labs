import { useEffect, useRef, useState } from 'react';
import { Link, NavLink, Outlet, useLocation } from 'react-router-dom';
import { useAuth } from '../auth/context';
import Breadcrumbs from './Breadcrumbs';
import Avatar from '../ui/Avatar';
import Icon from '../ui/Icon';
import Logo from '../ui/Logo';
import RetryBanner from '../ui/RetryBanner';
import VisionToggle from '../vision/VisionToggle';
import { visionActions } from '../vision/vision';
import { useToast } from '../ui/toastContext';

// Пункты выпадающего списка пользователя
const PATIENT_ITEMS = [
  { to: '/cabinet/tickets', icon: 'calendar', label: 'Мои талоны' },
  { to: '/cabinet/card', icon: 'user', label: 'Моя медицинская карта' },
  { to: '/cabinet/history', icon: 'list', label: 'Моя история болезни' },
  { to: '/cabinet/settings', icon: 'shield', label: 'Настройки' },
];
const STAFF_ITEMS = [
  { to: '/staff', icon: 'calendar', label: 'Регистратура: записи' },
  { to: '/cabinet/settings', icon: 'shield', label: 'Настройки' },
];

const ADMIN_ITEMS = [
  { to: '/staff', icon: 'calendar', label: 'Регистратура: записи' },
  { to: '/doctor', icon: 'user', label: 'Кабинет врача' },
  { to: '/cabinet/settings', icon: 'shield', label: 'Настройки' },
];

// Справа в шапке: имя, кружок с выпадающим списком и кнопка «Выйти»
function UserArea() {
  const { user, patient, isStaff, isAdmin, displayName, signOut } = useAuth();
  const toast = useToast();
  const [open, setOpen] = useState(false);
  const ref = useRef(null);

  // меню закрывается по клику снаружи и по Esc
  useEffect(() => {
    if (!open) return undefined;
    const onPointer = (event) => { if (!ref.current?.contains(event.target)) setOpen(false); };
    const onKey = (event) => { if (event.key === 'Escape') setOpen(false); };
    document.addEventListener('pointerdown', onPointer);
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('pointerdown', onPointer);
      document.removeEventListener('keydown', onKey);
    };
  }, [open]);

  const items = isAdmin ? ADMIN_ITEMS : isStaff ? STAFF_ITEMS : PATIENT_ITEMS;

  return (
    <div className="user-area" ref={ref}>
      <span className="user-name">{displayName}</span>
      <button type="button" className="avatar-btn" onClick={() => setOpen((v) => !v)} aria-expanded={open} aria-label="Меню пользователя">
        <Avatar patient={patient} name={displayName} size={30} />
        <Icon name="chevronDown" size={14} />
      </button>
      {/* Это раскрывающийся список ссылок, а не «меню приложения»: role="menu" обещал бы скринридеру
          управление стрелками, которого здесь нет. Достаточно кнопки с aria-expanded и обычных ссылок */}
      {open && (
        <div className="menu">
          <div className="menu-head">
            <span>{isAdmin ? 'Администратор' : isStaff ? 'Сотрудник регистратуры' : 'Вы вошли как'}</span>
            <strong>{user.email}</strong>
            {user.twoFactorEnabled && <span className="badge badge-ok"><Icon name="shieldCheck" size={12} />2FA включена</span>}
          </div>
          {items.map((item) => (
            <NavLink key={item.to} to={item.to} className="menu-item" onClick={() => setOpen(false)}>
              <Icon name={item.icon} size={16} />{item.label}
            </NavLink>
          ))}
        </div>
      )}
      <button type="button" className="btn btn-secondary btn-sm logout-btn" onClick={() => { signOut(); toast.info('Вы вышли из аккаунта'); }}>
        <Icon name="logout" size={15} /><span>Выйти</span>
      </button>
    </div>
  );
}

export default function SiteLayout() {
  const { status, isStaff } = useAuth();
  const { pathname } = useLocation();

  // страница не перезагружается, поэтому при переходе между разделами сами возвращаемся к началу
  useEffect(() => { window.scrollTo(0, 0); }, [pathname]);

  return (
    <div className="shell">
      <header className="topbar">
        <div className="topbar-inner">
          <NavLink to="/" className="brand" aria-label="Твой талон — на главную"><Logo /></NavLink>
          <nav className="nav" aria-label="Основная навигация">
            {/* Запись на приём – главная страница, на неё ведёт логотип; в шапке быстрый доступ к разделам пациента */}
            {status === 'authed' && !isStaff && (
              <>
                <NavLink to="/cabinet/card"><Icon name="user" size={16} />Моя медицинская карта</NavLink>
                <NavLink to="/cabinet/history"><Icon name="list" size={16} />Моя история болезни</NavLink>
              </>
            )}
            {isStaff && <NavLink to="/staff"><Icon name="list" size={16} />Регистратура</NavLink>}
          </nav>
          <div className="topbar-right">
            <VisionToggle />
            {status === 'authed' ? <UserArea /> : <Link to="/" className="btn btn-secondary btn-sm">Войти</Link>}
          </div>
        </div>
        <RetryBanner />
      </header>
      <main className="content" id="main-content" tabIndex={-1}>
        <Breadcrumbs />
        <Outlet />
      </main>
      <SiteFooter onLowVision={visionActions.enable} />
    </div>
  );
}

const YEAR = new Date().getFullYear();

// Подвал сайта: о сервисе, куда идти, как связаться. Ссылка «Я врач» нарочно мелкая — она нужна не всем
function SiteFooter({ onLowVision }) {
  return (
    <footer className="site-footer">
      <div className="site-footer-inner">
        <section className="footer-about" aria-label="О сервисе">
          <strong className="footer-title">Твой талон</strong>
          <p>Онлайн-запись к врачам поликлиники. Выберите специалиста, день и время — талон появится в личном кабинете, а напоминание придёт на почту.</p>
          <p className="footer-note">Сервис не заменяет экстренную помощь. При угрозе жизни звоните <b>103</b>.</p>
        </section>

        <nav className="footer-col" aria-label="Разделы сервиса">
          <strong className="footer-title">Пациентам</strong>
          <ul>
            <li><Link to="/">Запись на приём</Link></li>
            <li><Link to="/cabinet/tickets">Мои талоны</Link></li>
            <li><Link to="/cabinet/card">Медицинская карта</Link></li>
            <li><button type="button" className="footer-link-btn" onClick={onLowVision}>Для слабовидящих</button></li>
            <li><Link to="/contacts">Контакты и FAQ</Link></li>
          </ul>
        </nav>

        <section className="footer-col" aria-label="Контакты регистратуры">
          <strong className="footer-title">Регистратура</strong>
          <dl className="footer-facts">
            <div><dt>Приём талонов</dt><dd>пн–пт, 09:00–17:00</dd></div>
            <div><dt>Перерыв</dt><dd>13:00–14:00</dd></div>
            <div><dt>Телефон</dt><dd className="mono">+375 (17) 000-00-00</dd></div>
            <div><dt>Адрес</dt><dd>г. Минск, ул. Примерная, 1</dd></div>
            <div><dt>Почта</dt><dd>help@talon.example</dd></div>
          </dl>
        </section>
      </div>

      <div className="site-footer-bar">
        <span>© {YEAR} Твой талон · Регистратура +375 (17) 000-00-00</span>
        <Link to="/doctor/login" className="footer-doctor">Я врач</Link>
      </div>
    </footer>
  );
}
