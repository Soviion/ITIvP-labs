import '../questions.css';

// Красный кружок с числом: «непрочитанных бесед» в меню, «непрочитанных сообщений» в списке бесед.
// Число видно глазами, а скринридеру читается текстом («, непрочитанных: 2»), потому что цвет и цифра в кружке для него не существуют
export default function NotificationBadge({ count, unit = 'непрочитанных' }) {
  if (!count) return null;
  return (
    <span className="notify-badge">
      <span aria-hidden="true">{count > 99 ? '99+' : count}</span>
      <span className="sr-only">, {unit}: {count}</span>
    </span>
  );
}
