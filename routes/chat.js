const express = require('express');
const controller = require('../controllers/chatController');
const ApiError = require('../utils/ApiError');
const { isEnabled, isConnected } = require('../config/mongo');

// Вопросы врачу. Подключается в server.js за auth; участником беседы может быть только её пациент или врач.
// История хранится в MongoDB: пока она недоступна, чат отвечает 503, а остальной сайт работает как обычно
const router = express.Router();

router.use((req, res, next) => {
  if (!isEnabled()) return next(new ApiError(503, 'Вопросы врачу отключены в настройках сервера'));
  if (!isConnected()) return next(new ApiError(503, 'Вопросы врачу временно недоступны. Повторите попытку позже'));
  return next();
});

router.get('/unread', controller.unread);
router.get('/conversations', controller.list);
router.post('/conversations', controller.open);
router.get('/conversations/:id/messages', controller.messages);
router.post('/conversations/:id/read', controller.read);

module.exports = router;
