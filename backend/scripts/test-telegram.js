/**
 * E2E test for Telelog and Sherlock bot interactions.
 *
 * Usage:
 *   node test-telegram.js <mode> [target] [searchType]
 *
 * Modes:  telelog, sherlock, both (default: both)
 * Target: username/phone/id/name (default: @Zothie)
 * Search type (sherlock only): username, phone, telegram_id, name (default: username)
 *
 * Examples:
 *   node test-telegram.js telelog @Zothie
 *   node test-telegram.js sherlock 79125036666 phone
 *   node test-telegram.js sherlock 323894501 telegram_id
 *   node test-telegram.js sherlock Валикон name
 */
require('dotenv').config({ path: require('path').join(__dirname, '../.env') });
const telegramService = require('../services/telegramService');
const telelogService = require('../services/telelogService');
const sherlockService = require('../services/sherlockService');

const MODE = process.argv[2] || 'both';
const TARGET = process.argv[3] || '@Zothie';
const SEARCH_TYPE = process.argv[4] || 'username';

async function main() {
    await telegramService.initialize();

    if (MODE === 'telelog' || MODE === 'both') {
        console.log('\n========== TELELOG ==========\n');
        const profile = await telelogService.interact(TARGET);
        if (profile) {
            console.log('\n--- PARSED ---');
            console.log(JSON.stringify(profile, null, 2));
        } else {
            console.log('[test] Telelog returned no profile data');
        }
    }

    if (MODE === 'sherlock' || MODE === 'both') {
        console.log('\n========== SHERLOCK ==========\n');
        const result = await sherlockService.interact(TARGET, SEARCH_TYPE);
        console.log('\n--- RESULT ---');
        console.log(`type: ${result.type}`);
        if (result.parsed) {
            console.log(JSON.stringify(result.parsed, null, 2));
        } else {
            console.log('(no parsed data)');
        }
    }

    console.log('\n[test] Done, waiting 3s before exit...');
    await new Promise(resolve => setTimeout(resolve, 3000));
    process.exit(0);
}

main().catch(err => {
    console.error('[test] Failed:', err);
    process.exit(1);
});
