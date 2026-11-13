import { useSocketEvent } from '../realtime/hooks';
import { useToast } from '../ui/toastContext';

const BY = { staff: 'регистратурой', doctor: 'врачом' };

// ГГГГ-ММ-ДД → ДД.ММ.ГГГГ
const dotDate = (iso) => iso.split('-').reverse().join('.');

// Тосты пациенту, когда его запись изменили не он сам, а регистратура или врач: «талон отменён», «запись перенесена».
// Список талонов при этом обновляется сам (useMyAppointments), здесь только уведомление.
// Свои действия пациент и так видит, поэтому на них (actor = patient) тост не показывается
export default function AppointmentToasts() {
  const toast = useToast();

  useSocketEvent('appointments:changed', (event) => {
    if (event.actor === 'patient') return;
    const when = `${dotDate(event.date)} в ${event.time}`;
    const by = BY[event.actor] ?? 'клиникой';
    const options = { duration: 7000 };

    switch (event.action) {
      case 'cancelled':
        toast.info(`Запись на ${when} отменена ${by}.`, { ...options, title: 'Талон отменён' });
        break;
      case 'rescheduled':
        toast.info(`Ваша запись перенесена ${by}: теперь ${when}.`, { ...options, title: 'Запись перенесена' });
        break;
      case 'booked':
        toast.info(`Вас записали на ${when}.`, { ...options, title: 'Новая запись' });
        break;
      case 'completed':
        toast.info('Заключение врача — в разделе «Моя история болезни».', { ...options, title: 'Приём завершён' });
        break;
      case 'deleted':
        toast.info(`Запись на ${when} удалена ${by}.`, { ...options, title: 'Запись удалена' });
        break;
      default:
        toast.info(`Данные записи на ${when} изменены ${by}.`, { ...options, title: 'Запись изменена' });
    }
  });

  return null;
}
