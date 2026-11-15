import { STRENGTH_LABELS } from '../utils/passwordRules';
import Icon from '../ui/Icon';

export default function PasswordChecklist({ result, touched }) {
  return (
    <div className="pw-check" aria-live="polite">
      <div className="strength" data-level={result.level}>
        <div className="strength-bars" aria-hidden="true">
          {[1, 2, 3, 4].map((n) => <span key={n} className={result.level >= n ? 'on' : ''} />)}
        </div>
        <span className="strength-label">{touched ? STRENGTH_LABELS[result.level] : 'Требования к паролю'}</span>
      </div>
      <ul>
        {result.rules.map((rule) => (
          <li key={rule.id} className={rule.ok ? 'ok' : touched ? 'bad' : ''}>
            <span className="rule-mark">{rule.ok && <Icon name="check" size={12} strokeWidth={3} />}</span>
            {rule.label}
          </li>
        ))}
      </ul>
    </div>
  );
}
