/**
 * Test Sherlock parser against real bot messages already in chat history.
 * Reads messages from the bot, finds the known response types, and parses them.
 * NO new bot calls - only reads existing message history.
 */
require('dotenv').config({ path: require('path').join(__dirname, '../.env') });
const telegramService = require('../services/telegramService');
const { getBotUsername } = require('../services/sherlockService');
const {
    parseSherlockReply,
    isPhoneSearchResult,
    isTelegramSearchResult,
    isDisambiguationMessage,
    isHelpMessage,
} = require('../utils/sherlockParser');

function extractEntry(msg) {
    const entry = { text: msg.message || '', message: msg };
    if (msg.entities && msg.entities.length > 0) {
        entry.entities = msg.entities.map(e => {
            const info = { type: e.className, offset: e.offset, length: e.length };
            if (e.url) info.url = e.url;
            if (e.userId) info.userId = e.userId.toString();
            return info;
        });
    }
    if (msg.replyMarkup && msg.replyMarkup.rows) {
        entry.buttons = msg.replyMarkup.rows
            .flatMap(row => row.buttons.map(btn => btn.text));
    }
    return entry;
}

async function main() {
    await telegramService.initialize();
    const client = telegramService.getClient();
    const botUsername = (process.argv[2] || await getBotUsername()).replace(/^@/, '');
    console.log(`[Parser Test] Bot: @${botUsername}`);

    const messages = await client.getMessages(botUsername, { limit: 40 });

    // Classify each bot message
    const botReplies = messages
        .filter(m => !m.out)
        .map(m => ({ id: m.id, edited: !!m.editDate, ...extractEntry(m) }));

    console.log(`\n[Parser Test] Found ${botReplies.length} bot messages\n`);

    const counts = {};

    for (const reply of botReplies) {
        const classification = parseSherlockReply(reply);
        counts[classification.type] = (counts[classification.type] || 0) + 1;

        console.log(`=== ${classification.type.toUpperCase()} (msg ${reply.id}) ===`);
        if (classification.parsed) {
            console.log(JSON.stringify(classification.parsed, null, 2));
        }
        if (classification.buttons) {
            console.log(`  buttons: [${classification.buttons.join(' | ')}]`);
        }
    }

    console.log(`\n[Parser Test] Summary:`, counts);
    process.exit(0);
}

main().catch(err => {
    console.error('[Parser Test] Failed:', err);
    process.exit(1);
});
