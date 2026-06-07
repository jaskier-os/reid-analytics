/**
 * Click a button on a specific message by ID.
 * Usage: node click-button.js <@bot> <msgId> <buttonText>
 */
require('dotenv').config({ path: require('path').join(__dirname, '../.env') });
const telegramService = require('../services/telegramService');
const { clickButtonAndLog } = require('../utils/botHelper');

const BOT = process.argv[2];
const MSG_ID = parseInt(process.argv[3]);
const BTN_TEXT = process.argv[4];

if (!BOT || !MSG_ID || !BTN_TEXT) {
    console.log('Usage: node click-button.js <@bot> <msgId> <buttonText>');
    process.exit(1);
}

async function main() {
    await telegramService.initialize();
    const client = telegramService.getClient();

    const messages = await client.getMessages(BOT, { ids: [MSG_ID] });
    const msg = messages[0];
    if (!msg) { console.log('Message not found'); process.exit(1); }
    console.log(`[Click] msg ${msg.id}: ${(msg.message || '').substring(0, 60)}`);

    const replies = await clickButtonAndLog(client, BOT, msg, BTN_TEXT, 'Click', 30000);

    replies.forEach((r, i) => {
        console.log(`\n[reply #${i}] edited=${!!r.edited} id=${r.message?.id || '?'}`);
        console.log(`text: ${r.text}`);
        if (r.entities) {
            console.log('entities:');
            r.entities.forEach(e => {
                const slice = r.text.substring(e.offset, e.offset + e.length);
                console.log(`  ${JSON.stringify({ ...e, slice })}`);
            });
        }
        if (r.buttons) console.log(`buttons: [${r.buttons.join(' | ')}]`);
    });

    process.exit(0);
}

main().catch(err => { console.error(err); process.exit(1); });
