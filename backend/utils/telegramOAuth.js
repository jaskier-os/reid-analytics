/**
 * Automated Telegram OAuth Login Widget flow via HTTP + orchestrator proxy.
 *
 * Replicates the browser-based Telegram Login Widget authentication:
 * 1. GET oauth.telegram.org/auth to establish a session
 * 2. POST /auth/request to send phone number (triggers Telegram confirmation)
 * 3. Wait for confirmation to be accepted (by pc-agent via orchestrator)
 * 4. POST /auth/login + /auth/get to retrieve signed auth data
 *
 * Returns: { id, first_name, username, photo_url, auth_date, hash }
 */
const axios = require('axios');
const telegramService = require('../services/telegramService');

const UA = 'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/144.0.0.0 Safari/537.36';
const CONFIRMATION_WAIT_MS = 4000;
const POST_ACCEPT_WAIT_MS = 2000;

function mergeCookies(existing, headers) {
    const jar = {};
    if (existing) {
        existing.split('; ').forEach(c => {
            const [k, ...v] = c.split('=');
            if (k) jar[k] = v.join('=');
        });
    }
    (headers['set-cookie'] || []).forEach(c => {
        const [kv] = c.split(';');
        const [k, ...v] = kv.split('=');
        if (k) jar[k.trim()] = v.join('=');
    });
    return Object.entries(jar).map(([k, v]) => `${k}=${v}`).join('; ');
}

/**
 * Accept the most recent Telegram web-login confirmation via orchestrator.
 * Telegram sends a message from user 777000 with confirmation button.
 * We read messages from 777000 via the orchestrator and look for the button,
 * then send a click via the orchestrator.
 */
async function acceptConfirmation() {
    await new Promise(r => setTimeout(r, CONFIRMATION_WAIT_MS));

    const messages = await telegramService.readMessages('777000', 5);
    const confirmMsg = messages.find(msg =>
        msg.buttons && msg.buttons.some(btn => {
            const text = typeof btn === 'object' ? btn.text : btn;
            return text && text.toLowerCase().includes('confirm');
        })
    );

    if (!confirmMsg) {
        // The confirmation might need to be handled by pc-agent automatically,
        // or the button data format differs. Log and continue -- the OAuth flow
        // may still succeed if pc-agent auto-accepted the confirmation.
        console.log('[TelegramOAuth] No confirmation message found from 777000, continuing (pc-agent may have auto-accepted)');
        return;
    }

    // Click the confirmation button via orchestrator
    const confirmBtnText = confirmMsg.buttons
        .map(btn => typeof btn === 'object' ? btn.text : btn)
        .find(text => text && text.toLowerCase().includes('confirm'));

    if (confirmBtnText && confirmMsg.messageId) {
        try {
            await telegramService.botClick('777000', confirmMsg.messageId, confirmBtnText);
            console.log('[TelegramOAuth] Confirmation accepted');
        } catch (err) {
            console.log(`[TelegramOAuth] Failed to click confirmation: ${err.message}, continuing`);
        }
    }
}

/**
 * Perform the full Telegram OAuth flow.
 *
 * @param {string} phone - Phone number in international format (e.g. +79125036666)
 * @param {string} botId - Login widget bot ID (from the site's widget config)
 * @param {string} origin - Site origin (e.g. https://serlocbot.pro)
 * @param {string} returnTo - OAuth return URL (e.g. https://serlocbot.pro/tgshield/verify.php)
 * @returns {object} Auth data: { id, first_name, username, photo_url, auth_date, hash }
 */
async function performOAuth(phone, botId, origin, returnTo) {
    const qp = `bot_id=${botId}&origin=${encodeURIComponent(origin)}&embed=1&request_access=write&return_to=${encodeURIComponent(returnTo)}`;
    const oauthBase = 'https://oauth.telegram.org';

    const mkHeaders = (cookies) => ({
        'Content-Type': 'application/x-www-form-urlencoded',
        'Cookie': cookies,
        'Origin': oauthBase,
        'Referer': `${oauthBase}/auth?${qp}`,
        'User-Agent': UA,
        'X-Requested-With': 'XMLHttpRequest',
    });

    // 1. GET OAuth page to establish session
    const pageResp = await axios.get(`${oauthBase}/auth?${qp}`, {
        headers: { 'User-Agent': UA },
        maxRedirects: 0,
        validateStatus: s => s < 400,
    });
    let cookies = mergeCookies('', pageResp.headers);

    // 2. POST /auth/request to send phone
    const reqResp = await axios.post(
        `${oauthBase}/auth/request?${qp}`,
        `phone=${encodeURIComponent(phone)}`,
        { headers: mkHeaders(cookies), maxRedirects: 0, validateStatus: s => s < 500 }
    );
    cookies = mergeCookies(cookies, reqResp.headers);

    if (reqResp.data !== true) {
        throw new Error(`[TelegramOAuth] Phone request failed: ${JSON.stringify(reqResp.data)}`);
    }

    // 3. Accept confirmation via orchestrator
    await acceptConfirmation();
    await new Promise(r => setTimeout(r, POST_ACCEPT_WAIT_MS));

    // 4. POST /auth/login
    const loginResp = await axios.post(
        `${oauthBase}/auth/login?${qp}`, '',
        { headers: mkHeaders(cookies), maxRedirects: 0, validateStatus: s => s < 500 }
    );
    cookies = mergeCookies(cookies, loginResp.headers);

    if (loginResp.data !== true) {
        throw new Error(`[TelegramOAuth] Login failed: ${JSON.stringify(loginResp.data)}`);
    }

    // 5. POST /auth/get to retrieve signed auth data
    const getResp = await axios.post(
        `${oauthBase}/auth/get?${qp}`, '',
        { headers: mkHeaders(cookies), maxRedirects: 0, validateStatus: s => s < 500 }
    );

    const authData = getResp.data?.user;
    if (!authData || !authData.hash) {
        throw new Error(`[TelegramOAuth] No auth data received: ${JSON.stringify(getResp.data)}`);
    }

    return authData;
}

module.exports = { performOAuth, mergeCookies, UA };
