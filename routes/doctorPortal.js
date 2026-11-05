const express = require('express');
const mongoose = require('mongoose');
const controller = require('../controllers/doctorPortalController');
const ApiError = require('../utils/ApiError');
const access = require('../controllers/doctorAccessController');
const limiters = require('../middleware/rateLimit');

// Кабинет врача. Подключается в server.js после auth, requireRole('doctor') и middleware/doctor
const router = express.Router();

router.param('referralId', (req, res, next, value) => (
  mongoose.isValidObjectId(value) ? next() : next(new ApiError(400, 'Некорректная ссылка на направление'))
));

router.get('/me', controller.getMe);

// Открыть доступ новому врачу: пароль создаётся на сервере и уходит письмом
router.post('/access', limiters.mail, access.grantAccess);

router.get('/appointments', controller.listAppointments);

router.get('/patients/:patientId', controller.getPatient);
router.get('/patients/:patientId/avatar', controller.getPatientAvatar);

router.get('/patients/:patientId/card', controller.getCard);
router.post('/patients/:patientId/card', controller.createCard);
router.patch('/patients/:patientId/card', controller.updateCard);
router.post('/patients/:patientId/card/visits', controller.addVisit);
router.post('/patients/:patientId/card/referrals', controller.addReferral);

router.get('/patients/:patientId/card.docx', controller.downloadCard);
router.get('/patients/:patientId/referrals/:referralId.docx', controller.downloadReferral);

module.exports = router;
