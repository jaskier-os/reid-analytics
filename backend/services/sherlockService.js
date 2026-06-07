const axios = require('axios');
const crypto = require('crypto');
const telegramService = require('./telegramService');
const reidService = require('./reidService');
const { sendAndLog, clickButtonAndLog, sendPhotoAndLog } = require('../utils/botHelper');
const {
    parseSherlockReply,
    isDisambiguationMessage,
    isCountrySelectionMessage,
    isPhotoSearchResult,
    isPhotoSimilarityMessage,
    parsePhotoSearchResults,
} = require('../utils/sherlockParser');
const { parseSherlockReport } = require('../utils/sherlockReportParser');
const { performOAuth } = require('../utils/telegramOAuth');
const { getBotUsernameViaBrowser } = require('../utils/sherlockBrowser');

const SITE_URL = 'https://serlocbot.pro';
const CACHE_TTL_MS = 60 * 60 * 1000;
const SEARCH_SILENCE_MS = 30000;
const CLICK_SILENCE_MS = 120000;
const PHOTO_PAGE_SILENCE_MS = 15000;

const btnText = (b) => typeof b === 'object' ? b.text : b;

let cache = { username: null, expiresAt: 0 };

/**
 * Get the Sherlock bot username via Playwright + Telegram OAuth flow.
 *
 * Flow:
 * 1. Browser opens verify.php (bypasses anti-bot protection)
 * 2. Extract login widget bot ID, resolve to numeric ID via orchestrator
 * 3. Perform Telegram OAuth (HTTP + orchestrator confirmation)
 * 4. Browser submits auth data to auth.php and scrapes go.php for bot link
 */
async function getBotUsername() {
    if (cache.username && Date.now() < cache.expiresAt) {
        return cache.username;
    }

    const phone = process.env.TELEGRAM_PHONE;
    if (!phone) throw new Error('[Sherlock] TELEGRAM_PHONE not set in .env');

    console.log('[Sherlock] Fetching bot username via browser + OAuth flow...');

    const username = await getBotUsernameViaBrowser(async (loginBot, authUrl) => {
        // Resolve login bot name to numeric ID via orchestrator
        const entity = await telegramService.getEntityInfo(loginBot);
        const botId = entity.id.toString();
        console.log(`[Sherlock] Login bot: @${loginBot}, ID: ${botId}`);

        // Perform Telegram OAuth flow (HTTP + orchestrator confirmation)
        const authData = await performOAuth(phone, botId, SITE_URL, authUrl);
        console.log(`[Sherlock] OAuth complete, auth_date: ${authData.auth_date}`);
        return authData;
    });

    cache = { username, expiresAt: Date.now() + CACHE_TTL_MS };
    console.log(`[Sherlock] Bot username: @${username}`);
    return username;
}

/**
 * Fetch a full Sherlock report HTML page and parse it.
 *
 * @param {string} url - Report URL (e.g. https://dc6.sherlock-report.at/r/...)
 * @returns {object|null} Parsed report or null on failure
 */
async function fetchReport(url) {
    try {
        console.log(`[Sherlock] Fetching report: ${url}`);
        const { data: html } = await axios.get(url, { timeout: 30000 });

        // Save report to database
        const hash = crypto.createHash('md5').update(url).digest('hex').slice(0, 12);
        const filename = `report_${hash}.html`;
        await reidService.uploadOsintAsset({
            filename,
            content_type: 'text/html',
            asset_type: 'report',
            source: 'sherlock_report',
            data: Buffer.from(html).toString('base64')
        });
        console.log(`[Sherlock] Saved report: ${filename}`);

        const report = parseSherlockReport(html);
        report.localFile = filename;
        console.log(`[Sherlock] Report parsed: ${report.records ? report.records.length : 0} records`);
        return report;
    } catch (err) {
        console.error(`[Sherlock] Failed to fetch report: ${err.message}`);
        return null;
    }
}

/**
 * Try to find a parseable result from a list of replies.
 * Attaches searchType and searchQuery to the parsed data.
 */
function findParsedResult(replies, searchType, target) {
    for (const r of replies) {
        const result = parseSherlockReply(r);
        if (result.parsed) {
            result.parsed.searchType = searchType;
            result.parsed.searchQuery = target;
            console.log('[Sherlock] Parsed result:', JSON.stringify(result.parsed, null, 2));
            return result;
        }
    }
    return null;
}

/**
 * Click a button on one of the replies and parse the result.
 */
async function clickAndParse(botUsername, replies, buttonMatch, searchType, target) {
    const replyWithBtn = replies.find(r =>
        r.buttons && r.buttons.some(b => buttonMatch(b))
    );
    if (!replyWithBtn) return null;

    const matchedBtn = replyWithBtn.buttons.find(b => buttonMatch(b));
    const matchedText = btnText(matchedBtn);
    console.log(`[Sherlock] Clicking "${matchedText}"`);
    const clickReplies = await clickButtonAndLog(
        null, botUsername, replyWithBtn.messageId, matchedText, 'Sherlock', CLICK_SILENCE_MS
    );
    return findParsedResult(clickReplies, searchType, target);
}

/**
 * Search via the Sherlock bot.
 *
 * @param {string} target - Search query (username, phone, ID, or "Name DOB")
 * @param {'username'|'phone'|'telegram_id'|'name'} searchType - Type of search
 * @param {{ country?: string }} options - Options (country for name search, default: "Russia")
 * @returns {{ type: string, parsed: object|null }}
 */
async function interact(target, searchType = 'username', options = {}) {
    const MAX_BOT_RETRIES = 10;
    const triedBots = new Set();
    let botUsername;
    let searchReplies;

    // If botUsername provided manually, use it directly (skip auto-resolution)
    const manualBot = options.botUsername
        ? options.botUsername.replace(/^@/, '')
        : null;

    if (manualBot) {
        botUsername = manualBot;
        console.log(`[Sherlock] Using manually specified bot: @${botUsername}`);
    }

    // Last dead bot username -- used to search for redirect messages
    let lastDeadBot = null;

    for (let attempt = 1; attempt <= MAX_BOT_RETRIES; attempt++) {
        // Skip auto-resolution if manual bot was provided (first attempt only)
        if (!manualBot || attempt > 1) {
            // If previous bot was dead, check its chat history for a redirect to a new bot
            if (lastDeadBot) {
                const REDIRECT_TEXT = 'Продолжай поиск здесь, вся информация доступна в этом месте.';
                const redirectBot = await telegramService.findRedirectBot(lastDeadBot, triedBots, REDIRECT_TEXT);
                if (redirectBot) {
                    cache = { username: redirectBot, expiresAt: Date.now() + CACHE_TTL_MS };
                    console.log(`[Sherlock] Found redirect bot @${redirectBot} from @${lastDeadBot}`);
                    lastDeadBot = null;
                }
            }

            botUsername = await getBotUsername();

            // If we already tried this bot and it didn't respond, invalidate cache and fetch a new one
            if (triedBots.has(botUsername)) {
                cache = { username: null, expiresAt: 0 };
                console.log(`[Sherlock] Bot @${botUsername} already tried, fetching new one...`);
                botUsername = await getBotUsername();
                if (triedBots.has(botUsername)) {
                    console.log(`[Sherlock] Got same bot again @${botUsername}, attempt ${attempt}/${MAX_BOT_RETRIES}`);
                    await new Promise(r => setTimeout(r, 3000));
                    cache = { username: null, expiresAt: 0 };
                    continue;
                }
            }
        }

        triedBots.add(botUsername);
        console.log(`[Sherlock] Bot: @${botUsername}, searchType: ${searchType}, target: ${target} (attempt ${attempt}/${MAX_BOT_RETRIES})`);

        try {
            // Unblock bot in case it was previously blocked
            try {
                await telegramService.unblockUser(botUsername);
            } catch (_) { /* not blocked, ignore */ }

            // Mute the bot chat before sending anything
            try {
                await telegramService.muteChat(botUsername);
            } catch (_) { /* ignore mute errors */ }

            await sendAndLog(null, botUsername, '/start', 'Sherlock');

            if (searchType === 'photo') {
                if (!options.photoBuffer) throw new Error('[Sherlock] photoBuffer required for photo search');
                searchReplies = await sendPhotoAndLog(null, botUsername, options.photoBuffer, 'Sherlock', SEARCH_SILENCE_MS);
            } else {
                searchReplies = await sendAndLog(null, botUsername, target, 'Sherlock', SEARCH_SILENCE_MS);
            }

            if (searchReplies.length > 0) break;

            console.log(`[Sherlock] Bot @${botUsername} did not respond`);
            lastDeadBot = botUsername;
        } catch (err) {
            console.error(`[Sherlock] Bot @${botUsername} error: ${err.message}, trying another bot...`);
            lastDeadBot = botUsername;
        }

        cache = { username: null, expiresAt: 0 };
    }

    if (!searchReplies || searchReplies.length === 0) {
        throw new Error(`[Sherlock] Bot did not respond after ${MAX_BOT_RETRIES} attempts (tried: ${[...triedBots].map(b => '@' + b).join(', ')})`);
    }

    // Detect limit exhaustion
    const limitReply = searchReplies.find(r => (r.text || '').includes('лимит запросов исчерпан'));
    if (limitReply) {
        throw new Error('[Sherlock] Request limit exhausted');
    }

    // Photo search: bot sends person cards with photos, similarity %, and data.
    // Each page has a "Show more" button to load the next person.
    // We collect all replies, then click through remaining pages, then parse everything.
    if (searchType === 'photo') {
        const allReplies = [...searchReplies];

        // Click through "Show more" buttons to get all pages
        let lastReplies = searchReplies;
        for (let page = 0; page < 20; page++) {
            const showMoreReply = lastReplies.find(r =>
                r.buttons && r.buttons.some(b => btnText(b).includes('Показать еще'))
            );
            if (!showMoreReply) break;

            console.log(`[Sherlock] Photo search: clicking "Показать еще" (page ${page + 1})`);
            const moreReplies = await clickButtonAndLog(
                null, botUsername, showMoreReply.messageId, 'Показать еще', 'Sherlock', PHOTO_PAGE_SILENCE_MS
            );
            allReplies.push(...moreReplies);
            lastReplies = moreReplies;
        }

        // Parse all person cards from collected replies
        const persons = parsePhotoSearchResults(allReplies);

        // Collect similarity percentages from "Face similarity" messages
        const similarities = allReplies
            .filter(r => isPhotoSimilarityMessage(r))
            .map(r => {
                const match = (r.text || '').match(/(\d+)%/);
                return match ? parseInt(match[1], 10) : null;
            })
            .filter(v => v !== null);

        if (persons.length === 0) {
            console.log('[Sherlock] Photo search: no person cards found in replies');
            console.log('[Sherlock] Photo reply summary:', allReplies.map(r => ({
                text: (r.text || '').substring(0, 80),
                buttons: r.buttons,
                edited: r.edited,
                hasMedia: !!r.hasMedia
            })));
            return { type: 'photo_no_result', parsed: null };
        }

        // Photo download is not available via orchestrator proxy.
        // Photos from the orchestrator replies may have URLs in entities/buttons.
        // For now, mark persons without downloaded photos.
        for (let i = 0; i < persons.length; i++) {
            persons[i].photos = [];
            // Extract any photo URLs from entities if available
            const personReplies = allReplies.filter(r => isPhotoSearchResult(r));
            if (personReplies[i] && personReplies[i].entities) {
                const urls = personReplies[i].entities
                    .filter(e => e.type === 'MessageEntityTextUrl' && e.url)
                    .map(e => e.url);
                if (urls.length > 0) {
                    persons[i].photoUrls = urls;
                }
            }
        }

        const totalPhotos = persons.reduce((sum, p) => sum + (p.photos?.length || 0), 0);
        console.log(`[Sherlock] Photo search: found ${persons.length} persons, ${totalPhotos} photos, ${similarities.length} similarity scores`);

        const parsed = {
            searchType: 'photo',
            searchQuery: target,
            persons,
            similarities,
            totalResults: persons.length
        };

        return { type: 'photo_result', parsed };
    }

    // 1. Disambiguation: "Detected login/identifier" -> click Telegram
    const disambigReply = searchReplies.find(r => isDisambiguationMessage(r));
    if (disambigReply) {
        const result = await clickAndParse(
            botUsername, searchReplies,
            b => /telegram/i.test(btnText(b)),
            searchType, target
        );
        if (result) return maybeAttachReport(result, options);
        console.log('[Sherlock] No Telegram button or no result after disambiguation');
        return { type: 'disambiguation_no_result', parsed: null };
    }

    // 2. Country selection: name search shows FIO breakdown -> click country
    const countryReply = searchReplies.find(r => isCountrySelectionMessage(r));
    if (countryReply) {
        const country = options.country || 'Россия';
        const result = await clickAndParse(
            botUsername, searchReplies,
            b => btnText(b) === country,
            searchType, target
        );
        if (result) return maybeAttachReport(result, options);
        console.log(`[Sherlock] No "${country}" button or no result after country selection`);
        return { type: 'country_selection_no_result', parsed: null };
    }

    // 3. Direct result (phone search returns data immediately, edited)
    const directResult = findParsedResult(searchReplies, searchType, target);
    if (directResult) return maybeAttachReport(directResult, options);

    // No parseable result
    const types = searchReplies.map(r => parseSherlockReply(r).type);
    console.log('[Sherlock] No parseable result. Reply types:', types);
    return { type: types.includes('help') ? 'help' : 'unknown', parsed: null };
}

/**
 * If a parsed result has a reportUrl, fetch and attach the full report.
 * Skipped if options.skipReport is true.
 */
async function maybeAttachReport(result, options = {}) {
    if (options.skipReport) return result;
    if (!result.parsed || !result.parsed.reportUrl) return result;

    const report = await fetchReport(result.parsed.reportUrl);
    if (report) {
        result.parsed.report = report;
    }
    return result;
}

module.exports = { getBotUsername, interact, fetchReport };
