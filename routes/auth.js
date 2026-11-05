const express = require('express');
const controller = require('../controllers/authController');
const registration = require('../controllers/registrationController');
const auth = require('../middleware/auth');
const limiters = require('../middleware/rateLimit');

const router = express.Router();

router.use(limiters.general);

// Регистрация пациента: код из письма → анкета и пароль
router.post('/register/start', limiters.mail, registration.start);
router.post('/register/verify', limiters.credentials, registration.verify);
router.post('/register/complete', limiters.credentials, registration.complete);

router.post('/login', limiters.credentials, controller.login);
router.post('/doctor/login', limiters.credentials, controller.doctorLogin);
router.post('/doctor/login/2fa', limiters.credentials, controller.doctorLoginTwoFactor);
router.post('/login/2fa', limiters.credentials, controller.loginTwoFactor);

// Требуют авторизации
router.post('/change-password', auth, limiters.credentials, controller.changePassword);
router.post('/2fa/setup', auth, controller.twoFactorSetup);
router.get('/2fa/qr', auth, controller.twoFactorQr);
router.post('/2fa/enable', auth, controller.twoFactorEnable);
router.post('/2fa/disable', auth, limiters.credentials, controller.twoFactorDisable);

module.exports = router;
