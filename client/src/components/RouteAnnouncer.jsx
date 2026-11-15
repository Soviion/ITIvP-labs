import { useEffect, useRef, useState } from 'react';
import { useLocation } from 'react-router-dom';

// Страницы в SPA не перезагружаются, поэтому скринридер сам не замечает, что пользователь перешёл в другой раздел.
// После перехода зачитываем заголовок новой страницы (<title>) через невидимую «живую» область.
// Заголовок может измениться позже (например, когда загрузилось имя врача), поэтому несколько секунд следим
// за <head> и произносим последний вариант. Если фокус пропал (нажатая кнопка исчезла вместе со старой
// страницей), возвращаем его на основное содержимое, чтобы Tab продолжил с начала новой страницы.
export default function RouteAnnouncer() {
  const { pathname } = useLocation();
  const [message, setMessage] = useState('');
  const previous = useRef(pathname);

  useEffect(() => {
    if (previous.current === pathname) return undefined; // первая загрузка: страницу и так озвучит скринридер
    previous.current = pathname;

    let announceTimer;
    const announce = () => {
      clearTimeout(announceTimer);
      announceTimer = setTimeout(() => setMessage(document.title), 300);
    };
    announce();
    const observer = new MutationObserver(announce);
    observer.observe(document.head, { childList: true, subtree: true, characterData: true });
    const stopObserving = setTimeout(() => observer.disconnect(), 4000);

    const refocus = setTimeout(() => {
      const active = document.activeElement;
      if (!active || active === document.body) document.getElementById('main-content')?.focus({ preventScroll: true });
    }, 350);

    return () => {
      clearTimeout(announceTimer);
      clearTimeout(stopObserving);
      clearTimeout(refocus);
      observer.disconnect();
    };
  }, [pathname]);

  return <div className="sr-only" role="status" aria-live="polite" aria-atomic="true">{message}</div>;
}
