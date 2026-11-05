import { useEffect, useRef } from 'react';
import { useVision, visionActions } from './vision';
import './vision.css';

const SCHEME_OPTIONS = [
  { value: 'bw', label: 'Чёрным по белому' },
  { value: 'wb', label: 'Белым по чёрному' },
  { value: 'yb', label: 'Жёлтым по тёмно-синему' },
];

// Панель настроек вверху страницы. Показывается только при включённой версии для слабовидящих
export default function VisionBar() {
  const vision = useVision();
  const barRef = useRef(null);
  const wasOn = useRef(vision.on);

  // Кнопка, которой режим включили (или выключили), пропадает со страницы, и фокус потерялся бы: скринридер замолчит,
  // а клавиатура вернётся в начало страницы. Поэтому при включении фокус уходит на панель (её название зачитывается),
  // а при выключении возвращается на кнопку «Для слабовидящих» в шапке. При загрузке страницы фокус не трогаем
  useEffect(() => {
    if (wasOn.current === vision.on) return;
    wasOn.current = vision.on;
    if (vision.on) barRef.current?.focus();
    else document.querySelector('[data-vision-toggle]')?.focus();
  }, [vision.on]);

  if (!vision.on) return null;

  return (
    <div ref={barRef} tabIndex={-1} className="vbar" role="region" aria-label="Версия для слабовидящих">
      <div className="vbar-inner">
        <div className="vbar-group" role="group" aria-label="Цвета">
          <span className="vbar-title">Цвета</span>
          <div className="vbar-row">
            {SCHEME_OPTIONS.map((item) => (
              <button
                key={item.value}
                type="button"
                className="vbtn vbtn-scheme"
                data-scheme={item.value}
                aria-pressed={vision.scheme === item.value}
                onClick={() => visionActions.setScheme(item.value)}
              >
                {item.label}
              </button>
            ))}
          </div>
        </div>

        <div className="vbar-group" role="group" aria-label="Изображения">
          <span className="vbar-title">Изображения</span>
          <div className="vbar-row">
            <button type="button" className="vbtn" aria-pressed={vision.images} onClick={() => visionActions.setImages(true)}>Включены</button>
            <button type="button" className="vbtn" aria-pressed={!vision.images} onClick={() => visionActions.setImages(false)}>Выключены</button>
          </div>
        </div>

        <button type="button" className="vbtn vbtn-exit" onClick={visionActions.disable}>Обычная версия</button>
      </div>
    </div>
  );
}
