import { useId } from 'react';

// Иллюстрированный портрет врача (вместо фотографии): внешность задаётся в профиле — цвет кожи и волос, причёска, очки, борода.
const BACK_HAIR = {
  long: 'M38 54C34 28 50 21 60 21C70 21 86 28 82 54C85 70 81 84 77 88L70 70L50 70L43 88C39 84 35 70 38 54Z',
  bob: 'M38 54C34 28 50 21 60 21C70 21 86 28 82 54L83 68C75 71 71 63 71 63L49 63C49 63 45 71 37 68Z',
};
const FRINGE = {
  long: 'M41 49C42 32 52 27 60 27C70 27 79 32 79 49C72 40 56 38 41 49Z',
  bob: 'M41 49C42 32 52 27 60 27C70 27 79 32 79 49C72 40 56 38 41 49Z',
  bun: 'M41 50C40 30 52 26 60 26C68 26 80 30 79 50C72 42 48 42 41 50Z',
  short: 'M41 48C40 30 50 26 60 26C70 26 80 30 79 48C76 40 70 35 60 35C50 35 44 40 41 48Z',
};

// Если у врача есть photo — показываем фотографию, иначе рисованный портрет по параметрам look.
export default function DoctorPhoto({ look, photo, size = 64, rounded = 14, label }) {
  const id = useId().replace(/:/g, '');
  if (photo) {
    return (
      <img
        className="doctor-photo"
        src={photo}
        alt={label ?? ''}
        width={size}
        height={size}
        loading="lazy"
        style={{ borderRadius: rounded, flex: 'none', objectFit: 'cover', background: '#dfe3dc' }}
      />
    );
  }
  const { skin, hair, bg, style, glasses, beard, gender } = look;
  const shade = 'rgba(0,0,0,0.08)';

  return (
    <svg
      className="doctor-photo"
      width={size}
      height={size}
      viewBox="0 0 120 120"
      role={label ? 'img' : undefined}
      aria-label={label}
      aria-hidden={label ? undefined : true}
      style={{ borderRadius: rounded, flex: 'none' }}
    >
      <defs><clipPath id={`clip-${id}`}><rect width="120" height="120" /></clipPath></defs>
      <g clipPath={`url(#clip-${id})`}>
        <rect width="120" height="120" fill={bg} />
        <circle cx="96" cy="26" r="30" fill="rgba(255,255,255,0.35)" />

        {BACK_HAIR[style] && <path d={BACK_HAIR[style]} fill={hair} />}
        {style === 'bun' && <circle cx="60" cy="22" r="9" fill={hair} />}

        {/* халат, ворот и фонендоскоп */}
        <path d="M10 120C10 94 34 85 60 85C86 85 110 94 110 120Z" fill="#ffffff" />
        <path d="M10 120C10 94 34 85 60 85L60 120Z" fill={shade} />
        <path d="M47 86L60 106L73 86Z" fill="#bcd9d1" />
        <path d="M45 89C40 105 46 114 55 111" fill="none" stroke="#34484a" strokeWidth="2.6" strokeLinecap="round" />
        <path d="M75 89C80 105 74 114 65 111" fill="none" stroke="#34484a" strokeWidth="2.6" strokeLinecap="round" />
        <circle cx="55" cy="111" r="3.4" fill="#7b8c8e" />

        {/* шея и голова */}
        <rect x="52" y="68" width="16" height="22" rx="6" fill={skin} />
        <rect x="52" y="68" width="16" height="22" rx="6" fill={shade} />
        <circle cx="41" cy="54" r="4" fill={skin} />
        <circle cx="79" cy="54" r="4" fill={skin} />
        <ellipse cx="60" cy="52" rx="19" ry="22" fill={skin} />

        {beard && <path d="M41.5 56C43 76 77 76 78.5 56C75 67 67 70 60 70C53 70 45 67 41.5 56Z" fill={hair} />}
        {FRINGE[style] && <path d={FRINGE[style]} fill={hair} />}

        {/* лицо */}
        <path d={`M44 ${gender === 'f' ? 45 : 44}Q50 ${gender === 'f' ? 42 : 43} 56 45`} fill="none" stroke={hair} strokeWidth="2" strokeLinecap="round" />
        <path d={`M64 45Q70 ${gender === 'f' ? 42 : 43} 76 ${gender === 'f' ? 45 : 44}`} fill="none" stroke={hair} strokeWidth="2" strokeLinecap="round" />
        <circle cx="51.5" cy="52" r="1.9" fill="#2b2b2b" />
        <circle cx="68.5" cy="52" r="1.9" fill="#2b2b2b" />
        <path d="M60 54C58.5 59 58 61 60.5 61.5" fill="none" stroke="rgba(0,0,0,0.25)" strokeWidth="1.5" strokeLinecap="round" />
        <path d="M53 66Q60 71.5 67 66" fill="none" stroke={beard ? '#f1d9d3' : '#a0524a'} strokeWidth="2" strokeLinecap="round" />
        {glasses && (
          <g fill="none" stroke="#33403f" strokeWidth="1.8">
            <circle cx="51.5" cy="52" r="6.5" />
            <circle cx="68.5" cy="52" r="6.5" />
            <path d="M58 52H62" />
          </g>
        )}
      </g>
    </svg>
  );
}
