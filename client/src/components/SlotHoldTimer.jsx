import { quartersToSeconds, useHoldQuarters } from '../realtime/useSlotHold';
import Icon from '../ui/Icon';
import '../slotHold.css';

// Отсчёт брони. Каждый компонент следит за часами сам, поэтому раз в четверть секунды перерисовывается только он,
// а не форма записи целиком. hold — результат useSlotHold ({ status, deadline, ttlMs }).

const LOW_SECONDS = 5; // последние секунды подсвечиваются

function useHoldLeft(hold) {
  const quarters = useHoldQuarters(hold.deadline);
  const seconds = quartersToSeconds(quarters);
  return { quarters, seconds, low: seconds <= LOW_SECONDS };
}

// Тонкая полоса на выбранном талоне: сколько брони осталось
export function HoldBar({ hold }) {
  const { quarters, low } = useHoldLeft(hold);
  const total = Math.max(1, hold.ttlMs / 250);
  return <span className={`hold-bar ${low ? 'is-low' : ''}`} style={{ width: `${Math.min(100, (quarters / total) * 100)}%` }} aria-hidden="true" />;
}

// Чип «Бронь: 12 с» в заголовке шага «Выберите время»
export function HoldChip({ hold }) {
  const { seconds, low } = useHoldLeft(hold);
  return (
    <span className={`hold-chip ${low ? 'is-low' : ''}`} role="timer">
      <Icon name="lock" size={13} />Бронь: <b>{seconds} с</b>
    </span>
  );
}

// Строка «Время забронировано за вами: 12 с» рядом с кнопкой «Записаться» и в окне подтверждения
export function HoldInline({ hold }) {
  const { seconds, low } = useHoldLeft(hold);
  return (
    <span className={`hold-inline ${low ? 'is-low' : ''}`} role="timer">
      <Icon name="lock" size={14} />Время забронировано за вами: <b>{seconds} с</b>
    </span>
  );
}

// Невидимое объявление для чтения с экрана. Текст меняется только трижды (бронь началась, осталось мало, бронь снята),
// поэтому читалка не озвучивает каждую секунду
export function HoldAnnouncer({ hold }) {
  const { low } = useHoldLeft(hold);
  let text = '';
  if (hold.status === 'holding') text = low ? 'Бронь скоро закончится, осталось несколько секунд.' : `Время забронировано за вами на ${Math.round(hold.ttlMs / 1000)} секунд.`;
  return <span className="sr-only" role="status" aria-live="polite">{text}</span>;
}
