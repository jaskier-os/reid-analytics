const telegramService = require('../services/telegramService');

function logReplies(replies, tag) {
    if (replies.length > 0) {
        replies.forEach((r, i) => {
            const edited = r.edited ? ' [edited]' : '';
            console.log(`[${tag}] <- reply #${i}${edited} (id=${r.messageId || '?'}):`);
            if (r.text) console.log(`[${tag}]    text: ${r.text.substring(0, 200)}${r.text.length > 200 ? '...' : ''}`);
            if (r.entities) console.log(`[${tag}]    entities: ${r.entities.length} total`);
            if (r.buttons) console.log(`[${tag}]    buttons: [${r.buttons.map(b => typeof b === 'object' ? b.text : b).join(' | ')}]`);
        });
    } else {
        console.log(`[${tag}] <- (no reply within silence window)`);
    }
}

async function sendAndLog(client, botUsername, text, tag, silenceMs) {
    console.log(`[${tag}] -> ${text}`);
    const replies = await telegramService.botSend(botUsername, text, silenceMs);
    logReplies(replies, tag);
    return replies;
}

async function clickButtonAndLog(client, botUsername, messageOrId, buttonText, tag, silenceMs) {
    const messageId = typeof messageOrId === 'object' ? (messageOrId.messageId || messageOrId.id) : messageOrId;
    console.log(`[${tag}] -> [click] ${buttonText}`);
    const replies = await telegramService.botClick(botUsername, messageId, buttonText, silenceMs);
    logReplies(replies, tag);
    return replies;
}

async function sendPhotoAndLog(client, botUsername, photoBuffer, tag, silenceMs) {
    const photoBase64 = Buffer.isBuffer(photoBuffer) ? photoBuffer.toString('base64') : photoBuffer;
    console.log(`[${tag}] -> [photo] ${Buffer.isBuffer(photoBuffer) ? photoBuffer.length : '(base64)'} bytes`);
    const replies = await telegramService.botSendPhoto(botUsername, photoBase64, silenceMs);
    logReplies(replies, tag);
    return replies;
}

module.exports = { sendAndLog, clickButtonAndLog, sendPhotoAndLog };
