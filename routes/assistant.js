const express = require('express');
const controller = require('../controllers/assistantController');
const limiters = require('../middleware/rateLimit');

// Чат-помощник для пациентов: без входа, поэтому с ограничениями по IP (см. middleware/rateLimit.js и services/ai/guard.js)
const router = express.Router();

router.post('/chat', limiters.assistantBurst, limiters.assistantHourly, controller.chat);

module.exports = router;
