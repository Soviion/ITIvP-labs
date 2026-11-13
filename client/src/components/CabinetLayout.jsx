import { NavLink, Outlet } from 'react-router-dom';
import { useAuth } from '../auth/context';
import { useUnread } from '../realtime/hooks';
import NotificationBadge from '../ui/NotificationBadge';

const TABS = [
  { to: 'tickets', label: 'Мои талоны', patientOnly: true },
  { to: 'card', label: 'Медицинская карта', patientOnly: true },
  { to: 'history', label: 'История болезни', patientOnly: true },
  { to: 'questions', label: 'Мои вопросы', patientOnly: true, badge: true },
  { to: 'settings', label: 'Настройки' },
];

export default function CabinetLayout() {
  const { isStaff } = useAuth();
  const unread = useUnread();
  return (
    <div className="cabinet">
      <nav className="tabs cabinet-tabs" aria-label="Разделы личного кабинета">
        {TABS.filter((tab) => !(isStaff && tab.patientOnly)).map((tab) => (
          <NavLink key={tab.to} to={tab.to} className="tab">
            {tab.label}
            {tab.badge && <NotificationBadge count={unread.total} unit="непрочитанных бесед" />}
          </NavLink>
        ))}
      </nav>
      <Outlet />
    </div>
  );
}
