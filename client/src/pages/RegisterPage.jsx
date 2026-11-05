import { useEffect, useRef, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import '../account.css';
import { getDetailMessages, getErrorMessage, getFieldErrors, getStatus } from '../api';
import { registerComplete, registerStart, registerVerify } from '../authApi';
import PasswordChecklist from '../components/PasswordChecklist';
import PatientFields from '../components/PatientFields';
import { emptyProfile, validateProfile } from '../utils/patient';
import { checkPassword } from '../utils/passwordRules';
import Banner from '../ui/Banner';
import Button from '../ui/Button';
import Field from '../ui/Field';
import Icon from '../ui/Icon';
import OtpInput from '../ui/OtpInput';
import PasswordField from '../ui/PasswordField';
import { useToast } from '../ui/toastContext';

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

// Карточка шага: номер, заголовок, состояние (активен, пройден). Содержимое рисуется только когда шаг открыт.
function Step({ number, title, done, summary, action, children, stepRef }) {
  return (
    <section ref={stepRef} className={`rstep ${done ? 'is-done' : ''}`}>
      <header>
        <span className="rstep-num">{done ? <Icon name="check" size={16} strokeWidth={3} /> : number}</span>
        <h2>{title}</h2>
        {done && summary && <span className="rstep-summary">{summary}</span>}
        {done && action}
      </header>
      {children && <div className="rstep-body">{children}</div>}
    </section>
  );
}

export default function RegisterPage() {
  const navigate = useNavigate();
  const toast = useToast();

  // шаг 1: почта и код
  const [email, setEmail] = useState('');
  const [emailError, setEmailError] = useState('');
  const [sending, setSending] = useState(false);
  const [codeSent, setCodeSent] = useState(false);
  const [cooldown, setCooldown] = useState(0);
  const [code, setCode] = useState('');
  const [codeError, setCodeError] = useState('');
  const [codeErrorKey, setCodeErrorKey] = useState(0);
  const [verifying, setVerifying] = useState(false);
  const [token, setToken] = useState(null);

  // шаг 2: анкета; шаг 3: пароль
  const [profile, setProfile] = useState(emptyProfile);
  const [profileErrors, setProfileErrors] = useState({});
  const [passwordOpen, setPasswordOpen] = useState(false);
  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [passwordErrors, setPasswordErrors] = useState({});
  const [submitting, setSubmitting] = useState(false);
  const [formError, setFormError] = useState('');

  const profileRef = useRef(null);
  const passwordRef = useRef(null);
  const verified = Boolean(token);
  const strength = checkPassword(password, email);

  // обратный отсчёт до повторной отправки кода
  useEffect(() => {
    if (cooldown <= 0) return undefined;
    const timer = setTimeout(() => setCooldown((s) => s - 1), 1000);
    return () => clearTimeout(timer);
  }, [cooldown]);

  // новые шаги «дорисовываются» снизу — плавно прокручиваем к ним
  useEffect(() => {
    if (verified) profileRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' });
  }, [verified]);
  useEffect(() => {
    if (passwordOpen) passwordRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' });
  }, [passwordOpen]);

  async function sendCode() {
    if (!EMAIL_RE.test(email.trim())) {
      setEmailError('Введите корректный e-mail');
      return;
    }
    setSending(true);
    setEmailError('');
    try {
      const data = await registerStart(email.trim());
      setCodeSent(true);
      setCode('');
      setCodeError('');
      setCooldown(data.resendAfterSeconds ?? 60);
    } catch (error) {
      const message = getErrorMessage(error);
      setEmailError(message);
      const wait = /через (\d+) с/.exec(message);
      if (getStatus(error) === 429 && wait) { setCodeSent(true); setCooldown(Number(wait[1])); }
    } finally {
      setSending(false);
    }
  }

  async function verifyCode(value) {
    if (verifying) return;
    setVerifying(true);
    setCodeError('');
    try {
      const data = await registerVerify(email.trim(), value);
      setToken(data.registrationToken);
    } catch (error) {
      setCodeError(getErrorMessage(error));
      setCodeErrorKey((n) => n + 1);
      setCode('');
    } finally {
      setVerifying(false);
    }
  }

  function changeEmail() {
    setToken(null);
    setCodeSent(false);
    setCode('');
    setPasswordOpen(false);
  }

  const setField = (name, value) => {
    setProfile((prev) => ({ ...prev, [name]: value }));
    setProfileErrors((prev) => ({ ...prev, [name]: undefined, ...(name === 'noMiddleName' ? { middleName: undefined } : {}), ...(name === 'birthDate' ? { socialStatus: undefined, trustedPerson: undefined } : {}) }));
  };

  function goToPassword() {
    const found = validateProfile(profile);
    setProfileErrors(found);
    if (Object.keys(found).length === 0) setPasswordOpen(true);
    else document.querySelector('.rstep .has-error')?.scrollIntoView({ behavior: 'smooth', block: 'center' });
  }

  async function handleSubmit(event) {
    event.preventDefault();
    const found = validateProfile(profile);
    setProfileErrors(found);
    const pwErrors = {};
    if (!strength.valid) pwErrors.password = 'Пароль не соответствует требованиям';
    if (confirm !== password) pwErrors.confirm = 'Пароли не совпадают';
    setPasswordErrors(pwErrors);
    if (Object.keys(found).length || Object.keys(pwErrors).length) return;

    setSubmitting(true);
    setFormError('');
    try {
      await registerComplete(token, profile, password);
      toast.success('Вы зарегистрировались. Теперь войдите в аккаунт');
      navigate('/', { replace: true, state: { registered: email.trim() } });
    } catch (error) {
      const fields = getFieldErrors(error);
      const { password: passwordProblem, ...profileProblems } = fields;
      if (getStatus(error) === 401) {
        changeEmail();
        setFormError('Время на завершение регистрации истекло. Подтвердите почту ещё раз.');
      } else {
        if (Object.keys(profileProblems).length) setProfileErrors(profileProblems);
        if (passwordProblem) setPasswordErrors({ password: passwordProblem });
        setFormError(Object.keys(fields).length ? 'Проверьте поля, отмеченные красным' : getErrorMessage(error));
        if (getStatus(error) === 409) { changeEmail(); setEmailError(getErrorMessage(error)); }
        const details = getDetailMessages(error);
        if (details.length && !Object.keys(fields).length) setFormError(details.join('. '));
      }
      setSubmitting(false);
    }
  }

  return (
    <div className="register">
      <title>Регистрация пациента — Твой талон</title>
      <div className="page-head">
        <div>
          <h1>Регистрация пациента</h1>
          <p>Три шага: подтверждение почты, анкета и пароль</p>
        </div>
      </div>

      <div className="login-callout" role="note">
        <div className="login-callout-text">
          <strong>Уже есть аккаунт?</strong>
          <span>Регистрироваться заново не нужно: войдите со своей почтой или телефоном и паролем.</span>
        </div>
        <Link to="/" className="btn btn-primary">Войти</Link>
      </div>

      {formError && <Banner kind="error">{formError}</Banner>}

      <div className="rsteps">
        {/* ---------- 1. Подтверждение почты ---------- */}
        <Step
          number={1}
          title="Подтверждение почты"
          done={verified}
          summary={email.trim()}
          action={<button type="button" className="link-btn" onClick={changeEmail}>Изменить</button>}
        >
          {!verified && (
            <div className="stack">
              <div className="email-row">
                <Field label="E-mail" error={emailError} hint={!codeSent ? 'Мы отправим на него 6-значный код' : undefined}>
                  {(props) => (
                    <input
                      {...props}
                      type="email"
                      value={email}
                      disabled={codeSent}
                      onChange={(event) => { setEmail(event.target.value); setEmailError(''); }}
                      onKeyDown={(event) => { if (event.key === 'Enter') { event.preventDefault(); if (!codeSent) sendCode(); } }}
                      autoComplete="email"
                      placeholder="name@mail.by"
                      autoFocus
                    />
                  )}
                </Field>
                {!codeSent && <Button variant="primary" loading={sending} onClick={sendCode}>Отправить код</Button>}
              </div>

              {codeSent && (
                <div className="code-block">
                  <p>Код отправлен на <strong>{email.trim()}</strong>. Введите его ниже — письмо приходит в течение минуты.</p>
                  <OtpInput
                    value={code}
                    onChange={(value) => { setCode(value); setCodeError(''); }}
                    onComplete={verifyCode}
                    invalid={Boolean(codeError)}
                    errorKey={codeErrorKey}
                    disabled={verifying}
                    autoFocus
                  />
                  {codeError && <p className="field-error" role="alert">{codeError}</p>}
                  <div className="code-actions">
                    <Button variant="primary" loading={verifying} disabled={code.length < 6} onClick={() => verifyCode(code)}>Подтвердить</Button>
                    <Button loading={sending} disabled={cooldown > 0} onClick={sendCode}>
                      {cooldown > 0 ? `Отправить ещё раз через ${cooldown} с` : 'Отправить ещё раз'}
                    </Button>
                    <button type="button" className="link-btn" onClick={changeEmail}>Другая почта</button>
                  </div>
                </div>
              )}
            </div>
          )}
        </Step>

        {/* ---------- 2. Анкета ---------- */}
        {verified && (
          <Step number={2} title="Анкета пациента" done={passwordOpen && Object.keys(profileErrors).length === 0} summary="заполнена" stepRef={profileRef}>
            <PatientFields values={profile} errors={profileErrors} onChange={setField} />
            {!passwordOpen && (
              <div className="rstep-actions">
                <Button variant="primary" onClick={goToPassword}>Далее — создать пароль</Button>
              </div>
            )}
          </Step>
        )}

        {/* ---------- 3. Пароль ---------- */}
        {verified && passwordOpen && (
          <Step number={3} title="Создание пароля" stepRef={passwordRef}>
            <form onSubmit={handleSubmit} noValidate className="stack form-narrow">
              <div className="stack-tight">
                <PasswordField
                  label="Пароль"
                  value={password}
                  onChange={(value) => { setPassword(value); setPasswordErrors((prev) => ({ ...prev, password: undefined })); }}
                  error={passwordErrors.password}
                  autoComplete="new-password"
                  autoFocus
                />
                <PasswordChecklist result={strength} touched={password.length > 0} />
              </div>
              <PasswordField
                label="Повторите пароль"
                value={confirm}
                onChange={(value) => { setConfirm(value); setPasswordErrors((prev) => ({ ...prev, confirm: undefined })); }}
                error={passwordErrors.confirm || (confirm.length > 0 && confirm !== password ? 'Пароли не совпадают' : undefined)}
                autoComplete="new-password"
              />
              <Button type="submit" variant="primary" loading={submitting}>Создать аккаунт</Button>
            </form>
          </Step>
        )}
      </div>

    </div>
  );
}
