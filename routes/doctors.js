const express = require('express');
const controller = require('../controllers/doctorsController');
const auth = require('../middleware/auth');
const requireRole = require('../middleware/roles');

const router = express.Router();

// Справочник врачей открыт для всех
router.get('/', controller.getAll);
router.get('/:id', controller.getById);

// Изменять данные врачей могут только сотрудники
router.post('/', auth, requireRole('staff'), controller.create);
router.put('/:id', auth, requireRole('staff'), controller.update);
router.patch('/:id', auth, requireRole('staff'), controller.patch);
router.delete('/:id', auth, requireRole('staff'), controller.remove);

module.exports = router;
