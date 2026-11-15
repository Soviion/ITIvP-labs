import { useEffect, useId, useRef } from 'react';
import Icon from './Icon';

// Обёртка над нативным <dialog>: браузер сам ловит фокус внутри окна, закрывает по Esc и рисует подложку.
// variant: dialog (по центру) | drawer (панель справа). Содержимое монтируется только пока окно открыто,
// поэтому состояние форм внутри сбрасывается при каждом открытии.
// bare — содержимое (тело и подвал) рисует сам вызывающий код, например форма, которой нужен общий <form>.
export default function Modal({ open, onClose, title, subtitle, variant = 'dialog', size = 'md', dismissible = true, bare = false, footer, children }) {
  const ref = useRef(null);
  const openRef = useRef(open);
  const titleId = useId();

  useEffect(() => {
    openRef.current = open;
    const dialog = ref.current;
    if (!dialog) return;
    if (open && !dialog.open) dialog.showModal();
    if (!open && dialog.open) dialog.close();
  }, [open]);

  return (
    <dialog
      ref={ref}
      className={`modal modal-${variant} modal-${size}`}
      aria-labelledby={titleId}
      // React «всплывает» события close/cancel по дереву компонентов, поэтому закрытие вложенного окна
      // (например, «Новый пациент» внутри панели записи) не должно закрывать внешнее: смотрим, чьё это событие.
      // Программное закрытие (open уже false) игнорируем — реагируем только на Esc.
      onClose={(event) => { if (event.target === event.currentTarget && openRef.current) onClose(); }}
      onCancel={(event) => { if (event.target === event.currentTarget && !dismissible) event.preventDefault(); }}
      onClick={(event) => { if (dismissible && event.target === ref.current) onClose(); }}
    >
      {open && (
        <div className="modal-panel">
          <header className="modal-header">
            <div>
              <h2 id={titleId}>{title}</h2>
              {subtitle && <p>{subtitle}</p>}
            </div>
            {dismissible && (
              <button type="button" className="btn btn-ghost btn-icon btn-sm" onClick={onClose} aria-label="Закрыть">
                <Icon name="x" size={18} />
              </button>
            )}
          </header>
          {bare ? children : <div className="modal-body">{children}</div>}
          {footer && <footer className="modal-footer">{footer}</footer>}
        </div>
      )}
    </dialog>
  );
}
