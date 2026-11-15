const express = require('express');
const controller = require('../controllers/appointmentsController');

const router = express.Router();

router.get('/', controller.getAll);
router.query('/', controller.query);
router.get('/:id', controller.getById);
router.post('/', controller.create);
router.put('/:id', controller.update);
router.patch('/:id', controller.patch);
router.delete('/:id', controller.remove);

module.exports = router;
