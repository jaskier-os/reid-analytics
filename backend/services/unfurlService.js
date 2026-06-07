/**
 * Unfurl Service
 * Handles URL unfurling for link previews in tldraw
 */
const axios = require('axios');
const cheerio = require('cheerio');

/**
 * Unfurl a URL to get metadata for link previews
 * @param {string} url - The URL to unfurl
 * @returns {Promise<Object>} - Metadata for the URL
 */
async function unfurl(url) {
  try {
    // Validate URL
    const urlObj = new URL(url);
    const validUrl = urlObj.toString();

    // Fetch the page content
    const response = await axios.get(validUrl, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (compatible; Team-Planning-Bot/1.0)'
      },
      timeout: 5000, // 5 second timeout
      maxRedirects: 3
    });

    const html = response.data;
    const $ = cheerio.load(html);

    // Extract metadata
    const title = $('title').text().trim() || $('meta[property="og:title"]').attr('content') || '';
    const description = $('meta[name="description"]').attr('content') || 
                       $('meta[property="og:description"]').attr('content') || '';
    const image = $('meta[property="og:image"]').attr('content') || 
                 $('meta[property="twitter:image"]').attr('content') || '';
    const favicon = $('link[rel="icon"]').attr('href') || 
                  $('link[rel="shortcut icon"]').attr('href') || '/favicon.ico';

    // Resolve relative URLs
    const imageUrl = image ? new URL(image, validUrl).toString() : '';
    const faviconUrl = favicon ? new URL(favicon, validUrl).toString() : '';

    return {
      url: validUrl,
      title: title || urlObj.hostname,
      description: description || '',
      image: imageUrl,
      favicon: faviconUrl,
      hostname: urlObj.hostname
    };
  } catch (error) {
    console.error('Error unfurling URL:', error);
    // Return minimal data on error
    try {
      const urlObj = new URL(url);
      return {
        url: url,
        title: urlObj.hostname,
        description: '',
        image: '',
        favicon: '',
        hostname: urlObj.hostname
      };
    } catch (urlError) {
      return {
        url: url,
        title: url,
        description: '',
        image: '',
        favicon: '',
        hostname: ''
      };
    }
  }
}

module.exports = { unfurl };