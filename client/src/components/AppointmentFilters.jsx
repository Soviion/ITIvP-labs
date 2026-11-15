import { DEFAULT_FILTERS, PERIODS, STATUSES } from '../constants';
import { shortName } from '../utils/appointments';
import Icon from '../ui/Icon';

// Вкладки по статусам со счётчиками + строка поиска и фильтров
export default function AppointmentFilters({ filters, onChange, counts, doctors, disabled }) {
  const set = (patch) => onChange({ ...filters, ...patch });
  const tabs = [{ value: 'all', label: 'Все' }, ...STATUSES];
  const dirty = JSON.stringify(filters) !== JSON.stringify(DEFAULT_FILTERS);

  return (
    <div className="filters">
      <div className="tabs" role="group" aria-label="Фильтр по статусу">
        {tabs.map((tab) => (
          <button
            key={tab.value}
            type="button"
            aria-pressed={filters.status === tab.value}
            className={`tab ${filters.status === tab.value ? 'is-active' : ''}`}
            onClick={() => set({ status: tab.value })}
            disabled={disabled}
          >
            {tab.label}
            {counts[tab.value] !== undefined && <span className="tab-count">{counts[tab.value]}</span>}
          </button>
        ))}
      </div>

      <div className="toolbar">
        <label className="search">
          <Icon name="search" size={16} />
          <input
            type="search"
            value={filters.query}
            onChange={(event) => set({ query: event.target.value })}
            placeholder="Пациент, врач, причина, кабинет"
            aria-label="Поиск по записям"
            disabled={disabled}
          />
        </label>

        <select
          className="select"
          value={filters.doctorId}
          onChange={(event) => set({ doctorId: event.target.value })}
          aria-label="Фильтр по врачу"
          disabled={disabled}
        >
          <option value="all">Все врачи</option>
          {doctors.map((doctor) => (
            <option key={doctor.id} value={String(doctor.id)}>
              {shortName(doctor)} — {doctor.specialty?.name}
            </option>
          ))}
        </select>

        <select
          className="select"
          value={filters.period}
          onChange={(event) => set({ period: event.target.value })}
          aria-label="Фильтр по дате"
          disabled={disabled}
        >
          {PERIODS.map((period) => (
            <option key={period.value} value={period.value}>{period.value === 'all' ? 'Все даты' : period.label}</option>
          ))}
        </select>

        <button
          type="button"
          className="btn btn-secondary"
          onClick={() => set({ direction: filters.direction === 'asc' ? 'desc' : 'asc' })}
          title="Порядок сортировки по дате и времени"
          disabled={disabled}
        >
          <Icon name="sort" size={16} />
          {filters.direction === 'asc' ? 'Сначала ранние' : 'Сначала поздние'}
        </button>

        {dirty && (
          <button type="button" className="btn btn-ghost" onClick={() => onChange(DEFAULT_FILTERS)}>
            Сбросить
          </button>
        )}
      </div>
    </div>
  );
}
