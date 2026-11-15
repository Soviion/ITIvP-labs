import { useEffect, useRef } from 'react';

// Шесть ячеек для кода из Google Authenticator. Значение — одна строка из цифр без пропусков.
// Поддерживает ввод по одной цифре, вставку целого кода («123 456»), Backspace, стрелки и автозаполнение.
export default function OtpInput({ value, onChange, onComplete, disabled = false, invalid = false, errorKey = 0, length = 6, autoFocus = false }) {
  const refs = useRef([]);

  const focusCell = (index) => {
    const cell = refs.current[Math.max(0, Math.min(length - 1, index))];
    cell?.focus();
    cell?.select();
  };

  // Фокус в первую ячейку: при открытии (autoFocus) и после ошибки, когда ячейки очищены и пересозданы для анимации
  useEffect(() => {
    if (autoFocus || errorKey > 0) refs.current[0]?.focus();
  }, [autoFocus, errorKey]);

  const commit = (next, focusIndex) => {
    onChange(next);
    if (next.length === length) onComplete?.(next);
    focusCell(focusIndex);
  };

  const write = (index, digits) => {
    const position = Math.min(index, value.length);
    const next = (value.slice(0, position) + digits + value.slice(position + digits.length)).slice(0, length);
    commit(next, position + digits.length);
  };

  const handleChange = (index, event) => {
    const digits = event.target.value.replace(/\D/g, '');
    if (digits) write(index, digits);
  };

  const handleKeyDown = (index, event) => {
    if (event.key === 'Backspace') {
      event.preventDefault();
      if (value[index]) commit(value.slice(0, index) + value.slice(index + 1), index);
      else if (index > 0) commit(value.slice(0, index - 1) + value.slice(index), index - 1);
    } else if (event.key === 'Delete') {
      event.preventDefault();
      commit(value.slice(0, index) + value.slice(index + 1), index);
    } else if (event.key === 'ArrowLeft') {
      event.preventDefault();
      focusCell(index - 1);
    } else if (event.key === 'ArrowRight') {
      event.preventDefault();
      focusCell(index + 1);
    }
  };

  const handlePaste = (index, event) => {
    const digits = event.clipboardData.getData('text').replace(/\D/g, '');
    if (!digits) return;
    event.preventDefault();
    write(index, digits);
  };

  return (
    <div key={errorKey} className={`otp ${invalid ? 'otp-invalid' : ''}`} role="group" aria-label="Шестизначный код">
      {Array.from({ length }, (_, index) => (
        <span key={index} className="otp-slot">
          {index === length / 2 && <span className="otp-dash" aria-hidden="true" />}
          <input
            ref={(node) => { refs.current[index] = node; }}
            className={value[index] ? 'filled' : ''}
            value={value[index] ?? ''}
            inputMode="numeric"
            pattern="[0-9]*"
            autoComplete={index === 0 ? 'one-time-code' : 'off'}
            aria-label={`Цифра ${index + 1} из ${length}`}
            disabled={disabled}
            onChange={(event) => handleChange(index, event)}
            onKeyDown={(event) => handleKeyDown(index, event)}
            onPaste={(event) => handlePaste(index, event)}
            onFocus={(event) => event.target.select()}
          />
        </span>
      ))}
    </div>
  );
}
