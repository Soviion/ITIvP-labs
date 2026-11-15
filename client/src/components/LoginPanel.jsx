import { useState } from 'react';
import { Link } from 'react-router-dom';
import { getErrorMessage, getStatus } from '../api';
import { serverMessage } from '../errors';
import { login, loginTwoFactor } from '../authApi';
import '../account.css';
import { useAuth } from '../auth/context';
import Banner from '../ui/Banner';
import Button from '../ui/Button';
import CountdownRing from '../ui/CountdownRing';
import Field from '../ui/Field';
import Icon from '../ui/Icon';
import OtpInput from '../ui/OtpInput';
import PasswordField from '../ui/PasswordField';
import PhoneInput from '../ui/PhoneInput';
import { useToast } from '../ui/toastContext';
import { isValidPhone } from '../utils/phone';

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

// Шаг 1: почта или телефон и пароль
function CredentialsStep({ defaultEmail, onTwoFactor }) {
  const auth = useAuth();
  const toast = useToast();
  const [mode, setMode] = useState('email'); // email | phone
  const [email, setEmail] = useState(defaultEmail ?? '');
  const [phone, setPhone] = useState('');
  const [password, setPassword] = useState('');
  const [errors, setErrors] = useState({});
  const [problem, setProblem] = useState('');
  const [loading, setLoading] = useState(false);

  async function handleSubmit(event) {
    event.preventDefault();
    const found = {};
    if (mode === 'email' && !EMAIL_RE.test(email.trim())) found.login = 'Введите корректный e-mail';
    if (mode === 'phone' && !isValidPhone(phone)) found.login = 'Телефон в формате +375(44)4444444';
    if (!password) found.password = 'Введите пароль';
    setErrors(found);
    if (Object.keys(found).length) return;

    setLoading(true);
    setProblem('');
    try {
      const identity = mode === 'email' ? email.trim() : phone;
      const data = await login(identity, password);
      if (data.twoFactorRequired) {
        onTwoFactor({ tempToken: data.tempToken, identity });
      } else {
        auth.signIn(data);
        toast.success('Вы вошли в аккаунт');
      }
    } catch (error) {
      setProblem(getErrorMessage(error));
      setLoading(false);
    }
  }

  return (
    <form onSubmit={handleSubmit} noValidate className="stack">
      {auth.notice && !problem && <Banner kind="info">{auth.notice}</Banner>}
      {problem && <Banner kind="error">{problem}</Banner>}

      <div className="segmented" role="group" aria-label="Способ входа">
        <button type="button" aria-pressed={mode === 'email'} className={mode === 'email' ? 'is-active' : ''} onClick={() => { setMode('email'); setErrors({}); }}>По почте</button>
        <button type="button" aria-pressed={mode === 'phone'} className={mode === 'phone' ? 'is-active' : ''} onClick={() => { setMode('phone'); setErrors({}); }}>По телефону</button>
      </div>

      {mode === 'email' ? (
        <Field label="E-mail" error={errors.login}>
          {(props) => (
            <input
              {...props}
              type="email"
              value={email}
              onChange={(event) => setEmail(event.target.value)}
              autoComplete="username"
              placeholder="name@mail.by"
              autoFocus={Boolean(defaultEmail)}
            />
          )}
        </Field>
      ) : (
        <Field label="Номер телефона" error={errors.login}>
          {(props) => <PhoneInput {...props} value={phone} onChange={setPhone} />}
        </Field>
      )}

      <PasswordField label="Пароль" value={password} onChange={setPassword} error={errors.password} autoComplete="current-password" autoFocus={Boolean(defaultEmail)} />

      <Button type="submit" variant="primary" className="btn-block" loading={loading}>Войти</Button>
    </form>
  );
}

// Шаг 2: код из Google Authenticator (если у аккаунта включена двухфакторная защита)
function CodeStep({ session, onBack, onExpired }) {
  const auth = useAuth();
  const toast = useToast();
  const [code, setCode] = useState('');
  const [error, setError] = useState('');
  const [errorKey, setErrorKey] = useState(0);
  const [loading, setLoading] = useState(false);

  async function verify(value) {
    if (loading) return;
    setLoading(true);
    setError('');
    try {
      auth.signIn(await loginTwoFactor(session.tempToken, value));
      toast.success('Вы вошли в аккаунт');
    } catch (err) {
      const message = getErrorMessage(err);
      // временный токен живёт 5 минут: если он протух, код вводить уже бесполезно
      if (getStatus(err) === 401 && /токен/i.test(serverMessage(err))) {
        onExpired('Время на ввод кода истекло. Войдите ещё раз.');
        return;
      }
      setError(message);
      setErrorKey((n) => n + 1);
      setCode('');
      setLoading(false);
    }
  }

  return (
    <div className="stack code-step">
      <div className="code-hint">
        <span className="code-hint-icon"><Icon name="phone" size={20} /></span>
        <p>Откройте <strong>Google Authenticator</strong> и введите 6-значный код для аккаунта <strong>{session.identity}</strong>.</p>
      </div>

      <OtpInput
        value={code}
        onChange={(value) => { setCode(value); setError(''); }}
        onComplete={verify}
        invalid={Boolean(error)}
        errorKey={errorKey}
        disabled={loading}
        autoFocus
      />

      <div className="code-meta">
        <CountdownRing />
        <span>Код в приложении обновляется каждые 30 секунд</span>
      </div>

      {error && <Banner kind="error">{error}</Banner>}

      <Button variant="primary" className="btn-block" loading={loading} disabled={code.length < 6} onClick={() => verify(code)}>
        Подтвердить
      </Button>
      <Button variant="ghost" className="btn-block" icon="arrowLeft" onClick={onBack} disabled={loading}>Другой аккаунт</Button>
    </div>
  );
}

// Окно входа на главной странице (справа от записи к врачу)
export default function LoginPanel({ registeredEmail }) {
  const [step, setStep] = useState('credentials');
  const [session, setSession] = useState(null);
  const auth = useAuth();

  function backToCredentials(notice) {
    if (notice) auth.signOut(notice);
    setSession(null);
    setStep('credentials');
  }

  return (
    <section className="card login-panel" aria-labelledby="login-title" id="login">
      <header>
        <span className="login-icon"><Icon name="user" size={20} /></span>
        <div>
          <h2 id="login-title">{step === 'credentials' ? 'Личный кабинет' : 'Подтвердите вход'}</h2>
          <p>{step === 'credentials' ? 'Войдите, чтобы записаться и видеть свои талоны' : 'Включена двухфакторная защита'}</p>
        </div>
      </header>

      {registeredEmail && step === 'credentials' && (
        <Banner kind="success" title="Аккаунт создан">Войдите, используя только что созданный пароль.</Banner>
      )}

      {step === 'credentials'
        ? <CredentialsStep defaultEmail={registeredEmail} onTwoFactor={(data) => { setSession(data); setStep('code'); }} />
        : <CodeStep session={session} onBack={() => backToCredentials()} onExpired={backToCredentials} />}

      {step === 'credentials' && (
        <p className="login-foot">Впервые у нас? <Link to="/register" className="login-foot-link">Зарегистрироваться</Link></p>
      )}
    </section>
  );
}
