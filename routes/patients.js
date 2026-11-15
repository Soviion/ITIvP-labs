const express = require('express');
const controller = require('../controllers/patientsController');

const router = express.Router();

router.get('/', controller.getAll);
router.get('/:id', controller.getById);
router.post('/', controller.create);
router.put('/:id', controller.update);
router.patch('/:id', controller.patch);
router.delete('/:id', controller.remove);

module.exports = router;
