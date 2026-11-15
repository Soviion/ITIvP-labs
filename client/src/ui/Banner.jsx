import Icon from './Icon';

const ICON = { error: 'alert', warn: 'alert', info: 'info', success: 'check' };

// Встроенное сообщение внутри формы или страницы: kind = error | warn | info | success
export default function Banner({ kind = 'info', title, children, action }) {
  // пустой текст ошибки (нет связи с сервером) – баннер не показываем, об этом говорит окно «Нет связи»
  if (children === '') return null;
  return (
    <div className={`banner banner-${kind}`} role={kind === 'error' ? 'alert' : 'status'}>
      <Icon name={ICON[kind]} size={18} className="banner-icon" />
      <div className="banner-body">
        {title && <strong>{title}</strong>}
        {children && <div>{children}</div>}
      </div>
      {action && <div className="banner-action">{action}</div>}
    </div>
  );
}
