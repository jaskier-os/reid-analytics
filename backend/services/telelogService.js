const axios = require('axios');
const cheerio = require('cheerio');
const { sendAndLog } = require('../utils/botHelper');
const { parseTelelogProfile, isTelelogProfileReply } = require('../utils/telelogParser');

const SITE_URL = 'https://telelog.link/';
const CACHE_TTL_MS = 60 * 60 * 1000;
const PROFILE_SILENCE_MS = 15000; // bot sends "searching..." then edits into result

let cache = { username: null, expiresAt: 0 };

async function getBotUsername() {
    if (cache.username && Date.now() < cache.expiresAt) {
        return cache.username;
    }
    const { data } = await axios.get(SITE_URL);
    const $ = cheerio.load(data);
    const href = $('.cta-section .cta-button').attr('href');
    if (!href) throw new Error('[Telelog] Bot link not found on page');
    const match = href.match(/t\.me\/([^/?]+)/);
    if (!match) throw new Error(`[Telelog] Could not parse bot username from href: ${href}`);
    cache = { username: match[1], expiresAt: Date.now() + CACHE_TTL_MS };
    return cache.username;
}

/**
 * Search for a Telegram user profile via the Telelog bot.
 *
 * @param {string} target - Username or ID to search (e.g. "@Zothie" or "323894501")
 * @returns {object} Parsed profile data
 */
async function interact(target = '@Zothie') {
    const username = await getBotUsername();
    console.log(`[Telelog] Bot: @${username}`);

    // Send /start to initialize the bot conversation
    await sendAndLog(null, username, '/start', 'Telelog');

    // Search for the target user - the bot sends a placeholder then edits it
    const searchReplies = await sendAndLog(null, username, target, 'Telelog', PROFILE_SILENCE_MS);

    if (searchReplies.length === 0) {
        console.log('[Telelog] No reply received for search query');
        return null;
    }

    // Detect the profile response by entity pattern (language-agnostic).
    // Profile replies have: TextUrl (name), >=9 Bold (stats), Code (ID), Mention (username).
    const profileReply = searchReplies.find(r => isTelelogProfileReply(r));

    if (!profileReply) {
        console.log('[Telelog] No profile reply found. Got replies:');
        searchReplies.forEach((r, i) => {
            console.log(`  [${i}] text: ${(r.text || '').substring(0, 100)}`);
            console.log(`  [${i}] buttons: ${(r.buttons || []).join(' | ')}`);
        });
        return null;
    }

    console.log(`[Telelog] Profile reply found (edited=${!!profileReply.edited}, entities=${(profileReply.entities || []).length})`);

    const parsed = parseTelelogProfile(profileReply.text, profileReply.entities || []);
    console.log('[Telelog] Parsed profile:', JSON.stringify(parsed, null, 2));

    return parsed;
}

module.exports = { getBotUsername, interact };
