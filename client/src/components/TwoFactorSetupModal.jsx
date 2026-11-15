import { useState } from 'react';
import { getErrorMessage } from '../api';
import { enableTwoFactor, setupTwoFactor } from '../authApi';
import Banner from '../ui/Banner';
import Button from '../ui/Button';
import CountdownRing from '../ui/CountdownRing';
import Icon from '../ui/Icon';
import Modal from '../ui/Modal';
import OtpInput from '../ui/OtpInput';
import { useToast } from '../ui/toastContext';

const STEPS = ['Приложение', 'QR-код', 'Проверка кода'];

// ключ из base32 удобнее читать группами по 4 символа, в две строки
function groupSecret(secret) {
  const groups = secret.match(/.{1,4}/g) ?? [secret];
  return [groups.slice(0, 4).join(' '), groups.slice(4).join(' ')].filter(Boolean).join('\n');
}

function Stepper({ step }) {
  return (
    <ol className="stepper" aria-label="Шаги настройки">
      {STEPS.map((label, index) => {
        const state = step > index ? 'done' : step === index ? 'current' : 'todo';
        return (
          <li key={label} className={`step step-${state}`} aria-current={state === 'current' ? 'step' : undefined}>
            <span className="step-dot">{state === 'done' ? <Icon name="check" size={14} strokeWidth={3} /> : index + 1}</span>
            <span className="step-label">{label}</span>
          </li>
        );
      })}
    </ol>
  );
}

function AppStep({ onNext, loading, error }) {
  return (
    <div className="stack">
      <div>
        <h3 className="wizard-title">Установите Google Authenticator</h3>
        <p className="muted">Приложение будет показывать одноразовые коды для входа в личный кабинет.</p>
      </div>
      <ul className="app-list">
        <li className="app-item is-main">
          <span className="app-badge">G</span>
          <div>
            <strong>Google Authenticator</strong>
            <span>App Store и Google Play — бесплатно</span>
          </div>
        </li>
      </ul>
      {error && <Banner kind="error">{error}</Banner>}
      <div className="wizard-actions">
        <Button variant="primary" loading={loading} onClick={onNext} icon="shield">Приложение установлено — показать QR-код</Button>
      </div>
    </div>
  );
}

function ScanStep({ setup, onNext, onBack }) {
  const toast = useToast();

  async function copySecret() {
    try {
      await navigator.clipboard.writeText(setup.secret);
      toast.success('Ключ скопирован в буфер обмена');
    } catch {
      toast.info('Не удалось скопировать автоматически — выделите ключ вручную');
    }
  }

  return (
    <div className="stack">
      <div>
        <h3 className="wizard-title">Отсканируйте QR-код</h3>
        <p className="muted">В приложении нажмите «+», выберите «Сканировать QR-код» и наведите камеру телефона на экран.</p>
      </div>

      <div className="scan-layout">
        <div className="qr" role="img" aria-label="QR-код для добавления аккаунта в Google Authenticator">
          <img src={setup.qrCode} alt="" width="220" height="220" />
          <span className="qr-corner tl" />
          <span className="qr-corner tr" />
          <span className="qr-corner bl" />
          <span className="qr-corner br" />
          <span className="qr-scan" />
        </div>

        <div className="manual">
          <strong>Не получается отсканировать?</strong>
          <p>Выберите «Ввести ключ настройки» и укажите его вручную:</p>
          <div className="secret">
            <code>{groupSecret(setup.secret)}</code>
            <Button size="sm" icon="copy" onClick={copySecret}>Копировать</Button>
          </div>
          <dl className="facts">
            <div><dt>Тип</dt><dd>по времени (TOTP)</dd></div>
            <div><dt>Цифр в коде</dt><dd>6</dd></div>
            <div><dt>Шаг</dt><dd>30 секунд</dd></div>
          </dl>
        </div>
      </div>

      <div className="wizard-actions">
        <Button variant="ghost" icon="arrowLeft" onClick={onBack}>Назад</Button>
        <Button variant="primary" onClick={onNext}>Далее — ввести код</Button>
      </div>
    </div>
  );
}

function VerifyStep({ onBack, onEnabled }) {
  const [code, setCode] = useState('');
  const [error, setError] = useState('');
  const [errorKey, setErrorKey] = useState(0);
  const [loading, setLoading] = useState(false);

  async function verify(value) {
    if (loading) return;
    setLoading(true);
    setError('');
    try {
      onEnabled(await enableTwoFactor(value));
    } catch (err) {
      setError(getErrorMessage(err));
      setErrorKey((n) => n + 1);
      setCode('');
      setLoading(false);
    }
  }

  return (
    <div className="stack">
      <div>
        <h3 className="wizard-title">Введите код из приложения</h3>
        <p className="muted">Так мы убедимся, что аккаунт добавлен правильно. Введите 6 цифр, которые сейчас показывает приложение.</p>
      </div>

      <div className="verify-box">
        <OtpInput value={code} onChange={(value) => { setCode(value); setError(''); }} onComplete={verify} invalid={Boolean(error)} errorKey={errorKey} disabled={loading} autoFocus />
        <div className="code-meta">
          <CountdownRing />
          <span>Новый код появится, когда кольцо опустеет</span>
        </div>
      </div>

      {error && <Banner kind="error">{error}</Banner>}

      <div className="wizard-actions">
        <Button variant="ghost" icon="arrowLeft" onClick={onBack} disabled={loading}>Назад</Button>
        <Button variant="primary" loading={loading} disabled={code.length < 6} onClick={() => verify(code)}>Включить защиту</Button>
      </div>
    </div>
  );
}

function DoneStep({ onClose }) {
  return (
    <div className="stack done-step">
      <div className="done-badge"><Icon name="shieldCheck" size={40} /></div>
      <h3 className="wizard-title">Двухфакторная защита включена</h3>
      <p className="muted">
        Теперь при входе, кроме пароля, нужно вводить код из Google Authenticator. Если потеряете телефон, вход без кода будет невозможен —
        сохраните ключ настройки в надёжном месте.
      </p>
      <Button variant="primary" onClick={onClose}>Готово</Button>
    </div>
  );
}

function Wizard({ onClose, onEnabled }) {
  const [step, setStep] = useState(0); // 0 приложение, 1 QR, 2 код, 3 готово
  const [setup, setSetup] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  // Секрет создаётся по нажатию кнопки (а не автоматически при открытии окна): каждый вызов выдаёт новый ключ
  async function startSetup() {
    setLoading(true);
    setError('');
    try {
      setSetup(await setupTwoFactor());
      setStep(1);
    } catch (err) {
      setError(getErrorMessage(err));
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="wizard">
      {step < 3 && <Stepper step={step} />}
      <div className="wizard-body">
        {step === 0 && <AppStep onNext={startSetup} loading={loading} error={error} />}
        {step === 1 && <ScanStep setup={setup} onBack={() => setStep(0)} onNext={() => setStep(2)} />}
        {step === 2 && <VerifyStep onBack={() => setStep(1)} onEnabled={(data) => { onEnabled(data); setStep(3); }} />}
        {step === 3 && <DoneStep onClose={onClose} />}
      </div>
    </div>
  );
}

export default function TwoFactorSetupModal({ open, onClose, onEnabled }) {
  return (
    <Modal open={open} onClose={onClose} title="Двухфакторная аутентификация" subtitle="Вход с кодом из Google Authenticator" size="lg">
      <Wizard onClose={onClose} onEnabled={onEnabled} />
    </Modal>
  );
}
