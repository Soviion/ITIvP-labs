import { useId } from 'react';

// Подпись + поле + подсказка/ошибка. Поле передаётся функцией, чтобы получить id и aria-атрибуты:
// <Field label="E-mail" error="...">{(props) => <input {...props} />}</Field>
export default function Field({ label, hint, error, optional = false, className = '', children }) {
  const id = useId();
  const describedBy = error || hint ? `${id}-note` : undefined;
  return (
    <div className={`field ${error ? 'has-error' : ''} ${className}`.trim()}>
      {label && (
        <label htmlFor={id}>
          {label}
          {optional && <span className="field-optional">необязательно</span>}
        </label>
      )}
      {children({ id, 'aria-invalid': error ? true : undefined, 'aria-describedby': describedBy })}
      {(error || hint) && (
        <p id={describedBy} className={error ? 'field-error' : 'field-hint'} role={error ? 'alert' : undefined}>
          {error || hint}
        </p>
      )}
    </div>
  );
}
