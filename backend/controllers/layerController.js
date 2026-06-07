const Layer = require("../models/Layer");
const asyncHandler = require("../utils/asyncHandler");
const socketService = require("../services/socketService");

/**
 * @desc    Get all layers
 * @route   GET /api/layers
 * @access  Private
 */
exports.getLayers = asyncHandler(async (req, res) => {
  const layers = await Layer.find({}).sort({ createdAt: -1 });

  res.status(200).json({
    success: true,
    count: layers.length,
    data: layers,
  });
});

/**
 * @desc    Get single layer
 * @route   GET /api/layers/:id
 * @access  Public
 */
exports.getLayer = asyncHandler(async (req, res) => {
  const layer = await Layer.findOne({
    id: req.params.id,
  });

  if (!layer) {
    return res.status(404).json({
      success: false,
      error: "Layer not found",
    });
  }

  res.status(200).json({
    success: true,
    data: layer,
  });
});

/**
 * @desc    Create new layer
 * @route   POST /api/layers
 * @access  Public
 */
exports.createLayer = asyncHandler(async (req, res) => {
  const layer = await Layer.create(req.body);

  // Emit socket event for real-time updates
  socketService.emitToAll("layer-created", layer);

  res.status(201).json({
    success: true,
    data: layer,
  });
});

/**
 * @desc    Update layer
 * @route   PUT /api/layers/:id
 * @access  Public
 */
exports.updateLayer = asyncHandler(async (req, res) => {
  let layer = await Layer.findOne({
    id: req.params.id,
  });

  if (!layer) {
    return res.status(404).json({
      success: false,
      error: "Layer not found",
    });
  }

  // Update the layer
  layer = await Layer.findOneAndUpdate({ id: req.params.id }, req.body, {
    new: true,
    runValidators: true,
  });

  // Emit socket event for real-time updates
  socketService.emitToRoom(`layer-${layer.id}`, "layer-updated", layer);

  res.status(200).json({
    success: true,
    data: layer,
  });
});

/**
 * @desc    Delete layer
 * @route   DELETE /api/layers/:id
 * @access  Public
 */
exports.deleteLayer = asyncHandler(async (req, res) => {
  const layer = await Layer.findOne({
    id: req.params.id,
  });

  if (!layer) {
    return res.status(404).json({
      success: false,
      error: "Layer not found",
    });
  }

  await layer.remove();

  // Emit socket event for real-time updates
  socketService.emitToAll("layer-deleted", { id: layer.id });

  res.status(200).json({
    success: true,
    data: {},
  });
});

/**
 * @desc    Add element to layer
 * @route   POST /api/layers/:id/elements
 * @access  Public
 */
exports.addElementToLayer = asyncHandler(async (req, res) => {
  let layer = await Layer.findOne({
    id: req.params.id,
  });

  if (!layer) {
    return res.status(404).json({
      success: false,
      error: "Layer not found",
    });
  }

  // Add the element
  layer.elements.push(req.body);
  await layer.save();

  // Emit socket event for real-time updates
  socketService.emitToRoom(`layer-${layer.id}`, "element-added", {
    layerId: layer.id,
    element: req.body,
  });

  res.status(200).json({
    success: true,
    data: layer,
  });
});

/**
 * @desc    Remove element from layer
 * @route   DELETE /api/layers/:id/elements/:elementId
 * @access  Public
 */
exports.removeElementFromLayer = asyncHandler(async (req, res) => {
  let layer = await Layer.findOne({
    id: req.params.id,
  });

  if (!layer) {
    return res.status(404).json({
      success: false,
      error: "Layer not found",
    });
  }

  // Find the element
  const elementIndex = layer.elements.findIndex(
    (element) => element.id === req.params.elementId
  );

  if (elementIndex === -1) {
    return res.status(404).json({
      success: false,
      error: "Element not found",
    });
  }

  // Remove the element
  layer.elements.splice(elementIndex, 1);
  await layer.save();

  // Emit socket event for real-time updates
  socketService.emitToRoom(`layer-${layer.id}`, "element-removed", {
    layerId: layer.id,
    elementId: req.params.elementId,
  });

  res.status(200).json({
    success: true,
    data: layer,
  });
});

/**
 * @desc    Clear all elements from layer
 * @route   DELETE /api/layers/:id/elements
 * @access  Public
 */
exports.clearLayerElements = asyncHandler(async (req, res) => {
  let layer = await Layer.findOne({
    id: req.params.id,
  });

  if (!layer) {
    return res.status(404).json({
      success: false,
      error: "Layer not found",
    });
  }
  // Clear all elements
  layer.elements = [];
  await layer.save();

  // Emit socket event for real-time updates
  socketService.emitToRoom(`layer-${layer.id}`, "layer-cleared", {
    layerId: layer.id,
  });

  res.status(200).json({
    success: true,
    data: layer,
  });
});
