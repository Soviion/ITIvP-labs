import { useSyncExternalStore } from 'react';
import { retryStore } from '../api';
import Spinner from './Spinner';

// Полоса под шапкой: показывается, пока api.js повторяет упавший запрос (попытки 2 и 3)
export default function RetryBanner() {
  const retry = useSyncExternalStore(retryStore.subscribe, retryStore.getSnapshot);
  if (!retry) return null;

  const waiting = retry.phase === 'waiting';
  return (
    <div className="retry-banner" role="status" aria-live="polite">
      <div className="retry-inner">
        <Spinner size={16} />
        <div className="retry-text">
          <strong>Нет ответа от сервера</strong>
          <span>
            {waiting
              ? `Повторим запрос через ${Math.round(retry.delayMs / 1000)} с — попытка ${retry.attempt} из ${retry.max}`
              : `Повторяем запрос — попытка ${retry.attempt} из ${retry.max}…`}
          </span>
        </div>
      </div>
      {waiting && <span key={`${retry.id}-${retry.attempt}`} className="retry-progress" style={{ animationDuration: `${retry.delayMs}ms` }} />}
    </div>
  );
}
