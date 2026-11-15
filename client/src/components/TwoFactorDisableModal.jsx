import { useState } from 'react';
import { getErrorMessage, getStatus } from '../api';
import { disableTwoFactor } from '../authApi';
import Banner from '../ui/Banner';
import Button from '../ui/Button';
import CountdownRing from '../ui/CountdownRing';
import Modal from '../ui/Modal';
import OtpInput from '../ui/OtpInput';
import PasswordField from '../ui/PasswordField';

function DisableForm({ onClose, onDisabled }) {
  const [password, setPassword] = useState('');
  const [code, setCode] = useState('');
  const [passwordError, setPasswordError] = useState('');
  const [codeError, setCodeError] = useState('');
  const [errorKey, setErrorKey] = useState(0);
  const [loading, setLoading] = useState(false);

  async function handleSubmit(event) {
    event.preventDefault();
    if (!password) {
      setPasswordError('Введите текущий пароль');
      return;
    }
    if (code.length < 6) {
      setCodeError('Введите 6-значный код из приложения');
      return;
    }

    setLoading(true);
    setPasswordError('');
    setCodeError('');
    try {
      onDisabled(await disableTwoFactor(password, code));
    } catch (err) {
      const message = getErrorMessage(err);
      if (getStatus(err) === 403) setPasswordError(message);
      else {
        setCodeError(message);
        setCode('');
        setErrorKey((n) => n + 1);
      }
      setLoading(false);
    }
  }

  return (
    <form onSubmit={handleSubmit} noValidate className="modal-form">
      <div className="modal-body stack">
        <Banner kind="warn" title="Защита аккаунта станет слабее">
          После отключения вход будет возможен только по паролю.
        </Banner>

        <PasswordField label="Текущий пароль" value={password} onChange={(value) => { setPassword(value); setPasswordError(''); }} error={passwordError} autoComplete="current-password" autoFocus />

        <div className="field">
          <label>Код из Google Authenticator</label>
          <OtpInput value={code} onChange={(value) => { setCode(value); setCodeError(''); }} invalid={Boolean(codeError)} errorKey={errorKey} disabled={loading} />
          {codeError && <p className="field-error" role="alert">{codeError}</p>}
          <div className="code-meta">
            <CountdownRing />
            <span>Код обновляется каждые 30 секунд</span>
          </div>
        </div>
      </div>
      <footer className="modal-footer">
        <Button onClick={onClose} disabled={loading}>Отмена</Button>
        <Button type="submit" variant="danger" loading={loading}>Отключить защиту</Button>
      </footer>
    </form>
  );
}

export default function TwoFactorDisableModal({ open, onClose, onDisabled }) {
  return (
    <Modal open={open} onClose={onClose} title="Отключить двухфакторную защиту" subtitle="Подтвердите действие паролем и кодом" size="sm" bare>
      <DisableForm onClose={onClose} onDisabled={onDisabled} />
    </Modal>
  );
}
