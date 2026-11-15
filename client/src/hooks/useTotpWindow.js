import { useEffect, useState } from 'react';

// Сколько секунд осталось до смены кода в приложении-аутентификаторе (TOTP: шаг 30 с, отсчёт от начала эпохи)
const secondsLeft = (period) => period - (Math.floor(Date.now() / 1000) % period);

export default function useTotpWindow(period = 30) {
  const [left, setLeft] = useState(() => secondsLeft(period));
  useEffect(() => {
    const timer = setInterval(() => setLeft(secondsLeft(period)), 250);
    return () => clearInterval(timer);
  }, [period]);
  return left;
}
