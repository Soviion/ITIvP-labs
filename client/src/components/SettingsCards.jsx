import { useState } from 'react';
import { getDetailMessages, getErrorMessage, getStatus } from '../api';
import { changePassword, emailChangeConfirm, emailChangeStart } from '../authApi';
import { useAuth } from '../auth/context';
import { checkPassword } from '../utils/passwordRules';
import Banner from '../ui/Banner';
import Button from '../ui/Button';
import Field from '../ui/Field';
import Icon from '../ui/Icon';
import OtpInput from '../ui/OtpInput';
import PasswordField from '../ui/PasswordField';
import Spinner from '../ui/Spinner';
import { useToast } from '../ui/toastContext';
import PasswordChecklist from './PasswordChecklist';
import TwoFactorDisableModal from './TwoFactorDisableModal';
import TwoFactorSetupModal from './TwoFactorSetupModal';

export function TwoFactorCard() {
  const { user, updateUser, profile, profileError, retryProfile } = useAuth();
  const toast = useToast();
  const [setupOpen, setSetupOpen] = useState(false);
  const [disableOpen, setDisableOpen] = useState(false);
  const enabled = user.twoFactorEnabled;

  // Включена ли 2FA, известно только после загрузки профиля с сервера
  if (profile !== 'ready') {
    return (
      <section className="card section tfa">
        <header className="section-head">
          <div className="section-icon"><Icon name="shield" size={20} /></div>
          <div>
            <h2>Двухфакторная аутентификация</h2>
            <p>Дополнительный код из Google Authenticator при каждом входе</p>
          </div>
        </header>
        {profile === 'loading' ? (
          <div className="state-loading"><Spinner size={18} />Загружаем настройки защиты…</div>
        ) : (
          <Banner kind="warn" title="Не удалось загрузить настройки" action={<Button size="sm" onClick={retryProfile}>Повторить</Button>}>
            {profileError}
          </Banner>
        )}
      </section>
    );
  }

  return (
    <section className={`card section tfa ${enabled ? 'is-on' : ''}`}>
      <header className="section-head">
        <div className="section-icon"><Icon name={enabled ? 'shieldCheck' : 'shield'} size={20} /></div>
        <div>
          <h2>Двухфакторная аутентификация</h2>
          <p>Дополнительный код из Google Authenticator при каждом входе</p>
        </div>
        <span className={`badge ${enabled ? 'badge-ok' : 'badge-muted'}`}>{enabled ? 'Включена' : 'Выключена'}</span>
      </header>

      {enabled ? (
        <p className="section-text">
          Аккаунт защищён: после пароля система запрашивает 6-значный код из приложения на вашем телефоне.
          Украденный пароль сам по себе уже не позволит войти.
        </p>
      ) : (
        <p className="section-text">
          Пароль можно подсмотреть или угадать, а код из приложения живёт 30 секунд и есть только у вас.
          Подключение занимает около минуты.
        </p>
      )}

      <div className="section-actions">
        {enabled ? (
          <Button variant="danger" onClick={() => setDisableOpen(true)}>Отключить</Button>
        ) : (
          <Button variant="primary" icon="shield" onClick={() => setSetupOpen(true)}>Включить защиту</Button>
        )}
      </div>

      <TwoFactorSetupModal
        open={setupOpen}
        onClose={() => setSetupOpen(false)}
        onEnabled={(data) => { updateUser(data.user); toast.success('Двухфакторная защита включена'); }}
      />
      <TwoFactorDisableModal
        open={disableOpen}
        onClose={() => setDisableOpen(false)}
        onDisabled={(data) => { updateUser(data.user); setDisableOpen(false); toast.success('Двухфакторная защита отключена'); }}
      />
    </section>
  );
}

export function PasswordCard() {
  const { user, replaceToken } = useAuth();
  const toast = useToast();
  const [form, setForm] = useState({ current: '', next: '', confirm: '' });
  const [errors, setErrors] = useState({});
  const [problem, setProblem] = useState(null);
  const [loading, setLoading] = useState(false);

  const strength = checkPassword(form.next, user.email);
  const set = (name) => (value) => {
    setForm((prev) => ({ ...prev, [name]: value }));
    setErrors((prev) => ({ ...prev, [name]: undefined }));
  };

  async function handleSubmit(event) {
    event.preventDefault();
    const found = {};
    if (!form.current) found.current = 'Введите текущий пароль';
    if (!strength.valid) found.next = 'Новый пароль не соответствует требованиям';
    if (form.confirm !== form.next) found.confirm = 'Пароли не совпадают';
    setErrors(found);
    if (Object.keys(found).length) return;

    setLoading(true);
    setProblem(null);
    try {
      const data = await changePassword(form.current, form.next);
      replaceToken(data.token); // сервер отозвал старые токены и выдал новый
      setForm({ current: '', next: '', confirm: '' });
      toast.success('Пароль изменён. На других устройствах потребуется войти заново.');
    } catch (error) {
      if (getStatus(error) === 403) setErrors({ current: getErrorMessage(error) });
      else setProblem({ text: getErrorMessage(error), details: getDetailMessages(error) });
    } finally {
      setLoading(false);
    }
  }

  return (
    <section className="card section">
      <header className="section-head">
        <div className="section-icon"><Icon name="key" size={20} /></div>
        <div>
          <h2>Пароль</h2>
          <p>После смены пароля все остальные сессии завершатся</p>
        </div>
      </header>

      <form onSubmit={handleSubmit} noValidate className="stack form-narrow">
        {problem && (
          <Banner kind="error">
            {problem.text}
            {problem.details.length > 0 && <ul className="banner-list">{problem.details.map((text) => <li key={text}>{text}</li>)}</ul>}
          </Banner>
        )}
        <PasswordField label="Текущий пароль" value={form.current} onChange={set('current')} error={errors.current} autoComplete="current-password" />
        <div className="stack-tight">
          <PasswordField label="Новый пароль" value={form.next} onChange={set('next')} error={errors.next} autoComplete="new-password" />
          <PasswordChecklist result={strength} touched={form.next.length > 0} />
        </div>
        <PasswordField label="Повторите новый пароль" value={form.confirm} onChange={set('confirm')} error={errors.confirm} autoComplete="new-password" />
        <div className="section-actions">
          <Button type="submit" variant="primary" loading={loading}>Сменить пароль</Button>
        </div>
      </form>
    </section>
  );
}

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

// Смена почты: пароль + новый адрес → код из письма на новый адрес → готово
export function EmailCard() {
  const { user, patient, replaceToken, updateMe } = useAuth();
  const toast = useToast();
  const [newEmail, setNewEmail] = useState('');
  const [password, setPassword] = useState('');
  const [errors, setErrors] = useState({});
  const [sentTo, setSentTo] = useState(null); // адрес, на который ушёл код
  const [code, setCode] = useState('');
  const [codeError, setCodeError] = useState('');
  const [codeErrorKey, setCodeErrorKey] = useState(0);
  const [loading, setLoading] = useState(false);

  async function sendCode(event) {
    event?.preventDefault();
    const found = {};
    if (!EMAIL_RE.test(newEmail.trim())) found.email = 'Введите корректный e-mail';
    if (!password) found.password = 'Введите пароль для подтверждения';
    setErrors(found);
    if (Object.keys(found).length) return;

    setLoading(true);
    try {
      await emailChangeStart(newEmail.trim(), password);
      setSentTo(newEmail.trim());
      setCode('');
      setCodeError('');
    } catch (error) {
      const message = getErrorMessage(error);
      setErrors(getStatus(error) === 403 ? { password: message } : { email: message });
    } finally {
      setLoading(false);
    }
  }

  async function confirm(value) {
    if (loading) return;
    setLoading(true);
    setCodeError('');
    try {
      const data = await emailChangeConfirm(sentTo, value);
      replaceToken(data.token);
      updateMe({ user: data.user, ...(patient ? { patient: { ...patient, email: data.user.email } } : {}) });
      toast.success(`Почта изменена на ${data.user.email}`);
      setSentTo(null);
      setNewEmail('');
      setPassword('');
    } catch (error) {
      setCodeError(getErrorMessage(error));
      setCodeErrorKey((n) => n + 1);
      setCode('');
    } finally {
      setLoading(false);
    }
  }

  return (
    <section className="card section">
      <header className="section-head">
        <div className="section-icon"><Icon name="mail" size={20} /></div>
        <div>
          <h2>Электронная почта</h2>
          <p>Сейчас: <strong>{user.email}</strong></p>
        </div>
      </header>

      {!sentTo ? (
        <form onSubmit={sendCode} noValidate className="stack form-narrow">
          <Field label="Новая почта" error={errors.email} hint="Мы отправим на неё код подтверждения">
            {(props) => <input {...props} type="email" value={newEmail} onChange={(e) => { setNewEmail(e.target.value); setErrors((p) => ({ ...p, email: undefined })); }} autoComplete="off" placeholder="name@mail.by" />}
          </Field>
          <PasswordField label="Текущий пароль" value={password} onChange={(v) => { setPassword(v); setErrors((p) => ({ ...p, password: undefined })); }} error={errors.password} autoComplete="current-password" />
          <div className="section-actions">
            <Button type="submit" variant="primary" loading={loading}>Отправить код</Button>
          </div>
        </form>
      ) : (
        <div className="stack form-narrow">
          <p className="muted">Код отправлен на <strong>{sentTo}</strong>. Введите его, чтобы подтвердить смену почты.</p>
          <OtpInput value={code} onChange={(v) => { setCode(v); setCodeError(''); }} onComplete={confirm} invalid={Boolean(codeError)} errorKey={codeErrorKey} disabled={loading} autoFocus />
          {codeError && <p className="field-error" role="alert">{codeError}</p>}
          <div className="section-actions">
            <Button variant="primary" loading={loading} disabled={code.length < 6} onClick={() => confirm(code)}>Подтвердить</Button>
            <Button variant="ghost" onClick={() => setSentTo(null)} disabled={loading}>Отмена</Button>
          </div>
        </div>
      )}
    </section>
  );
}
