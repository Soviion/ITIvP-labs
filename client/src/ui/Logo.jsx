// Знак — бумажный талон с перфорацией и крестом: сразу понятно, что это запись к врачу
export function LogoMark({ size = 30 }) {
  return (
    <svg width={size} height={size} viewBox="0 0 32 32" aria-hidden="true">
      <rect width="32" height="32" rx="3" fill="var(--accent)" />
      <path
        d="M7 8.5h18a2 2 0 0 1 2 2v2.4a2.9 2.9 0 0 0 0 5.8v2.8a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2v-2.8a2.9 2.9 0 0 0 0-5.8v-2.4a2 2 0 0 1 2-2z"
        fill="#fff"
      />
      <path d="M13 12.2v7.6M9.2 16h7.6" stroke="var(--accent)" strokeWidth="2.2" fill="none" />
      <path d="M21 11v10" stroke="var(--accent)" strokeWidth="1.3" strokeDasharray="1.8 1.8" fill="none" />
    </svg>
  );
}

export default function Logo() {
  return (
    <span className="logo">
      <LogoMark />
      <span className="logo-text">
        <strong>Твой талон</strong>
        <small>запись к врачу онлайн</small>
      </span>
    </span>
  );
}
