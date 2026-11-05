const express = require('express');
const controller = require('../controllers/meController');
const history = require('../controllers/historyController');
const limiters = require('../middleware/rateLimit');

// Личный кабинет: все маршруты уже за middleware/auth (см. server.js)
const { ACCEPTED_TYPES, MAX_UPLOAD_BYTES } = require('../services/avatarImage');

const router = express.Router();
const rawImage = express.raw({ type: ACCEPTED_TYPES, limit: MAX_UPLOAD_BYTES });

router.get('/', controller.getMe);
router.patch('/patient', controller.updatePatient);
router.patch('/record', controller.updateRecord);

// История болезни: приёмы врача и направления к ним
router.get('/history', history.list);
router.get('/history/:visitId', history.getVisit);
router.get('/history/:visitId/visit.docx', history.downloadVisit);
router.get('/history/:visitId/referrals/:referralId.docx', history.downloadReferral);

router.get('/avatar', controller.getAvatarPhoto);
router.put('/avatar/preset', controller.setAvatarPreset);
router.put('/avatar/photo', rawImage, controller.uploadAvatarPhoto);
router.delete('/avatar', controller.clearAvatar);

router.get('/appointments', controller.listAppointments);
router.post('/appointments', controller.book);
router.patch('/appointments/:id', controller.updateAppointment);
router.post('/appointments/:id/cancel', controller.cancel);
router.delete('/appointments/:id', controller.removeAppointment);
router.delete('/appointments', controller.clearArchive);

router.post('/email/start', limiters.mail, controller.emailStart);
router.post('/email/confirm', limiters.credentials, controller.emailConfirm);

module.exports = router;
