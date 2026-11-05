import Button from '../ui/Button';
import Icon from '../ui/Icon';
import Spinner from '../ui/Spinner';

// Состояния списка: загрузка, ошибка, пусто, ничего не найдено

export function LoadingState() {
  return (
    <div className="state" role="status" aria-live="polite">
      <div className="state-loading">
        <Spinner size={22} />
        <span>Загружаем записи с сервера…</span>
      </div>
      <div className="skeletons" aria-hidden="true">
        {[0, 1, 2, 3].map((i) => (
          <div key={i} className="skeleton-row">
            <span className="sk sk-time" />
            <span className="sk sk-main" />
            <span className="sk sk-doctor" />
            <span className="sk sk-status" />
          </div>
        ))}
      </div>
    </div>
  );
}

export function ErrorState({ message, onRetry }) {
  // нет связи с сервером: текст ошибки не показываем (его показывает окно «Нет связи»), список просто ждёт загрузки
  if (!message) return <LoadingState />;
  return (
    <div className="state state-center" role="alert">
      <span className="state-icon state-icon-error"><Icon name="wifiOff" size={26} /></span>
      <h3>Не удалось загрузить записи</h3>
      <p>{message}</p>
      <Button variant="primary" icon="refresh" onClick={onRetry}>Повторить</Button>
    </div>
  );
}

export function EmptyState({ onCreate }) {
  return (
    <div className="state state-center">
      <span className="state-icon"><Icon name="calendar" size={26} /></span>
      <h3>Записей пока нет</h3>
      <p>Создайте первую запись на приём — она сразу сохранится на сервере.</p>
      <Button variant="primary" icon="plus" onClick={onCreate}>Новая запись</Button>
    </div>
  );
}

export function NoResults({ onReset }) {
  return (
    <div className="state state-center">
      <span className="state-icon"><Icon name="search" size={26} /></span>
      <h3>Ничего не найдено</h3>
      <p>Попробуйте изменить поисковый запрос или сбросить фильтры.</p>
      <Button onClick={onReset}>Сбросить фильтры</Button>
    </div>
  );
}
