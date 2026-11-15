const express = require('express');
const controller = require('../controllers/profileController');
const auth = require('../middleware/auth');

const router = express.Router();

router.get('/', auth, controller.getProfile);

module.exports = router;
