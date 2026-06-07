// layerRoutes.js
const express = require('express');
const router = express.Router();
const {
  getLayers,
  getLayer,
  createLayer,
  updateLayer,
  deleteLayer,
  addElementToLayer,
  removeElementFromLayer,
  clearLayerElements
} = require('../controllers/layerController');

// Layer routes
router.route('/')
  .get(getLayers)
  .post(createLayer);

router.route('/:id')
  .get(getLayer)
  .put(updateLayer)
  .delete(deleteLayer);

// Element routes
router.route('/:id/elements')
  .post(addElementToLayer)
  .delete(clearLayerElements);

router.route('/:id/elements/:elementId')
  .delete(removeElementFromLayer);

module.exports = router;