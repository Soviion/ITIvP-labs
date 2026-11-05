const express = require('express');
const mongoose = require('mongoose');
const ApiError = require('../../utils/ApiError');
const controller = require('../controllers/cardsController');

const router = express.Router();

// Проверяет, что все параметры вида :id, :visitId, :medId — корректные ObjectId (24 hex-символа)
router.param('id', checkObjectId);
router.param('visitId', checkObjectId);
router.param('medId', checkObjectId);
router.param('diseaseId', checkObjectId);

function checkObjectId(req, res, next, value) {
  if (!mongoose.isValidObjectId(value)) return next(new ApiError(400, 'Некорректная ссылка на документ'));
  return next();
}

// Агрегации (раньше маршрутов с :id, чтобы "stats" не принималось за идентификатор)
router.get('/stats/doctors', controller.statsByDoctor);
router.get('/stats/diagnoses', controller.statsByDiagnosis);

// CRUD карт
router.get('/cards', controller.list);
router.get('/cards/:id', controller.getById);
router.post('/cards', controller.create);
router.put('/cards/:id', controller.update);
router.delete('/cards/:id', controller.remove);

// Вложенные массивы
router.post('/cards/:id/visits', controller.addVisit);
router.post('/cards/:id/visits/:visitId/prescriptions/extend', controller.extendPrescription);
router.post('/cards/:id/diseases', controller.addDisease);
router.delete('/cards/:id/diseases/:diseaseId', controller.removeDisease);
router.post('/cards/:id/medications', controller.addMedication);
router.patch('/cards/:id/medications/:medId', controller.updateMedication);
router.post('/cards/:id/tags', controller.addTags);
router.delete('/cards/:id/tags/:tag', controller.removeTag);

// Анализы (отдельная коллекция)
router.get('/cards/:id/labs', controller.listLabs);
router.post('/cards/:id/labs', controller.addLab);

module.exports = router;
