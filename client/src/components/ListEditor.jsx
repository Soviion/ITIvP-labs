import { useState } from 'react';
import Button from '../ui/Button';
import Icon from '../ui/Icon';

// Редактируемый список (заболевания, препараты): добавление и удаление элементов.
// onChange(новыйСписок) родитель применяет оптимистично и сам откатывает при ошибке.
export default function ListEditor({ title, hint, items, placeholder, emptyText, onChange }) {
  const [draft, setDraft] = useState('');
  const [error, setError] = useState('');

  function add(event) {
    event.preventDefault();
    const text = draft.trim().replace(/\s+/g, ' ');
    if (!text) return;
    if (text.length > 120) { setError('Не длиннее 120 символов'); return; }
    if (items.some((item) => item.toLowerCase() === text.toLowerCase())) { setError('Такая запись уже есть в списке'); return; }
    if (items.length >= 30) { setError('В списке не больше 30 записей'); return; }
    setError('');
    setDraft('');
    onChange([...items, text]);
  }

  return (
    <section className="card section">
      <header className="section-head">
        <div>
          <h2>{title}</h2>
          <p>{hint}</p>
        </div>
      </header>

      {items.length === 0 ? (
        <p className="empty-line">{emptyText}</p>
      ) : (
        <ul className="chips">
          {items.map((item) => (
            <li key={item} className="chip-item">
              <span>{item}</span>
              <button type="button" onClick={() => onChange(items.filter((other) => other !== item))} aria-label={`Удалить: ${item}`}>
                <Icon name="x" size={13} />
              </button>
            </li>
          ))}
        </ul>
      )}

      <form onSubmit={add} className="add-row" noValidate>
        <div className={`field ${error ? 'has-error' : ''}`}>
          <input
            value={draft}
            onChange={(event) => { setDraft(event.target.value); setError(''); }}
            placeholder={placeholder}
            aria-label={title}
            maxLength={120}
          />
          {error && <p className="field-error" role="alert">{error}</p>}
        </div>
        <Button type="submit" icon="plus" disabled={!draft.trim()}>Добавить</Button>
      </form>
    </section>
  );
}
