import { useRef } from 'react';
import { formatPhone, phoneDigits } from '../utils/phone';

// Поле телефона с маской +375(44)4444444. Префикс и скобки показываются всегда и не стираются,
// вводить можно только цифры, больше девяти цифр ввести нельзя. Принимает и вставку целого номера.
export default function PhoneInput({ value, onChange, ...rest }) {
  const ref = useRef(null);
  const text = formatPhone(value);

  const toEnd = () => {
    const input = ref.current;
    if (input) requestAnimationFrame(() => input.setSelectionRange(input.value.length, input.value.length));
  };

  return (
    <input
      {...rest}
      ref={ref}
      type="tel"
      inputMode="numeric"
      autoComplete="tel"
      value={text}
      placeholder="+375(44)4444444"
      onChange={(event) => { onChange(formatPhone(event.target.value)); toEnd(); }}
      onKeyDown={(event) => {
        // Backspace стирает последнюю цифру, а не скобку или префикс
        if (event.key === 'Backspace') {
          event.preventDefault();
          onChange(formatPhone(phoneDigits(text).slice(0, -1)));
          toEnd();
        } else if (event.key === 'Delete') {
          event.preventDefault();
        }
      }}
      onPaste={(event) => {
        event.preventDefault();
        onChange(formatPhone(event.clipboardData.getData('text')));
        toEnd();
      }}
      onFocus={toEnd}
      onClick={toEnd}
    />
  );
}
