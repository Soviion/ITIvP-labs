import QuestionsPage from '../../components/questions/QuestionsPage';

// «Вопросы пациентов»: переписка врача с пациентами, которые написали через его профиль
export default function DoctorQuestionsPage() {
  return (
    <QuestionsPage
      side="doctor"
      title="Вопросы пациентов"
      siteName="Моя клиника"
      lead="Пациенты пишут вам через ваш профиль. Если пациент не в сети, ваш ответ дождётся его и будет доставлен, когда он вернётся."
      emptyText="Когда пациент задаст вам вопрос, он появится здесь, а в меню загорится красный кружок."
    />
  );
}
