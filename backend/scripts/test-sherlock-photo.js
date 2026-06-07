/**
 * Test for Sherlock photo search via sherlockService.interact().
 *
 * Usage:
 *   node test-sherlock-photo.js [path-to-photo]
 *
 * Default photo: ~/Downloads/photo_2025-10-14_09-00-46.jpg
 */
require('dotenv').config({ path: require('path').join(__dirname, '../.env') });
const fs = require('fs');
const path = require('path');
const telegramService = require('../services/telegramService');
const sherlockService = require('../services/sherlockService');

const PHOTO_PATH = process.argv[2] || path.join(process.env.HOME, 'Downloads/photo_2025-10-14_09-00-46.jpg');

async function main() {
    if (!fs.existsSync(PHOTO_PATH)) {
        console.error(`Photo not found: ${PHOTO_PATH}`);
        process.exit(1);
    }

    const photoBuffer = fs.readFileSync(PHOTO_PATH);
    console.log(`Photo: ${PHOTO_PATH} (${photoBuffer.length} bytes)`);

    await telegramService.initialize();

    console.log('\n========== SHERLOCK PHOTO SEARCH ==========\n');
    const result = await sherlockService.interact('photo_search', 'photo', { photoBuffer });

    console.log('\n--- RESULT ---');
    console.log(`type: ${result.type}`);
    if (result.parsed) {
        console.log(JSON.stringify(result.parsed, null, 2));
    } else {
        console.log('(no parsed data)');
    }

    console.log('\n[test] Done, waiting 3s before exit...');
    await new Promise(resolve => setTimeout(resolve, 3000));
    process.exit(0);
}

main().catch(err => {
    console.error('[test] Failed:', err);
    process.exit(1);
});
