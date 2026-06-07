require('dotenv').config({ path: require('path').join(__dirname, '../.env') });
const telegramService = require('../services/telegramService');

const BOT = process.argv[2] || '@kasjdhakjs_bot';
const LIMIT = parseInt(process.argv[3] || '10');

async function main() {
    await telegramService.initialize();
    const client = telegramService.getClient();

    const messages = await client.getMessages(BOT, { limit: LIMIT });
    messages.reverse().forEach(msg => {
        const who = msg.out ? 'me' : BOT;
        const edited = msg.editDate ? ' [edited]' : '';
        console.log(`\n=== [${who}]${edited} id=${msg.id} ===`);
        console.log(`  text: ${msg.message || '(no text)'}`);
        if (msg.entities && msg.entities.length > 0) {
            console.log(`  entities:`);
            msg.entities.forEach(e => {
                const slice = (msg.message || '').substring(e.offset, e.offset + e.length);
                const info = { type: e.className, offset: e.offset, length: e.length, text: slice };
                if (e.url) info.url = e.url;
                if (e.userId) info.userId = e.userId.toString();
                console.log(`    ${JSON.stringify(info)}`);
            });
        }
        if (msg.replyMarkup && msg.replyMarkup.rows) {
            console.log(`  buttons:`);
            msg.replyMarkup.rows.forEach(row => {
                row.buttons.forEach(btn => {
                    const info = { text: btn.text };
                    if (btn.url) info.url = btn.url;
                    if (btn.data) info.data = btn.data.toString('base64');
                    console.log(`    ${JSON.stringify(info)}`);
                });
            });
        }
        if (msg.replyTo) {
            console.log(`  reply_to_msg_id: ${msg.replyTo.replyToMsgId}`);
        }
    });

    process.exit(0);
}

main().catch(err => {
    console.error('Failed:', err);
    process.exit(1);
});
