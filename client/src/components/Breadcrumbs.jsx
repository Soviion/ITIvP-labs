import { Fragment } from 'react';
import { Link, useLocation, useMatch } from 'react-router-dom';
import Icon from '../ui/Icon';

const HOME = { to: '/', label: 'Главная' };
const CABINET = { to: '/cabinet/card', label: 'Личный кабинет' };

const TRAILS = {
  '/register': [HOME, { label: 'Регистрация' }],
  '/cabinet/card': [HOME, CABINET, { label: 'Медицинская карта' }],
  '/cabinet/tickets': [HOME, CABINET, { label: 'Мои талоны' }],
  '/cabinet/history': [HOME, CABINET, { label: 'История болезни' }],
  '/cabinet/settings': [HOME, CABINET, { label: 'Настройки' }],
  '/staff': [HOME, { label: 'Регистратура' }],
  '/contacts': [HOME, { label: 'Контакты и FAQ' }],
};

export default function Breadcrumbs() {
  const { pathname, state } = useLocation();
  const doctorPage = useMatch('/doctors/:id');
  const visitPage = useMatch('/cabinet/history/:visitId');
  // профиль врача: имя передаётся из ссылки (state), пока оно неизвестно — общая подпись
  const trail = doctorPage
    ? [HOME, { label: `Врач: ${state?.name ?? 'профиль'}` }]
    : visitPage
      ? [HOME, CABINET, { to: '/cabinet/history', label: 'История болезни' }, { label: 'Приём' }]
      : TRAILS[pathname.replace(/\/+$/, '') || '/'];
  if (!trail) return null;

  return (
    <nav className="breadcrumbs" aria-label="Хлебные крошки">
      <ol>
        {trail.map((crumb, index) => {
          const last = index === trail.length - 1;
          return (
            <Fragment key={crumb.label}>
              <li>
                {last || !crumb.to
                  ? <span aria-current="page">{crumb.label}</span>
                  : <Link to={crumb.to}>{index === 0 && <Icon name="home" size={14} />}{crumb.label}</Link>}
              </li>
              {!last && <li className="crumb-sep" aria-hidden="true"><Icon name="chevronRight" size={14} /></li>}
            </Fragment>
          );
        })}
      </ol>
    </nav>
  );
}
