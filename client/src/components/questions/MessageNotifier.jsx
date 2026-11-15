import { useRef } from 'react';
import { useSocketEvent } from '../../realtime/hooks';
import { isConversationOpen } from '../../realtime/openConversation';
import { useToast } from '../../ui/toastContext';

const MIN_GAP_MS = 5000;

// Всплывающее уведомление о новом сообщении («Врач ответил на ваш вопрос» / «Новый вопрос от пациента»).
// Не показывается, если эта беседа сейчас открыта в окне: сообщение и так на экране.
// Когда после возвращения в сеть приходит сразу несколько сообщений, всплывает одно уведомление, а не пачка
export default function MessageNotifier({ side }) {
  const toast = useToast();
  const lastShown = useRef(0);

  useSocketEvent('chat:message', ({ conversationId, message }) => {
    if (message.from === side || isConversationOpen(conversationId)) return;
    if (Date.now() - lastShown.current < MIN_GAP_MS) return;
    lastShown.current = Date.now();
    if (side === 'patient') {
      toast.info('Откройте «Мои вопросы», чтобы прочитать ответ.', { title: 'Врач ответил на ваш вопрос', duration: 7000 });
    } else {
      toast.info('Откройте раздел «Вопросы», чтобы ответить.', { title: 'Новый вопрос от пациента', duration: 7000 });
    }
  });

  return null;
}
