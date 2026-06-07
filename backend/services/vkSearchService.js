const { chromium } = require('playwright');
const axios = require('axios');
const crypto = require('crypto');
const path = require('path');
const fs = require('fs');
const os = require('os');
const reidService = require('./reidService');

const SEARCH_URL = 'https://search4faces.com/search_vkwall.html';
const FLARESOLVERR_URL = process.env.FLARESOLVERR_URL || 'http://flaresolverr:8191/v1';
const RESULT_TIMEOUT_MS = 60000;
const MAX_RESULTS = 50;
const MIN_SIMILARITY = 54; // search4faces threshold: >=57 = identical, >=54 = similar, <54 = garbage

// Cache CF cookies so we don't solve the challenge on every request
let cfCache = { cookies: null, userAgent: null, expiresAt: 0 };
const CF_CACHE_TTL_MS = 10 * 60 * 1000; // 10 minutes

/**
 * Get Cloudflare clearance cookies via FlareSolverr.
 */
async function getCfClearance() {
    if (cfCache.cookies && Date.now() < cfCache.expiresAt) {
        console.log('[VkSearch] Using cached CF cookies');
        return { cookies: cfCache.cookies, userAgent: cfCache.userAgent };
    }

    console.log('[VkSearch] Solving Cloudflare challenge via FlareSolverr...');
    const { data } = await axios.post(FLARESOLVERR_URL, {
        cmd: 'request.get',
        url: SEARCH_URL,
        maxTimeout: 30000,
    }, { timeout: 45000 });

    if (data.status !== 'ok') {
        throw new Error(`[VkSearch] FlareSolverr failed: ${data.message}`);
    }

    const cookies = data.solution.cookies;
    const userAgent = data.solution.userAgent;

    cfCache = { cookies, userAgent, expiresAt: Date.now() + CF_CACHE_TTL_MS };
    console.log(`[VkSearch] CF challenge solved, got ${cookies.length} cookies`);
    return { cookies, userAgent };
}

/**
 * Write a photo buffer to a temporary file for Playwright file upload.
 */
function writeTempPhoto(photoBuffer) {
    const tmpPath = path.join(os.tmpdir(), `s4f_upload_${Date.now()}.jpg`);
    fs.writeFileSync(tmpPath, photoBuffer);
    return tmpPath;
}

/**
 * Parse result cards from the search4faces results page.
 */
async function parseResults(page) {
    return page.evaluate(() => {
        const cards = document.querySelectorAll('.card.card-vk01');
        return Array.from(cards).map(card => {
            const profileLink = card.querySelector('.btn-vk01-container a.btn-vk01[href*="vk.com"]');
            const photoLink = card.querySelector('.card-vk01-fixed a[href*="vk.com"]');
            const img = card.querySelector('.card-img-vk01');
            const nameEl = card.querySelector('.card-vk01-header');
            const scoreLabel = card.querySelector('.card-vk01-score .score-label');
            const ageEl = card.querySelector('.card-vk01-age');
            const geoEl = card.querySelector('.card-vk01-geo');

            const profileUrl = profileLink?.href || '';
            const vkIdMatch = profileUrl.match(/vk\.com\/id(\d+)/);

            const ageText = ageEl?.textContent?.trim() || '';
            const ageMatch = ageText.match(/^(\d+)\s/);
            const dobMatch = ageText.match(/\[([^\]]+)\]/);
            let dateOfBirth = null;
            if (dobMatch) {
                const parts = dobMatch[1].split('.');
                if (parts.length === 3) {
                    dateOfBirth = parts.map(p => p.padStart(2, '0')).join('.');
                }
            }

            const geoText = geoEl?.textContent?.trim() || '';
            const cityMatch = geoText.match(/\[([^\]]+)\]/);

            const fullName = nameEl?.textContent?.trim() || null;
            const similarity = scoreLabel ? parseFloat(scoreLabel.textContent) : null;

            return {
                fullName,
                dateOfBirth,
                age: ageMatch ? parseInt(ageMatch[1], 10) : null,
                firstName: fullName ? fullName.split(' ')[0] : null,
                city: cityMatch ? cityMatch[1] : null,
                country: geoText.split('[')[0]?.trim() || null,
                similarity,
                vk: { url: profileUrl || null, id: vkIdMatch ? vkIdMatch[1] : null },
                photoUrl: img?.src || null,
                photoPageUrl: photoLink?.href || null,
            };
        });
    });
}

/**
 * Search for a face on search4faces.com VK wall database.
 *
 * Strategy: bypass Uppload UI entirely.
 * 1. Load page with CF cookies (needed for same-origin fetch)
 * 2. Upload image directly to upload.php via in-page fetch
 * 3. Call detect.php (the search endpoint) with the returned filename + boundings
 * 4. The site's JS renders result cards in the DOM, then we parse them
 */
async function search(photoBuffer, options = {}) {
    const maxResults = options.maxResults || MAX_RESULTS;

    const { cookies, userAgent } = await getCfClearance();

    const pwCookies = cookies.map(c => ({
        name: c.name,
        value: c.value,
        domain: c.domain,
        path: c.path || '/',
        httpOnly: !!c.httpOnly,
        secure: !!c.secure,
        sameSite: c.sameSite === 'None' ? 'None' : c.sameSite === 'Strict' ? 'Strict' : 'Lax',
        expires: c.expiry || -1,
    }));

    const photoBase64 = photoBuffer.toString('base64');
    let browser;

    try {
        browser = await chromium.launch({
            headless: true,
            args: ['--no-sandbox', '--disable-setuid-sandbox'],
        });
        const context = await browser.newContext({ userAgent });
        await context.addCookies(pwCookies);
        const page = await context.newPage();

        console.log('[VkSearch] Navigating to search4faces with CF cookies...');
        await page.goto(SEARCH_URL, { waitUntil: 'load', timeout: 30000 });

        // Verify we got past CF
        const title = await page.title();
        if (title.includes('moment')) {
            console.log('[VkSearch] CF cookies stale, re-solving...');
            cfCache = { cookies: null, userAgent: null, expiresAt: 0 };
            await browser.close();
            browser = null;
            return search(photoBuffer, { ...options, _retry: true });
        }

        await page.locator('#upload-button').waitFor({ state: 'attached', timeout: 15000 });

        // Step 1: Upload image directly to upload.php (bypassing Uppload UI)
        console.log('[VkSearch] Uploading photo to upload.php...');
        const uploadResult = await page.evaluate(async (b64) => {
            // Convert base64 to Blob
            const binary = atob(b64);
            const bytes = new Uint8Array(binary.length);
            for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
            const blob = new Blob([bytes], { type: 'image/jpeg' });

            const resp = await fetch('assets/php/upload.php', { method: 'POST', body: blob });
            return resp.json();
        }, photoBase64);

        if (!uploadResult.url) {
            throw new Error(`[VkSearch] Upload failed - no faces detected: ${JSON.stringify(uploadResult)}`);
        }

        console.log(`[VkSearch] Upload OK: ${uploadResult.url}, ${uploadResult.boundings?.length} face(s) detected`);

        // Step 2: Trigger the search via detect.php using the site's own JS
        // Set the engine.js variables and call the search fetch via the page's jQuery click handler
        const resultsCount = String(maxResults);
        console.log('[VkSearch] Starting search via detect.php...');

        await page.evaluate(async ({ filename, boundings, query, results, lang }) => {
            // Call detect.php directly (same as the search button click handler does)
            const resp = await fetch('assets/php/detect.php', {
                method: 'POST',
                body: JSON.stringify({ query, results, lang, filename, boundings: boundings[0] })
            });
            const json = await resp.json();

            // Call the site's own process_faces function to render results in DOM
            // It's defined in engine.js closure so we can't call it directly.
            // Instead, set the JS state and trigger the button click properly.
            window._s4f_detectResult = json;
        }, {
            filename: uploadResult.url,
            boundings: uploadResult.boundings,
            query: 'vk01',
            results: resultsCount,
            lang: 'ru',
        });

        // Check if detect.php returned results
        const detectResult = await page.evaluate(() => window._s4f_detectResult);

        if (!detectResult || !detectResult.faces || detectResult.faces.length === 0) {
            const facesFound = detectResult?.faces_found || 0;
            console.log(`[VkSearch] No matches found (faces_found: ${facesFound})`);
            return {
                searchType: 'vk_photo',
                persons: [],
                totalResults: 0,
            };
        }

        console.log(`[VkSearch] Got ${detectResult.faces?.length || 0} results, parsing...`);

        // Parse detect.php response directly.
        // Face array format (20 elements):
        // [0]  db source       "vk01"
        // [1]  profile URL     "https://vk.com/id..."
        // [2]  face image URL  "https://i.search4faces.com/faces/..."
        // [3]  photo page URL  "https://vk.com/id...?z=photo..."
        // [4]  photo ID
        // [5-8] internal IDs
        // [9]  source photo URL (userapi.com)
        // [10] score           "51.28" (similarity %)
        // [11] category        "primary"
        // [12] age or -1
        // [13] first name
        // [14] last name
        // [15] maiden name
        // [16] city
        // [17] country
        // [18] birth date      "23.5.1994" or ""
        // [19] unknown
        const persons = detectResult.faces.map(face => {
            const profileUrl = face[1] || '';
            const vkIdMatch = profileUrl.match(/vk\.com\/id(\d+)/);
            const firstName = face[13] || '';
            const lastName = face[14] || '';
            const fullName = `${firstName} ${lastName}`.trim() || null;
            const score = parseFloat(face[10]) || null;
            const rawAge = parseInt(face[12]);
            const age = (rawAge > 0) ? rawAge : null;
            const city = face[16] || null;
            const country = face[17] || null;
            const bdate = face[18] || null;

            // Normalize DOB "23.5.1994" -> "23.05.1994"
            let dateOfBirth = null;
            if (bdate) {
                const parts = bdate.split('.');
                if (parts.length === 3) {
                    dateOfBirth = parts.map(p => p.padStart(2, '0')).join('.');
                }
            }

            return {
                fullName,
                dateOfBirth,
                age,
                firstName: firstName || null,
                city,
                country,
                similarity: score,
                vk: { url: profileUrl || null, id: vkIdMatch ? vkIdMatch[1] : null },
                photoUrl: face[2] || null,
                photoPageUrl: face[3] || null,
            };
        }).filter(p => p.similarity >= MIN_SIMILARITY);

        console.log(`[VkSearch] Found ${persons.length} results (filtered from ${detectResult.faces.length}, threshold: ${MIN_SIMILARITY}%)`);

        // Download face photos via Playwright's API context (carries cookies, no CORS)
        for (const person of persons) {
            if (!person.photoUrl) continue;
            try {
                const resp = await context.request.get(person.photoUrl);
                if (resp.ok()) {
                    const buffer = await resp.body();
                    const b64 = buffer.toString('base64');
                    const hash = crypto.createHash('md5').update(person.photoUrl).digest('hex').slice(0, 12);
                    const filename = `s4f_${hash}.jpg`;
                    await reidService.uploadOsintAsset({
                        filename,
                        content_type: 'image/jpeg',
                        asset_type: 'photo',
                        source: 'search4faces',
                        data: b64,
                    });
                    person.photoUrl = filename;
                }
            } catch (e) {
                console.error(`[VkSearch] Failed to download photo: ${e.message}`);
            }
        }

        return {
            searchType: 'vk_photo',
            persons,
            totalResults: persons.length,
        };
    } finally {
        if (browser) await browser.close();
    }
}

module.exports = { search };
