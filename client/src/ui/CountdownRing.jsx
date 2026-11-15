import useTotpWindow from '../hooks/useTotpWindow';

const RADIUS = 15;
const LENGTH = 2 * Math.PI * RADIUS;

export default function CountdownRing({ period = 30 }) {
  const left = useTotpWindow(period);
  const progress = left / period;
  return (
    <span className={`ring ${left <= 5 ? 'ring-low' : ''}`} title={`Код в приложении обновится через ${left} с`}>
      <svg viewBox="0 0 36 36" width="36" height="36" aria-hidden="true">
        <circle className="ring-track" cx="18" cy="18" r={RADIUS} />
        <circle
          className="ring-bar"
          cx="18"
          cy="18"
          r={RADIUS}
          strokeDasharray={LENGTH}
          strokeDashoffset={LENGTH * (1 - progress)}
          style={{ transition: left === period ? 'none' : undefined }}
        />
      </svg>
      <span className="ring-value">{left}</span>
    </span>
  );
}
