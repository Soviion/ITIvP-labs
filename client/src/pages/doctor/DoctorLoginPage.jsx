import { useState } from 'react';
import { Link, Navigate } from 'react-router-dom';
import { getErrorMessage, getStatus } from '../../api';
import { serverMessage } from '../../errors';
import { useAuth } from '../../auth/context';
import { ClinicMark } from '../../components/doctor/DoctorLayout';
import { doctorLogin, doctorLoginTwoFactor } from '../../doctorApi';
import Banner from '../../ui/Banner';
import Button from '../../ui/Button';
import CountdownRing from '../../ui/CountdownRing';
import Field from '../../ui/Field';
import OtpInput from '../../ui/OtpInput';
import PasswordField from '../../ui/PasswordField';
import { useToast } from '../../ui/toastContext';
import '../../doctor.css';

// В кабинет врача входят врачи и администратор
const canEnter = (role) => role === 'doctor' || role === 'admin';
const NOT_DOCTOR = 'Этот аккаунт не принадлежит врачу. Пациенты входят на сайте «Твой талон».';

function CredentialsStep({ onTwoFactor }) {
  const auth = useAuth();
  const toast = useToast();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [errors, setErrors] = useState({});
  const [problem, setProblem] = useState('');
  const [loading, setLoading] = useState(false);

  async function submit(event) {
    event.preventDefault();
    const found = {};
    if (!email.trim()) found.email = 'Введите почту или логин';
    if (!password) found.password = 'Введите пароль';
    setErrors(found);
    if (Object.keys(found).length) return;

    setLoading(true);
    setProblem('');
    try {
      const data = await doctorLogin(email.trim(), password);
      if (data.twoFactorRequired) {
        onTwoFactor({ tempToken: data.tempToken, identity: email.trim() });
        return;
      }
      if (!canEnter(data.user?.role)) {
        setProblem(NOT_DOCTOR);
        setLoading(false);
        return;
      }
      auth.signIn(data);
      toast.success('Добро пожаловать');
    } catch (error) {
      setProblem(getErrorMessage(error));
      setLoading(false);
    }
  }

  return (
    <form onSubmit={submit} noValidate className="stack">
      {auth.notice && !problem && <Banner kind="info">{auth.notice}</Banner>}
      {problem && <Banner kind="error">{problem}</Banner>}
      <Field label="Почта или логин" error={errors.email}>
        {(props) => (
          <input {...props} type="text" value={email} onChange={(event) => setEmail(event.target.value)} autoComplete="username" autoFocus />
        )}
      </Field>
      <PasswordField label="Пароль" value={password} onChange={setPassword} error={errors.password} autoComplete="current-password" />
      <Button type="submit" variant="primary" className="btn-block" loading={loading}>Войти в кабинет</Button>
    </form>
  );
}

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
      const data = await doctorLoginTwoFactor(session.tempToken, value);
      if (!canEnter(data.user?.role)) {
        onExpired(NOT_DOCTOR);
        return;
      }
      auth.signIn(data);
      toast.success('Добро пожаловать');
    } catch (err) {
      const message = getErrorMessage(err);
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
      <p className="dr-login-note">Введите 6-значный код из Google Authenticator для аккаунта <strong>{session.identity}</strong>.</p>
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
        <span>Код обновляется каждые 30 секунд</span>
      </div>
      {error && <Banner kind="error">{error}</Banner>}
      <Button variant="primary" className="btn-block" loading={loading} disabled={code.length < 6} onClick={() => verify(code)}>Подтвердить</Button>
      <Button variant="ghost" className="btn-block" icon="arrowLeft" onClick={onBack} disabled={loading}>Другой аккаунт</Button>
    </div>
  );
}

// Отдельная страница входа для врачей: /doctor/login
export default function DoctorLoginPage() {
  const { status, isDoctor, isAdmin, profile, user, signOut } = useAuth();
  const [step, setStep] = useState('credentials');
  const [session, setSession] = useState(null);

  if (status === 'authed' && (isDoctor || isAdmin)) return <Navigate to="/doctor" replace />;
  // токен есть, но роль ещё не получена с сервера — не показываем форму зря
  const roleUnknown = status === 'authed' && profile === 'loading';
  const wrongRole = status === 'authed' && !roleUnknown && !isDoctor && !isAdmin;

  function backToCredentials(notice) {
    if (notice) signOut(notice);
    setSession(null);
    setStep('credentials');
  }

  return (
    <div className="dr-login">
      <aside className="dr-login-side">
        <div className="dr-login-brand">
          <ClinicMark size={34} />
          <span>Моя клиника</span>
        </div>
        <div className="dr-login-text">
          <h1>Рабочее место врача</h1>
          <hr></hr>
        </div>
      </aside>

      <main className="dr-login-main" id="main-content" tabIndex={-1}>
        <div className="dr-login-card">
          <h2>{step === 'credentials' ? 'Вход для врачей' : 'Подтвердите вход'}</h2>

          {roleUnknown && <p className="dr-login-note">Проверяем сессию…</p>}

          {wrongRole && (
            <div className="stack">
              <Banner kind="warn" title="Вы вошли не как врач">
                Сейчас открыт аккаунт {user?.email}. Выйдите из него, чтобы войти в кабинет врача.
              </Banner>
              <Button variant="primary" className="btn-block" onClick={() => signOut()}>Выйти и войти как врач</Button>
            </div>
          )}

          {!roleUnknown && !wrongRole && (step === 'credentials'
            ? <CredentialsStep onTwoFactor={(data) => { setSession(data); setStep('code'); }} />
            : <CodeStep session={session} onBack={() => backToCredentials()} onExpired={backToCredentials} />)}

          <p className="dr-login-foot">Вы пациент? <Link to="/">Перейти на сайт «Твой талон»</Link></p>
        </div>
      </main>
    </div>
  );
}
