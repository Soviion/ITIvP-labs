import { Link } from 'react-router-dom';
import QuestionsPage from '../components/questions/QuestionsPage';

// «Мои вопросы»: переписка пациента с врачами
export default function CabinetQuestionsPage() {
  return (
    <QuestionsPage
      side="patient"
      title="Мои вопросы"
      siteName="Твой талон"
      lead="Переписка с врачами. Если врач не в сети, он ответит позже: ответ придёт сюда, а в меню загорится красный кружок."
      emptyText="Откройте профиль врача и нажмите «Задать вопрос»."
      emptyAction={<Link to="/" className="btn btn-primary">Выбрать врача</Link>}
    />
  );
}
