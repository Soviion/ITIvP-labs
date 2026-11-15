import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import Icon from './Icon';
import { ToastContext } from './toastContext';

const ICONS = { success: 'check', error: 'alert', info: 'info' };
let seq = 0;

export function ToastProvider({ children }) {
  const [toasts, setToasts] = useState([]);
  const containerRef = useRef(null);

  const dismiss = useCallback((id) => setToasts((list) => list.filter((toast) => toast.id !== id)), []);

  const push = useCallback((kind, message, { title, duration } = {}) => {
    if (kind === 'error' && message === '') return; // нет связи с сервером: уведомление не нужно, показано окно «Нет связи»
    const id = ++seq;
    setToasts((list) => [...list.slice(-3), { id, kind, message, title }]);
    setTimeout(() => dismiss(id), duration ?? 3000);
  }, [dismiss]);

  const api = useMemo(() => ({
    success: (message, options) => push('success', message, options),
    error: (message, options) => push('error', message, options),
    info: (message, options) => push('info', message, options),
  }), [push]);

  // popover выводит контейнер в «верхний слой» браузера — уведомления видны даже поверх открытых окон (<dialog>)
  useEffect(() => {
    const container = containerRef.current;
    if (!container?.showPopover) return;
    const shown = container.matches(':popover-open');
    if (!toasts.length) {
      if (shown) container.hidePopover();
      return;
    }
    if (shown && !document.querySelector('dialog[open]')) return;
    if (shown) container.hidePopover();
    container.showPopover();
  }, [toasts]);

  return (
    <ToastContext value={api}>
      {children}
      <div className="toasts" popover="manual" ref={containerRef} aria-live="polite">
        <div className="toasts-inner">
          {toasts.map((toast) => (
            <div key={toast.id} className={`toast toast-${toast.kind}`} role={toast.kind === 'error' ? 'alert' : 'status'}>
              <span className="toast-icon"><Icon name={ICONS[toast.kind]} size={16} /></span>
              <div className="toast-text">
                {toast.title && <strong>{toast.title}</strong>}
                <span>{toast.message}</span>
              </div>
              <button type="button" className="toast-close" onClick={() => dismiss(toast.id)} aria-label="Закрыть уведомление">
                <Icon name="x" size={14} />
              </button>
            </div>
          ))}
        </div>
      </div>
    </ToastContext>
  );
}

