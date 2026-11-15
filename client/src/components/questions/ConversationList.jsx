import NotificationBadge from '../../ui/NotificationBadge';

const stamp = (iso) => {
  if (!iso) return '';
  const date = new Date(iso);
  const today = new Date();
  return date.toDateString() === today.toDateString()
    ? date.toLocaleTimeString('ru-RU', { hour: '2-digit', minute: '2-digit' })
    : date.toLocaleDateString('ru-RU');
};

// Список бесед: у каждой собеседник, последнее сообщение и красный кружок с числом непрочитанных
export default function ConversationList({ items, onOpen }) {
  return (
    <ul className="qa-conv-list">
      {items.map((item) => (
        <li key={item.id}>
          <button type="button" className={`qa-conv ${item.unread ? 'has-unread' : ''}`} onClick={() => onOpen(item)}>
            <span className="qa-conv-main">
              <strong>{item.counterpart.name}</strong>
              <span className="qa-conv-sub">{item.counterpart.subtitle}</span>
              <span className="qa-conv-last">{item.lastFrom === item.side ? 'Вы: ' : ''}{item.lastText}</span>
            </span>
            <span className="qa-conv-side">
              <time dateTime={item.lastMessageAt}>{stamp(item.lastMessageAt)}</time>
              <NotificationBadge count={item.unread} unit="непрочитанных сообщений" />
            </span>
          </button>
        </li>
      ))}
    </ul>
  );
}
