/**
 * API handler for URL unfurling
 * Used by tldraw bookmark shapes
 */
const express = require('express');
const router = express.Router();
const unfurlService = require('../services/unfurlService');

/**
 * @route GET /api/unfurl
 * @desc Unfurl a URL to extract metadata
 * @access Public
 */
router.get('/', async (req, res) => {
  try {
    const { url } = req.query;
    
    if (!url) {
      return res.status(400).json({ error: 'URL parameter is required' });
    }
    
    // Validate URL format
    try {
      new URL(url);
    } catch (error) {
      return res.status(400).json({ error: 'Invalid URL format' });
    }
    
    // Get metadata from URL
    const metadata = await unfurlService.unfurlUrl(url);
    
    // Return metadata
    return res.status(200).json(metadata);
  } catch (error) {
    console.error('Error unfurling URL:', error);
    return res.status(500).json({ error: 'Failed to unfurl URL' });
  }
});

/**
 * @route POST /api/unfurl/cache
 * @desc Cache unfurled data for a URL
 * @access Public
 */
router.post('/cache', async (req, res) => {
  try {
    const { url, metadata } = req.body;
    
    if (!url || !metadata) {
      return res.status(400).json({ error: 'URL and metadata are required' });
    }
    
    // In a real implementation, you would store this in a cache
    // For now, we'll just acknowledge the request
    
    return res.status(200).json({ success: true });
  } catch (error) {
    console.error('Error caching unfurled data:', error);
    return res.status(500).json({ error: 'Failed to cache unfurled data' });
  }
});

module.exports = router;