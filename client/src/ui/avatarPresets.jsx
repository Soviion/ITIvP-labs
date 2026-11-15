// Девять готовых аватарок: плоские мультяшные персонажи, которые подходят системе записи к врачу.
// Рисунок 96×96 без скруглений: круг вырезает контейнер (.avatar в avatar.css).

const INK = '#2b2622';

function Face({ eyes = 44, cheeks = true, smile = 'M41 53q7 6 14 0' }) {
  return (
    <>
      <circle cx="41" cy={eyes} r="2.1" fill={INK} />
      <circle cx="55" cy={eyes} r="2.1" fill={INK} />
      {cheeks && (
        <>
          <circle cx="37" cy={eyes + 7} r="3" fill="#f2a29a" opacity="0.55" />
          <circle cx="59" cy={eyes + 7} r="3" fill="#f2a29a" opacity="0.55" />
        </>
      )}
      <path d={smile} fill="none" stroke={INK} strokeWidth="2" strokeLinecap="round" />
    </>
  );
}

function Person({ skin = '#f1c6a0', skinShade = '#e3b189', clothes, children, back, neck = true }) {
  return (
    <>
      {back}
      <path d="M10 96c0-19 15-27 38-27s38 8 38 27z" fill={clothes} />
      {neck && <rect x="41" y="55" width="14" height="18" rx="4" fill={skinShade} />}
      <circle cx="30.5" cy="45" r="3.8" fill={skin} />
      <circle cx="65.5" cy="45" r="3.8" fill={skin} />
      <ellipse cx="48" cy="43" rx="17" ry="19.5" fill={skin} />
      {children}
    </>
  );
}

// 1. Врач с головным зеркалом
function Doctor() {
  return (
    <svg viewBox="0 0 96 96" aria-hidden="true">
      <rect width="96" height="96" fill="#cfe8e3" />
      <Person clothes="#ffffff">
        <path d="M48 69 38 78l10 18 10-18z" fill="#3fa796" />
        <path d="M38 76v8q0 8 10 8" fill="none" stroke="#35505c" strokeWidth="2.4" strokeLinecap="round" />
        <circle cx="58" cy="82" r="3.2" fill="#35505c" />
        <path d="M31 40c0-14 8-21 17-21s17 7 17 21c-4-6-9-9-17-9s-13 3-17 9z" fill="#3b2f2a" />
        <path d="M30 36q18-10 36 0" fill="none" stroke="#8d99a1" strokeWidth="3" />
        <circle cx="48" cy="27" r="6" fill="#dfe7eb" stroke="#7b8790" strokeWidth="2" />
        <path d="M45 25q2-2 4-1" fill="none" stroke="#fff" strokeWidth="1.6" strokeLinecap="round" />
        <Face />
      </Person>
    </svg>
  );
}

// 2. Медсестра в шапочке
function Nurse() {
  return (
    <svg viewBox="0 0 96 96" aria-hidden="true">
      <rect width="96" height="96" fill="#f4dde2" />
      <Person clothes="#4fa9aa" skin="#f5cfae" skinShade="#e6b895">
        <path d="M31 46c0-5 1-10 3-13l6 3-3 14z" fill="#6b3e26" />
        <path d="M65 46c0-5-1-10-3-13l-6 3 3 14z" fill="#6b3e26" />
        <path d="M31 36c0-10 7-16 17-16s17 6 17 16c-5-3-10-4-17-4s-12 1-17 4z" fill="#ffffff" stroke="#c9d3d8" strokeWidth="1.5" />
        <rect x="45.5" y="22" width="5" height="11" fill="#d9483b" />
        <rect x="42.5" y="25" width="11" height="5" fill="#d9483b" />
        <path d="M42 70l6 8 6-8" fill="none" stroke="#ffffff" strokeWidth="2.6" strokeLinejoin="round" />
        <Face />
      </Person>
    </svg>
  );
}

// 3. Малыш
function Kid() {
  return (
    <svg viewBox="0 0 96 96" aria-hidden="true">
      <rect width="96" height="96" fill="#fbe8b8" />
      <Person clothes="#ef8a5b" skin="#f7d0b0" skinShade="#e9b992">
        <ellipse cx="48" cy="44" rx="20" ry="21" fill="#f7d0b0" />
        <path d="M29 38c1-12 9-18 19-18s18 6 19 18c-5-4-11-6-19-6s-14 2-19 6z" fill="#8a5a36" />
        <path d="M46 21q2-9 8-6-3 2-2 6z" fill="#8a5a36" />
        <circle cx="40" cy="45" r="3.2" fill={INK} />
        <circle cx="56" cy="45" r="3.2" fill={INK} />
        <circle cx="41" cy="44" r="1.1" fill="#fff" />
        <circle cx="57" cy="44" r="1.1" fill="#fff" />
        <circle cx="35.5" cy="52" r="3.4" fill="#f2a29a" opacity="0.6" />
        <circle cx="60.5" cy="52" r="3.4" fill="#f2a29a" opacity="0.6" />
        <path d="M42 54q6 7 12 0z" fill="#b5463f" />
        <circle cx="48" cy="82" r="3" fill="#fff4dc" />
      </Person>
    </svg>
  );
}

// 4. Дедушка с усами
function Grandpa() {
  return (
    <svg viewBox="0 0 96 96" aria-hidden="true">
      <rect width="96" height="96" fill="#d8e3f1" />
      <Person clothes="#7e8fab" skin="#efc3a0" skinShade="#dfae8a">
        <path d="M31 42c-3 1-4 7-2 11l4-1z" fill="#ecedee" />
        <path d="M65 42c3 1 4 7 2 11l-4-1z" fill="#ecedee" />
        <path d="M32 33q4-9 13-10" fill="none" stroke="#ecedee" strokeWidth="4" strokeLinecap="round" />
        <path d="M64 33q-4-9-13-10" fill="none" stroke="#ecedee" strokeWidth="4" strokeLinecap="round" />
        <path d="M35 38q5-3 9-1M52 37q4-2 9 1" fill="none" stroke="#d3d4d6" strokeWidth="3" strokeLinecap="round" />
        <circle cx="41" cy="44" r="2.1" fill={INK} />
        <circle cx="55" cy="44" r="2.1" fill={INK} />
        <circle cx="48" cy="49" r="3" fill="#e0a283" />
        <path d="M38 55q10-6 20 0q-5 5-10 2-5 3-10-2z" fill="#f2f2f2" stroke="#cfd0d2" strokeWidth="1.2" />
        <path d="M44 61q4 2 8 0" fill="none" stroke={INK} strokeWidth="1.8" strokeLinecap="round" />
        <path d="M48 69v27" stroke="#66768f" strokeWidth="2" />
        <circle cx="48" cy="80" r="1.6" fill="#e9eef6" />
        <circle cx="48" cy="88" r="1.6" fill="#e9eef6" />
      </Person>
    </svg>
  );
}

// 5. Бабушка в очках
function Grandma() {
  return (
    <svg viewBox="0 0 96 96" aria-hidden="true">
      <rect width="96" height="96" fill="#e7ddf0" />
      <Person clothes="#b9636f" skin="#f1c6a6" skinShade="#e1b08d" back={<circle cx="48" cy="21" r="8.5" fill="#cdd0d5" />}>
        <path d="M29 46c-1-15 7-26 19-26s20 11 19 26c-2-9-5-14-8-16-7 3-17 3-24-1-3 3-5 8-6 17z" fill="#cdd0d5" />
        <circle cx="30" cy="51" r="1.8" fill="#e5b84f" />
        <circle cx="66" cy="51" r="1.8" fill="#e5b84f" />
        <circle cx="41" cy="44" r="6.2" fill="#ffffff" fillOpacity="0.45" stroke="#6a4c3b" strokeWidth="1.8" />
        <circle cx="55" cy="44" r="6.2" fill="#ffffff" fillOpacity="0.45" stroke="#6a4c3b" strokeWidth="1.8" />
        <path d="M47 44h2" stroke="#6a4c3b" strokeWidth="1.8" />
        <circle cx="41" cy="44" r="1.9" fill={INK} />
        <circle cx="55" cy="44" r="1.9" fill={INK} />
        <circle cx="37" cy="53" r="3" fill="#f2a29a" opacity="0.55" />
        <circle cx="59" cy="53" r="3" fill="#f2a29a" opacity="0.55" />
        <path d="M42 55q6 5 12 0" fill="none" stroke={INK} strokeWidth="2" strokeLinecap="round" />
        <path d="M40 72q8 7 16 0" fill="none" stroke="#f3e3c3" strokeWidth="2.4" strokeDasharray="1 4" strokeLinecap="round" />
      </Person>
    </svg>
  );
}

// 6. Студентка с книгами
function Student() {
  return (
    <svg viewBox="0 0 96 96" aria-hidden="true">
      <rect width="96" height="96" fill="#cfe0f6" />
      <Person
        clothes="#3f6fb1"
        skin="#f3caa6"
        skinShade="#e3b38f"
        back={<path d="M28 46c0-18 8-28 20-28s20 10 20 28v26c-4 4-10 4-12 0V52H40v20c-2 4-8 4-12 0z" fill="#4a2f23" />}
      >
        <path d="M30 42c0-13 8-20 18-20s18 7 18 20c-6-2-12-8-14-14-4 7-12 12-22 14z" fill="#4a2f23" />
        <Face />
        <rect x="22" y="78" width="34" height="8" rx="1.5" fill="#e0a13f" />
        <rect x="24" y="70" width="30" height="8" rx="1.5" fill="#cf5a43" />
        <rect x="22" y="86" width="34" height="8" rx="1.5" fill="#4fa28c" />
        <path d="M26 74h22M26 82h26" stroke="#ffffff" strokeOpacity="0.55" strokeWidth="1.4" />
      </Person>
    </svg>
  );
}

// 7. Кот-доктор
function Cat() {
  return (
    <svg viewBox="0 0 96 96" aria-hidden="true">
      <rect width="96" height="96" fill="#f6dcc6" />
      <path d="M12 96c0-17 14-25 36-25s36 8 36 25z" fill="#ffffff" />
      <path d="M48 71 40 80l8 16 8-16z" fill="#3fa796" />
      <rect x="45" y="80" width="6" height="2" fill="#fff" opacity="0" />
      <path d="M30 37 27 17l14 8zM66 37l3-20-14 8z" fill="#e0954e" />
      <path d="M31 33 30 22l8 5zM65 33l1-11-8 5z" fill="#f0b6a8" />
      <ellipse cx="48" cy="48" rx="22" ry="19" fill="#eaa35e" />
      <path d="M48 30v8M40 31l2 6M56 31l-2 6" stroke="#c97f3d" strokeWidth="2.4" strokeLinecap="round" />
      <ellipse cx="48" cy="55" rx="10" ry="7.5" fill="#f8e6d0" />
      <ellipse cx="40" cy="46" rx="3.2" ry="3.8" fill="#4f7d3a" />
      <ellipse cx="56" cy="46" rx="3.2" ry="3.8" fill="#4f7d3a" />
      <ellipse cx="40" cy="46" rx="1.2" ry="3.2" fill={INK} />
      <ellipse cx="56" cy="46" rx="1.2" ry="3.2" fill={INK} />
      <path d="M45 52h6l-3 3.4z" fill="#d9707a" />
      <path d="M48 55.4q-1 4-5 3.6M48 55.4q1 4 5 3.6" fill="none" stroke={INK} strokeWidth="1.6" strokeLinecap="round" />
      <path d="M30 53 20 51M30 57l-10 3M66 53l10-2M66 57l10 3" stroke="#7c5a3c" strokeWidth="1.3" strokeLinecap="round" />
      <path d="M36 74v8q0 8 12 8" fill="none" stroke="#35505c" strokeWidth="2.4" strokeLinecap="round" />
      <circle cx="61" cy="90" r="3.2" fill="#35505c" />
    </svg>
  );
}

// 8. Мужчина с бородой и в очках
function Man() {
  return (
    <svg viewBox="0 0 96 96" aria-hidden="true">
      <rect width="96" height="96" fill="#d9e6d2" />
      <Person clothes="#3d6b5e" skin="#e9bd98" skinShade="#d8a67f">
        <path d="M31 41c0-13 7-21 17-21s17 8 17 21c-3-5-7-8-9-8-5 2-11 2-16 0-2 0-6 3-9 8z" fill="#2f2622" />
        <path d="M31 48c0 14 7 22 17 22s17-8 17-22c-2 7-6 10-10 10H41c-4 0-8-3-10-10z" fill="#2f2622" />
        <path d="M42 57q6 4 12 0" fill="none" stroke="#e9bd98" strokeWidth="2.2" strokeLinecap="round" />
        <rect x="34" y="39" width="12" height="9" rx="3" fill="#ffffff" fillOpacity="0.4" stroke="#222" strokeWidth="1.8" />
        <rect x="50" y="39" width="12" height="9" rx="3" fill="#ffffff" fillOpacity="0.4" stroke="#222" strokeWidth="1.8" />
        <path d="M46 43h4" stroke="#222" strokeWidth="1.8" />
        <circle cx="40" cy="43.5" r="1.9" fill={INK} />
        <circle cx="56" cy="43.5" r="1.9" fill={INK} />
        <path d="M42 70l6 7 6-7" fill="none" stroke="#2c5247" strokeWidth="2.4" strokeLinejoin="round" />
      </Person>
    </svg>
  );
}

// 9. Девочка с хвостиками
function Girl() {
  return (
    <svg viewBox="0 0 96 96" aria-hidden="true">
      <rect width="96" height="96" fill="#f5d9e6" />
      <Person
        clothes="#e6b43c"
        skin="#f6cfae"
        skinShade="#e6b895"
        back={(
          <>
            <circle cx="24" cy="50" r="9" fill="#a85a2a" />
            <circle cx="72" cy="50" r="9" fill="#a85a2a" />
          </>
        )}
      >
        <path d="M30 42c0-14 8-22 18-22s18 8 18 22c-6-2-11-8-13-13-4 7-12 12-23 13z" fill="#a85a2a" />
        <circle cx="31" cy="35" r="3.4" fill="#d9483b" />
        <circle cx="65" cy="35" r="3.4" fill="#d9483b" />
        <circle cx="40" cy="45" r="3" fill={INK} />
        <circle cx="56" cy="45" r="3" fill={INK} />
        <circle cx="41" cy="44" r="1" fill="#fff" />
        <circle cx="57" cy="44" r="1" fill="#fff" />
        <circle cx="36" cy="52" r="3.2" fill="#f2a29a" opacity="0.6" />
        <circle cx="60" cy="52" r="3.2" fill="#f2a29a" opacity="0.6" />
        <path d="M42 54q6 6 12 0" fill="none" stroke={INK} strokeWidth="2" strokeLinecap="round" />
        <path d="M44 72h8" stroke="#fff" strokeWidth="3" strokeLinecap="round" />
      </Person>
    </svg>
  );
}

// Запасной вариант, если аватар не выбран: нейтральный силуэт
export function Silhouette() {
  return (
    <svg viewBox="0 0 96 96" aria-hidden="true">
      <rect width="96" height="96" fill="#e3e7ec" />
      <circle cx="48" cy="38" r="15" fill="#aab3be" />
      <path d="M16 96c0-20 14-30 32-30s32 10 32 30z" fill="#aab3be" />
    </svg>
  );
}

export const AVATAR_PRESETS = [
  { id: 1, title: 'Врач', Component: Doctor },
  { id: 2, title: 'Медсестра', Component: Nurse },
  { id: 3, title: 'Малыш', Component: Kid },
  { id: 4, title: 'Дедушка', Component: Grandpa },
  { id: 5, title: 'Бабушка', Component: Grandma },
  { id: 6, title: 'Студентка', Component: Student },
  { id: 7, title: 'Кот-доктор', Component: Cat },
  { id: 8, title: 'Мужчина', Component: Man },
  { id: 9, title: 'Девочка', Component: Girl },
];

export function PresetImage({ id }) {
  const preset = AVATAR_PRESETS.find((item) => item.id === id);
  return preset ? <preset.Component /> : null;
}
