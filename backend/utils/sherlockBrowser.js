/**
 * Browser-based scraping of serlocbot.pro via Playwright.
 *
 * Replaces plain axios requests that get 403'd by anti-bot protection.
 * A real browser context passes Cloudflare challenges and maintains
 * cookies automatically across navigations.
 *
 * Handles two site behaviors:
 * - Direct redirect: verify.php or go.php redirects to t.me/BOT (no OAuth needed)
 * - Login widget: verify.php shows Telegram OAuth widget (full OAuth flow required)
 */
const { chromium } = require('playwright');

const UA = 'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0.0.0 Safari/537.36';

const SITE_URL = 'https://serlocbot.pro';
const VERIFY_URL = `${SITE_URL}/tgshield/verify.php`;
const AUTH_URL = `${SITE_URL}/tgshield/auth.php`;
const GO_URL = `${SITE_URL}/tgshield/go.php`;

const PAGE_TIMEOUT = 30000;
const MAX_RETRIES = 2;

let browser = null;

async function ensureBrowser() {
    if (!browser || !browser.isConnected()) {
        try {
            browser = await chromium.launch({
                headless: true,
                args: ['--disable-blink-features=AutomationControlled'],
            });
        } catch (err) {
            if (err.message.includes('Executable doesn\'t exist') || err.message.includes('browserType.launch')) {
                throw new Error('[Sherlock] Playwright browser not installed. Run: npx playwright install chromium');
            }
            throw err;
        }
    }
    return browser;
}

async function createContext() {
    const b = await ensureBrowser();
    const context = await b.newContext({
        userAgent: UA,
        viewport: { width: 1920, height: 1080 },
        locale: 'en-US',
    });
    return context;
}

/**
 * Extract bot username from a t.me URL.
 */
function extractBotUsername(url) {
    const match = url.match(/t\.me\/([^/?]+)/);
    return match ? match[1] : null;
}

/**
 * Try to get the bot username by direct page navigation (no OAuth).
 *
 * Checks verify.php and go.php for:
 * - Page redirect to t.me/BOT_USERNAME
 * - Bot link in page content (a[href*="t.me"])
 *
 * @returns {string|null} Bot username or null if OAuth is needed
 */
async function tryDirectScrape() {
    const context = await createContext();
    const page = await context.newPage();

    await page.addInitScript(() => {
        Object.defineProperty(navigator, 'webdriver', { get: () => false });
    });

    try {
        // Try verify.php -- may redirect to t.me/BOT
        await page.goto(VERIFY_URL, { waitUntil: 'load', timeout: PAGE_TIMEOUT });

        let username = extractBotUsername(page.url());
        if (username) {
            console.log(`[Sherlock] verify.php redirected to bot: @${username}`);
            return username;
        }

        // Try go.php -- may redirect or contain bot link
        await page.goto(GO_URL, { waitUntil: 'load', timeout: PAGE_TIMEOUT });

        username = extractBotUsername(page.url());
        if (username) {
            console.log(`[Sherlock] go.php redirected to bot: @${username}`);
            return username;
        }

        // Check page content for bot link
        const botLink = await page.$eval('a[href*="t.me"]', el => el.getAttribute('href')).catch(() => null);
        if (botLink) {
            username = extractBotUsername(botLink);
            if (username) {
                console.log(`[Sherlock] go.php contains bot link: @${username}`);
                return username;
            }
        }

        return null;
    } finally {
        await context.close();
    }
}

/**
 * Open verify.php and extract the login widget data for OAuth flow.
 *
 * Returns a browser context + page that must be reused in scrapeBotLink()
 * (they hold the anti-bot cookies).
 *
 * @returns {{ context, page, loginBot: string, authUrl: string }}
 */
async function scrapeLoginWidget() {
    const context = await createContext();
    const page = await context.newPage();

    await page.addInitScript(() => {
        Object.defineProperty(navigator, 'webdriver', { get: () => false });
    });

    await page.goto(VERIFY_URL, { waitUntil: 'domcontentloaded', timeout: PAGE_TIMEOUT });

    // Race: either login widget appears or page redirects to t.me
    const result = await Promise.race([
        page.waitForSelector('script[data-telegram-login]', { timeout: PAGE_TIMEOUT })
            .then(() => ({ type: 'widget' })),
        page.waitForURL(/t\.me\//, { timeout: PAGE_TIMEOUT })
            .then(() => ({ type: 'redirect' })),
    ]).catch(() => null);

    if (!result) {
        await context.close();
        throw new Error(`[Sherlock] verify.php: neither widget nor redirect found. URL: ${page.url()}`);
    }

    // Direct redirect -- extract username and return early
    if (result.type === 'redirect') {
        const username = extractBotUsername(page.url());
        if (username) {
            console.log(`[Sherlock] verify.php redirected to bot: @${username}`);
            return { context, page, botUsername: username };
        }
        await context.close();
        throw new Error(`[Sherlock] verify.php redirected to unexpected URL: ${page.url()}`);
    }

    // Widget found -- extract login bot and auth URL
    const loginBot = await page.$eval(
        'script[data-telegram-login]',
        el => el.getAttribute('data-telegram-login')
    );
    if (!loginBot) {
        await context.close();
        throw new Error('[Sherlock] data-telegram-login not found on verify.php');
    }

    const authUrl = await page.$eval(
        'script[data-auth-url]',
        el => el.getAttribute('data-auth-url')
    ).catch(() => null) || AUTH_URL;

    console.log(`[Sherlock] Browser scraped verify.php: loginBot=${loginBot}, authUrl=${authUrl}`);
    return { context, page, loginBot, authUrl };
}

/**
 * Submit OAuth auth data to auth.php and scrape bot username from go.php.
 *
 * Uses the same browser context from scrapeLoginWidget() (has anti-bot cookies).
 */
async function scrapeBotLink(page, authUrl, authData) {
    const params = new URLSearchParams(authData).toString();

    const authResp = await page.goto(`${authUrl}?${params}`, {
        waitUntil: 'domcontentloaded',
        referer: 'https://oauth.telegram.org/',
        timeout: PAGE_TIMEOUT,
    });

    const authStatus = authResp?.status();
    console.log(`[Sherlock] auth.php response status: ${authStatus}`);

    await page.goto(GO_URL, { waitUntil: 'load', timeout: PAGE_TIMEOUT });

    // Check for redirect first
    let username = extractBotUsername(page.url());
    if (username) {
        console.log(`[Sherlock] go.php redirected to bot: @${username}`);
        return username;
    }

    // Otherwise look for link in page content
    await page.waitForSelector('a[href*="t.me"]', { timeout: PAGE_TIMEOUT });
    const botLink = await page.$eval('a[href*="t.me"]', el => el.getAttribute('href'));
    if (!botLink) throw new Error('[Sherlock] Bot link not found on go.php');

    username = extractBotUsername(botLink);
    if (!username) throw new Error(`[Sherlock] Could not parse bot username from: ${botLink}`);

    console.log(`[Sherlock] Browser scraped go.php: bot=@${username}`);
    return username;
}

/**
 * Get bot username via browser with multi-strategy approach + retries.
 *
 * Strategy 1: Direct scrape -- check if verify.php/go.php redirect to the bot
 * Strategy 2: Full OAuth -- scrape login widget, perform OAuth, scrape go.php
 *
 * @param {Function} oauthFn - async (loginBot, authUrl) => authData
 * @returns {string} Bot username
 */
async function getBotUsernameViaBrowser(oauthFn) {
    // Strategy 1: Try direct scrape (no OAuth)
    try {
        const username = await tryDirectScrape();
        if (username) return username;
        console.log('[Sherlock] Direct scrape found no bot link, falling back to OAuth flow');
    } catch (err) {
        console.log(`[Sherlock] Direct scrape failed: ${err.message}, falling back to OAuth flow`);
    }

    // Strategy 2: OAuth flow with retries
    let lastError;

    for (let attempt = 0; attempt <= MAX_RETRIES; attempt++) {
        let context;
        try {
            const session = await scrapeLoginWidget();
            context = session.context;

            // scrapeLoginWidget may have found the bot via redirect
            if (session.botUsername) {
                await context.close();
                return session.botUsername;
            }

            // Full OAuth flow
            const authData = await oauthFn(session.loginBot, session.authUrl);
            const username = await scrapeBotLink(session.page, session.authUrl, authData);
            await context.close();
            return username;
        } catch (err) {
            lastError = err;
            if (context) await context.close().catch(() => {});

            if (attempt < MAX_RETRIES) {
                console.log(`[Sherlock] OAuth attempt ${attempt + 1}/${MAX_RETRIES + 1} failed: ${err.message}, retrying...`);
                await new Promise(r => setTimeout(r, 2000));
            }
        }
    }

    throw lastError;
}

async function closeBrowser() {
    if (browser) {
        await browser.close().catch(() => {});
        browser = null;
    }
}

process.on('exit', () => {
    if (browser) browser.close().catch(() => {});
});

module.exports = { getBotUsernameViaBrowser, closeBrowser };
