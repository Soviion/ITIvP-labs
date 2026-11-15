import { GENDERS } from '../constants';
import { SOCIAL_STATUSES } from '../utils/patient';
import { todayISO } from '../utils/dates';
import Field from '../ui/Field';
import PhoneInput from '../ui/PhoneInput';

export default function PatientFields({ values, errors, onChange, disabled = false }) {
  const bind = (name) => ({
    value: values[name],
    disabled,
    onChange: (event) => onChange(name, event.target.value),
  });

  return (
    <div className="stack">
      <div className="grid-3-even">
        <Field label="Фамилия" error={errors.lastName}>
          {(props) => <input {...props} {...bind('lastName')} autoComplete="family-name" maxLength={60} />}
        </Field>
        <Field label="Имя" error={errors.firstName}>
          {(props) => <input {...props} {...bind('firstName')} autoComplete="given-name" maxLength={60} />}
        </Field>
        <Field label="Отчество" error={errors.middleName}>
          {(props) => (
            <input
              {...props}
              {...bind('middleName')}
              autoComplete="additional-name"
              maxLength={60}
              disabled={disabled || values.noMiddleName}
              placeholder={values.noMiddleName ? 'Нет отчества' : ''}
            />
          )}
        </Field>
      </div>

      <label className="check">
        <input
          type="checkbox"
          checked={values.noMiddleName}
          disabled={disabled}
          onChange={(event) => onChange('noMiddleName', event.target.checked)}
        />
        <span>У меня нет отчества</span>
      </label>

      <div className="grid-3-even">
        <Field label="Пол" error={errors.gender}>
          {(props) => (
            <select {...props} {...bind('gender')}>
              <option value="">Выберите</option>
              {GENDERS.map((gender) => <option key={gender.value} value={gender.value}>{gender.label}</option>)}
            </select>
          )}
        </Field>
        <Field label="Дата рождения" error={errors.birthDate}>
          {(props) => <input {...props} {...bind('birthDate')} type="date" min="1900-01-01" max={todayISO()} autoComplete="bday" />}
        </Field>
        <Field label="Социальный статус" error={errors.socialStatus}>
          {(props) => (
            <select {...props} {...bind('socialStatus')}>
              <option value="">Выберите</option>
              {SOCIAL_STATUSES.map((status) => <option key={status.value} value={status.value}>{status.label}</option>)}
            </select>
          )}
        </Field>
      </div>

      <div className="grid-2">
        <Field label="Номер телефона" error={errors.phone} hint="Формат: +375(44)4444444">
          {(props) => <PhoneInput {...props} value={values.phone} disabled={disabled} onChange={(value) => onChange('phone', value)} />}
        </Field>
        <Field label="Место работы или учёбы" optional error={errors.workplace}>
          {(props) => <input {...props} {...bind('workplace')} maxLength={150} autoComplete="organization" />}
        </Field>
      </div>

      <Field label="Адрес проживания" optional error={errors.address}>
        {(props) => <input {...props} {...bind('address')} maxLength={255} autoComplete="street-address" placeholder="Город, улица, дом, квартира" />}
      </Field>

      <Field
        label="Доверенное лицо"
        optional={!values.socialStatus || ['adult', 'student'].includes(values.socialStatus)}
        error={errors.trustedPerson}
        hint="Мать, отец или другой родственник: ФИО, телефон +375(44)4444444 и место работы через запятую"
      >
        {(props) => (
          <textarea
            {...props}
            {...bind('trustedPerson')}
            rows={2}
            maxLength={300}
            placeholder="Иванова Анна Петровна, +375(29)7654321, ООО «Ромашка»"
          />
        )}
      </Field>
    </div>
  );
}
