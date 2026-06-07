/**
 * One-time migration: upload existing OSINT files from filesystem to MongoDB via reid-db-handler.
 * Usage: node scripts/migrate-osint-to-db.js
 */
require('dotenv').config();
const fs = require('fs');
const path = require('path');
const reidService = require('../services/reidService');

const OSINT_PHOTOS_DIR = path.join(__dirname, '..', 'data', 'osint-photos');
const OSINT_REPORTS_DIR = path.join(__dirname, '..', 'data', 'osint-reports');

async function migrateDir(dir, assetType, contentType, source) {
    if (!fs.existsSync(dir)) {
        console.log(`Directory not found, skipping: ${dir}`);
        return 0;
    }

    const files = fs.readdirSync(dir);
    console.log(`Found ${files.length} files in ${dir}`);
    let uploaded = 0;

    for (const filename of files) {
        const filePath = path.join(dir, filename);
        const stat = fs.statSync(filePath);
        if (!stat.isFile()) continue;

        try {
            const buffer = fs.readFileSync(filePath);
            await reidService.uploadOsintAsset({
                filename,
                content_type: contentType,
                asset_type: assetType,
                source,
                data: buffer.toString('base64')
            });
            uploaded++;
            console.log(`  Uploaded: ${filename} (${buffer.length} bytes)`);
        } catch (err) {
            console.error(`  Failed: ${filename} - ${err.message}`);
        }
    }

    return uploaded;
}

async function main() {
    console.log('Migrating OSINT assets from filesystem to MongoDB...\n');

    const photos = await migrateDir(OSINT_PHOTOS_DIR, 'photo', 'image/jpeg', 'sherlock_photo');
    const reports = await migrateDir(OSINT_REPORTS_DIR, 'report', 'text/html', 'sherlock_report');

    console.log(`\nMigration complete: ${photos} photos, ${reports} reports uploaded.`);
    console.log('You can now safely delete data/osint-photos/ and data/osint-reports/ directories.');
}

main().catch(err => {
    console.error('Migration failed:', err);
    process.exit(1);
});
