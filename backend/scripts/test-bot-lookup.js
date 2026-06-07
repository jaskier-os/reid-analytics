/**
 * Integration test: getBotUsername() via the new OAuth flow.
 */
require('dotenv').config({ path: require('path').join(__dirname, '../.env') });

const telegramService = require('../services/telegramService');
const { getBotUsername } = require('../services/sherlockService');
const { closeBrowser } = require('../utils/sherlockBrowser');

async function main() {
    console.log('Initializing Telegram client...');
    await telegramService.initialize();

    console.log('Calling getBotUsername()...');
    const username = await getBotUsername();
    console.log(`\nResult: @${username}`);

    // Test cache hit
    console.log('\nCalling getBotUsername() again (should be cached)...');
    const cached = await getBotUsername();
    console.log(`Cached result: @${cached}`);

    await closeBrowser();
    process.exit(0);
}

main().catch(async err => {
    console.error('Error:', err.message);
    await closeBrowser().catch(() => {});
    process.exit(1);
});
