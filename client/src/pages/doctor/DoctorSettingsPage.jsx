import { useState } from 'react';
import { Navigate } from 'react-router-dom';
import { getErrorMessage, getFieldErrors } from '../../api';
import { useAuth } from '../../auth/context';
import { grantDoctorAccess } from '../../doctorApi';
import Banner from '../../ui/Banner';
import Button from '../../ui/Button';
import Field from '../../ui/Field';
import { useToast } from '../../ui/toastContext';

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

// Карточка «Добавить новый доступ»: администратор вводит почту нового врача, и тому уходит письмо с доступом
function AccessCard() {
  const toast = useToast();
  const [email, setEmail] = useState('');
  const [error, setError] = useState('');
  const [problem, setProblem] = useState('');
  const [loading, setLoading] = useState(false);

  async function submit(event) {
    event.preventDefault();
    const value = email.trim();
    setProblem('');
    if (!value) { setError('Введите почту нового врача'); return; }
    if (!EMAIL_RE.test(value)) { setError('Проверьте почту: она должна выглядеть как name@mail.by'); return; }
    setError('');

    setLoading(true);
    try {
      await grantDoctorAccess(value);
      toast.success(`Доступ открыт, письмо отправлено на ${value}`);
      setEmail('');
    } catch (err) {
      const fields = getFieldErrors(err);
      if (fields.email) setError(fields.email);
      else setProblem(getErrorMessage(err));
    } finally {
      setLoading(false);
    }
  }

  return (
    <section className="card dr-settings-card">
      <header className="dr-panel-head">
        <h2>Добавить новый доступ</h2>
        <span className="dr-sub">Для нового врача или коллеги</span>
      </header>
      <form onSubmit={submit} noValidate className="dr-settings-body">
        <p className="dr-login-note">
          Введите почту нового врача. Мы создадим ему аккаунт и отправим на неё письмо с ролью, почтой и паролем.
        </p>
        {problem && <Banner kind="error">{problem}</Banner>}
        <div className="dr-access-row">
          <Field label="Почта нового врача" error={error} className="dr-access-field">
            {(props) => (
              <input
                {...props}
                type="email"
                value={email}
                onChange={(event) => { setEmail(event.target.value); setError(''); }}
                placeholder="name@mail.by"
                autoComplete="off"
                disabled={loading}
              />
            )}
          </Field>
          <Button type="submit" variant="primary" icon="plus" loading={loading}>Добавить</Button>
        </div>
      </form>
    </section>
  );
}

// Раздел только для администратора: обычного врача возвращаем к списку записей
export default function DoctorSettingsPage() {
  const { isAdmin } = useAuth();
  if (!isAdmin) return <Navigate to="/doctor" replace />;

  return (
    <>
      <title>Настройки — Моя клиника</title>
      <div className="page-head">
        <div>
          <h1>Настройки</h1>
          <p>Доступ к кабинету для других врачей</p>
        </div>
      </div>
      <div className="dr-settings">
        <AccessCard />
      </div>
    </>
  );
}
