const express = require('express');
const controller = require('../controllers/slotsController');

// Свободные талоны открыты всем, без входа в систему
const router = express.Router();

router.get('/days', controller.days);
router.get('/', controller.list);

module.exports = router;
