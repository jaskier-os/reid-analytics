const axios = require('axios');

const ORCHESTRATOR_URL = process.env.ORCHESTRATOR_URL || 'http://localhost:10001';
const API_KEY = process.env.API_KEY || '';

const api = axios.create({
    baseURL: `${ORCHESTRATOR_URL}/api/v1/telegram`,
    headers: { 'x-api-key': API_KEY },
    timeout: 180000,
});

async function initialize() {
    console.log('[Telegram] Proxying via orchestrator at', ORCHESTRATOR_URL);
}

async function sendToSavedMessages(text) {
    try {
        await api.post('/send-message', { chat: 'me', text });
    } catch (err) {
        console.warn('[Telegram] Failed to send to saved messages:', err.message);
    }
}

async function botSend(botUsername, text, silenceMs) {
    const { data } = await api.post('/bot/send', { botUsername, text, silenceMs });
    return data.replies || [];
}

async function botSendPhoto(botUsername, photoBase64, silenceMs) {
    const { data } = await api.post('/bot/send-photo', { botUsername, photoBase64, silenceMs });
    return data.replies || [];
}

async function botClick(botUsername, messageId, buttonText, silenceMs) {
    const { data } = await api.post('/bot/click', { botUsername, messageId, buttonText, silenceMs });
    return data.replies || [];
}

async function getEntityInfo(username) {
    const { data } = await api.get(`/entity/${encodeURIComponent(username)}`);
    return data;
}

async function muteChat(username) {
    await api.post('/mute', { username });
}

async function unblockUser(username) {
    await api.post('/unblock', { username });
}

async function findRedirectBot(deadBotUsername, triedBots, redirectText) {
    const { data } = await api.post('/find-redirect-bot', {
        deadBotUsername,
        triedBots: Array.from(triedBots),
        redirectText,
    });
    return data.botUsername || null;
}

async function readMessages(chat, limit) {
    const { data } = await api.get(`/messages/${encodeURIComponent(chat)}`, {
        params: { limit },
    });
    return data.messages || [];
}

module.exports = {
    initialize,
    sendToSavedMessages,
    botSend,
    botSendPhoto,
    botClick,
    getEntityInfo,
    muteChat,
    unblockUser,
    findRedirectBot,
    readMessages,
};
