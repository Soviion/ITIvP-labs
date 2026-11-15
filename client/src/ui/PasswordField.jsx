import { useState } from 'react';
import Field from './Field';
import Icon from './Icon';

export default function PasswordField({ label, value, onChange, error, hint, autoComplete, placeholder, autoFocus, disabled }) {
  const [visible, setVisible] = useState(false);
  return (
    <Field label={label} error={error} hint={hint}>
      {(props) => (
        <div className="input-wrap">
          <input
            {...props}
            type={visible ? 'text' : 'password'}
            value={value}
            onChange={(e) => onChange(e.target.value)}
            autoComplete={autoComplete}
            placeholder={placeholder}
            autoFocus={autoFocus}
            disabled={disabled}
            spellCheck={false}
          />
          <button
            type="button"
            className="input-addon"
            onClick={() => setVisible((v) => !v)}
            aria-label={visible ? 'Скрыть пароль' : 'Показать пароль'}
            aria-pressed={visible}
            tabIndex={-1}
          >
            <Icon name={visible ? 'eyeOff' : 'eye'} size={18} />
          </button>
        </div>
      )}
    </Field>
  );
}
