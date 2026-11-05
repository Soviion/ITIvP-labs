import { NavLink, Outlet } from 'react-router-dom';
import { useAuth } from '../auth/context';

const TABS = [
  { to: 'tickets', label: 'Мои талоны', patientOnly: true },
  { to: 'card', label: 'Медицинская карта', patientOnly: true },
  { to: 'history', label: 'История болезни', patientOnly: true },
  { to: 'settings', label: 'Настройки' },
];

export default function CabinetLayout() {
  const { isStaff } = useAuth();
  return (
    <div className="cabinet">
      <nav className="tabs cabinet-tabs" aria-label="Разделы личного кабинета">
        {TABS.filter((tab) => !(isStaff && tab.patientOnly)).map((tab) => (
          <NavLink key={tab.to} to={tab.to} className="tab">{tab.label}</NavLink>
        ))}
      </nav>
      <Outlet />
    </div>
  );
}
