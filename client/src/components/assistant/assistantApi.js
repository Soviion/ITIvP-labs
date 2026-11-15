import { api } from '../../api';

// Помощник для пациентов: сервер отвечает на вопросы о записи и работе сайта (POST /assistant/chat, вход не нужен)
export const MAX_QUESTION = 500; // длина вопроса, как на сервере
export const MAX_HISTORY = 6; // сколько последних реплик уходит на сервер вместе с вопросом

// history – последние реплики [{ role: 'user' | 'assistant', content }]. Ответ: { answer, source: 'model' | 'cache' | 'static' }
export const askAssistant = (message, history, signal) => api
  .post('/assistant/chat', { message, history }, { skipAuth: true, retry: false, timeout: 30_000, signal })
  .then(({ data }) => data);
