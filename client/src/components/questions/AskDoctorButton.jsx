import { useState } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { getErrorMessage } from '../../api';
import { useAuth } from '../../auth/context';
import { openConversation } from '../../questionsApi';
import Button from '../../ui/Button';
import Modal from '../../ui/Modal';
import { useToast } from '../../ui/toastContext';
import QuestionWindow from './QuestionWindow';

// «Задать вопрос» в профиле врача. Гостю предлагает войти (после входа он вернётся на эту страницу),
// вошедшему пациенту открывает окно беседы с этим врачом. Регистратуре и администратору кнопка не нужна: они в чате не участвуют
export default function AskDoctorButton({ doctor }) {
  const { status, isStaff } = useAuth();
  const toast = useToast();
  const location = useLocation();
  const [busy, setBusy] = useState(false);
  const [needLogin, setNeedLogin] = useState(false);
  const [conversation, setConversation] = useState(null);

  if (isStaff) return null;

  async function ask() {
    if (status !== 'authed') {
      setNeedLogin(true);
      return;
    }
    setBusy(true);
    try {
      setConversation(await openConversation(doctor.id));
    } catch (error) {
      toast.error(getErrorMessage(error), { title: 'Вопрос недоступен', duration: 6000 });
    } finally {
      setBusy(false);
    }
  }

  return (
    <>
      <Button icon="message" loading={busy} onClick={ask}>Задать вопрос</Button>

      <Modal
        open={needLogin}
        onClose={() => setNeedLogin(false)}
        size="sm"
        title="Войдите, чтобы задать вопрос"
        footer={(
          <>
            <Button onClick={() => setNeedLogin(false)}>Не сейчас</Button>
            <Link to="/register" className="btn btn-secondary">Регистрация</Link>
            <Link to="/" state={{ from: location.pathname }} className="btn btn-primary">Войти</Link>
          </>
        )}
      >
        <p>Вопросы врачу доступны зарегистрированным пациентам: так врач понимает, кто спрашивает, а ответ приходит лично вам. После входа вы вернётесь на эту страницу.</p>
      </Modal>

      {conversation && <QuestionWindow key={conversation.id} conversation={conversation} side="patient" onClose={() => setConversation(null)} />}
    </>
  );
}
