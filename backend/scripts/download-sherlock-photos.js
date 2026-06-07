/**
 * Download photos from the last sherlock photo search in the bot chat.
 * Usage: node scripts/download-sherlock-photos.js [@botUsername] [messageCount]
 */
require('dotenv').config();
const telegramService = require('../services/telegramService');
const reidService = require('../services/reidService');
const crypto = require('crypto');

async function main() {
    const botUsername = process.argv[2] || '@jferiohgrehuo_bot';
    const limit = parseInt(process.argv[3]) || 30;

    await telegramService.initialize();
    const client = telegramService.getClient();

    const entity = await client.getEntity(botUsername);
    const messages = await client.getMessages(entity, { limit });

    // Sort by id ascending
    messages.sort((a, b) => a.id - b.id);

    // Group photos by person card
    // Pattern: person card (text with "Совпадение") -> photos (media, no text) -> similarity msg
    const personGroups = [];
    let currentGroup = null;

    for (const msg of messages) {
        const text = msg.text || '';

        if (text.includes('Совпадение:')) {
            // Person card
            currentGroup = { personText: text, photos: [], msgId: msg.id };
            personGroups.push(currentGroup);
        } else if (msg.media && msg.media.photo && !text) {
            // Photo message
            if (currentGroup) {
                currentGroup.photos.push(msg);
            }
        } else if (text.includes('Похожесть лица')) {
            // Similarity message - end of this person's photos
            currentGroup = null;
        }
    }

    console.log(`Found ${personGroups.length} person groups`);

    for (const group of personGroups) {
        const firstLine = group.personText.split('\n')[0].substring(0, 60);
        console.log(`\nPerson: ${firstLine}`);
        console.log(`  Photos: ${group.photos.length}`);

        const savedPhotos = [];
        for (const msg of group.photos) {
            try {
                const buffer = await client.downloadMedia(msg);
                if (buffer) {
                    const hash = crypto.createHash('md5').update(buffer).digest('hex').slice(0, 12);
                    const filename = `sherlock_${hash}.jpg`;
                    await reidService.uploadOsintAsset({
                        filename,
                        content_type: 'image/jpeg',
                        asset_type: 'photo',
                        source: 'sherlock_photo',
                        data: buffer.toString('base64')
                    });
                    savedPhotos.push(filename);
                    console.log(`  Saved: ${filename} (${buffer.length} bytes)`);
                }
            } catch (err) {
                console.error(`  Failed to download msg ${msg.id}: ${err.message}`);
            }
        }
        group.savedPhotos = savedPhotos;
    }

    // Output the person-to-photos mapping for manual DB update
    console.log('\n=== Person-to-photos mapping ===');
    for (const group of personGroups) {
        console.log(`${group.personText.split('\n')[0].substring(0, 60)}`);
        console.log(`  photos: ${JSON.stringify(group.savedPhotos)}`);
    }

    process.exit(0);
}

main().catch(err => {
    console.error('Error:', err);
    process.exit(1);
});
