import api, { handleApiResponse } from './api';

/**
 * Get all layers
 * @returns {Promise<Object>} Response with layers list
 */
export const getAllLayers = async () => {
  return handleApiResponse(async () => {
    return await api.get('/layers');
  });
};

/**
 * Get a single layer by ID
 * @param {string} id Layer ID
 * @returns {Promise<Object>} Layer data
 */
export const getLayerById = async (id) => {
  return handleApiResponse(async () => {
    return await api.get(`/layers/${id}`);
  });
};

/**
 * Create a new layer
 * @param {Object} layerData Layer data
 * @returns {Promise<Object>} Created layer
 */
export const createLayer = async (layerData) => {
  return handleApiResponse(async () => {
    return await api.post('/layers', layerData);
  });
};

/**
 * Update a layer
 * @param {string} id Layer ID
 * @param {Object} layerData Updated layer data
 * @returns {Promise<Object>} Updated layer
 */
export const updateLayer = async (id, layerData) => {
  return handleApiResponse(async () => {
    return await api.put(`/layers/${id}`, layerData);
  });
};

/**
 * Delete a layer
 * @param {string} id Layer ID
 * @returns {Promise<Object>} Response data
 */
export const deleteLayer = async (id) => {
  return handleApiResponse(async () => {
    return await api.delete(`/layers/${id}`);
  });
};

/**
 * Add an element to a layer
 * @param {string} layerId Layer ID
 * @param {Object} elementData Element data
 * @returns {Promise<Object>} Updated layer
 */
export const addElementToLayer = async (layerId, elementData) => {
  return handleApiResponse(async () => {
    return await api.post(`/layers/${layerId}/elements`, elementData);
  });
};

/**
 * Remove an element from a layer
 * @param {string} layerId Layer ID
 * @param {string} elementId Element ID
 * @returns {Promise<Object>} Updated layer
 */
export const removeElementFromLayer = async (layerId, elementId) => {
  return handleApiResponse(async () => {
    return await api.delete(`/layers/${layerId}/elements/${elementId}`);
  });
};

/**
 * Clear all elements from a layer
 * @param {string} layerId Layer ID
 * @returns {Promise<Object>} Updated layer
 */
export const clearLayerElements = async (layerId) => {
  return handleApiResponse(async () => {
    return await api.delete(`/layers/${layerId}/elements`);
  });
};

/**
 * Share a layer with another user
 * @param {string} layerId Layer ID
 * @param {Object} shareData Share data (userId and permission)
 * @returns {Promise<Object>} Updated layer
 */
export const shareLayer = async (layerId, shareData) => {
  return handleApiResponse(async () => {
    return await api.post(`/layers/${layerId}/share`, shareData);
  });
};