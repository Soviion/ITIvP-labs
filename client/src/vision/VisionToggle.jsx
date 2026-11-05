import Icon from '../ui/Icon';
import { useVision, visionActions } from './vision';

// Кнопка в шапке: включает версию для слабовидящих. Когда версия включена, кнопки в шапке нет:
// выход в обычную версию один — в панели настроек (VisionBar), чтобы не было двух одинаковых кнопок
export default function VisionToggle({ className = 'btn btn-ghost btn-sm a11y-btn' }) {
  const vision = useVision();
  if (vision.on) return null;
  return (
    <button type="button" className={className} data-vision-toggle onClick={visionActions.enable} title="Версия для слабовидящих">
      <Icon name="eye" size={16} /><span>Для слабовидящих</span>
    </button>
  );
}
