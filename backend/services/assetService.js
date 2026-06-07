/**
 * Asset Service
 * Handles storage and retrieval of tldraw assets (images, files, etc.)
 */
const fs = require('fs').promises;
const path = require('path');

// Directory for storing assets
const ASSETS_DIR = path.join(__dirname, '../.assets');

/**
 * Store an asset file
 * @param {string} id - Asset ID
 * @param {Buffer|stream.Readable} data - Asset data
 * @returns {Promise<void>}
 */
async function storeAsset(id, data) {
  try {
    // Ensure directory exists
    await fs.mkdir(ASSETS_DIR, { recursive: true });
    
    // Write file
    await fs.writeFile(path.join(ASSETS_DIR, id), data);
  } catch (error) {
    console.error(`Error storing asset ${id}:`, error);
    throw error;
  }
}

/**
 * Load an asset file
 * @param {string} id - Asset ID
 * @returns {Promise<Buffer|null>} - Asset data or null if not found
 */
async function loadAsset(id) {
  try {
    return await fs.readFile(path.join(ASSETS_DIR, id));
  } catch (error) {
    if (error.code === 'ENOENT') {
      return null; // File not found
    }
    console.error(`Error loading asset ${id}:`, error);
    throw error;
  }
}

module.exports = {
  storeAsset,
  loadAsset
};