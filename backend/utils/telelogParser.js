/**
 * Parser for Telelog bot profile responses.
 *
 * The bot uses Unicode homoglyphs (Greek, Latin, Kazakh, Armenian, etc.)
 * mixed into text to evade filtering, and may respond in Russian or English.
 * This parser is language-agnostic: it relies on entity positions and types
 * rather than text labels for all core data extraction.
 *
 * Entity layout (consistent across languages):
 *   TextUrl[0]      -> display name + profile URL
 *   Bold[0..8]      -> diversity, dateFrom, dateTo, msgCount, chatCount,
 *                       replyPct, mediaPct, circles, voice
 *   Bold[9..N-1]    -> optional fields (sticker count, reputation, channel, etc.)
 *   Bold[N]         -> "ID:" label (identified by proximity to Code entity)
 *   Code            -> telegram ID
 *   Bold[N+1]       -> "usernames:" label
 *   Mention[]       -> @usernames
 *   Bold[N+2]       -> "names:" label
 *   Text lines      -> name history entries (├ date ➜ name)
 */

const HOMOGLYPH_MAP = {
    '\u3164': '',       // Hangul Filler -> strip
    // Greek lowercase -> Cyrillic
    '\u03B1': '\u0430', // alpha -> a
    '\u03B3': '\u0443', // gamma -> u (bot uses gamma as visual y/u)
    '\u03B5': '\u0435', // epsilon -> e
    '\u03B7': '\u043D', // eta -> n
    '\u03BA': '\u043A', // kappa -> k
    '\u03BF': '\u043E', // omicron -> o
    '\u03C0': '\u043F', // pi -> p
    '\u03C1': '\u0440', // rho -> r
    '\u03C4': '\u0442', // tau -> t
    '\u03C6': '\u0444', // phi -> f
    // Greek uppercase -> Cyrillic
    '\u0391': '\u0410', // Alpha -> A
    '\u0392': '\u0412', // Beta -> B
    '\u0395': '\u0415', // Epsilon -> E
    '\u0397': '\u041D', // Eta -> N
    '\u039A': '\u041A', // Kappa -> K
    '\u039C': '\u041C', // Mu -> M
    '\u039F': '\u041E', // Omicron -> O
    '\u03A0': '\u041F', // Pi -> P
    '\u03A1': '\u0420', // Rho -> R
    '\u03A4': '\u0422', // Tau -> T
    '\u03A5': '\u0423', // Upsilon -> U
    '\u03F9': '\u0421', // Lunate sigma -> S
    // Special / extended
    '\u0399': '\u0406', // Greek Iota -> Cyrillic I (used for "ID:")
    '\u1D27': '\u041B', // Latin small capital lambda -> Cyrillic L
    '\u1D1C': '\u0443', // Latin small capital U -> Cyrillic u
    '\u212E': '\u0435', // Estimated sign -> e
    '\u0492': '\u0424', // Kazakh Ghe stroke -> F
    '\u049B': '\u043A', // Kazakh Qa -> k
    '\u0455': 's',      // Cyrillic small es -> Latin s (for English text)
    '\u0581': '\u0433', // Armenian co -> g (visual approximation)
    '\u217C': 'l',      // Small roman numeral fifty -> l
    '\u0192': 'f',      // Latin f with hook -> f
    // Fullwidth Latin -> standard
    '\uFF23': '\u0421', // Fullwidth C -> Cyrillic S
    '\uFF24': '\u0414', // Fullwidth D -> Cyrillic D
    // Latin lowercase -> Cyrillic (for Russian text normalization)
    'a': '\u0430', 'c': '\u0441', 'e': '\u0435', 'k': '\u043A',
    'o': '\u043E', 'p': '\u0440', 'x': '\u0445', 'y': '\u0443',
    // Latin uppercase -> Cyrillic
    'A': '\u0410', 'B': '\u0412', 'C': '\u0421', 'E': '\u0415',
    'H': '\u041D', 'K': '\u041A', 'M': '\u041C', 'O': '\u041E',
    'P': '\u0420', 'T': '\u0422', 'X': '\u0425',
};

// Reverse map: homoglyphs -> Latin equivalents (for Latin-dominant text)
const HOMOGLYPH_TO_LATIN = {
    '\u3164': '',
    // Greek -> Latin
    '\u03B1': 'a', '\u03B3': 'y', '\u03B5': 'e', '\u03B7': 'n',
    '\u03BA': 'k', '\u03BF': 'o', '\u03C0': 'p', '\u03C1': 'p',
    '\u03C4': 't', '\u03C6': 'f',
    '\u0391': 'A', '\u0392': 'B', '\u0395': 'E', '\u0397': 'H',
    '\u039A': 'K', '\u039C': 'M', '\u039F': 'O', '\u03A0': 'P',
    '\u03A1': 'P', '\u03A4': 'T', '\u03A5': 'Y', '\u03F9': 'C',
    // Cyrillic -> Latin (visual lookalikes)
    '\u0430': 'a', '\u0435': 'e', '\u043E': 'o', '\u0440': 'p',
    '\u0441': 'c', '\u0443': 'u', '\u0445': 'x',
    '\u0410': 'A', '\u0412': 'B', '\u0415': 'E', '\u041A': 'K',
    '\u041C': 'M', '\u041D': 'H', '\u041E': 'O', '\u0420': 'P',
    '\u0421': 'C', '\u0422': 'T', '\u0425': 'X',
    // Special
    '\u1D27': 'L', '\u1D1C': 'u', '\u212E': 'e', '\u0581': 'g',
    '\u0492': 'F', '\u049B': 'k', '\u0455': 's', '\u217C': 'l',
    '\u0192': 'f', '\uFF23': 'C', '\uFF24': 'D',
};

function normalizeHomoglyphs(text) {
    let result = '';
    for (const ch of text) {
        result += (ch in HOMOGLYPH_MAP) ? HOMOGLYPH_MAP[ch] : ch;
    }
    return result;
}

/**
 * Detect dominant script and normalize text accordingly.
 * - Latin-dominant: normalize all homoglyphs to Latin
 * - Cyrillic-dominant: normalize all homoglyphs to Cyrillic (via HOMOGLYPH_MAP)
 */
function normalizeText(text) {
    let latinCount = 0;
    let cyrillicCount = 0;
    for (const ch of text) {
        const cp = ch.codePointAt(0);
        if (cp >= 0x0041 && cp <= 0x007A) latinCount++;
        else if (cp >= 0x0400 && cp <= 0x04FF) cyrillicCount++;
    }
    const isCyrillic = cyrillicCount > latinCount;
    const map = isCyrillic ? HOMOGLYPH_MAP : HOMOGLYPH_TO_LATIN;
    const chars = [...text];
    let result = '';
    for (let i = 0; i < chars.length; i++) {
        const ch = chars[i];
        if (ch in map) {
            result += map[ch];
        } else if (isCyrillic && ch === '3') {
            // Digit 3 used as Cyrillic З when followed by a Cyrillic letter
            const next = chars[i + 1];
            if (next && next.codePointAt(0) >= 0x0400 && next.codePointAt(0) <= 0x04FF) {
                result += '\u0417'; // З
            } else {
                result += ch;
            }
        } else {
            result += ch;
        }
    }
    return result;
}

/**
 * Parse a Telelog profile message into structured data.
 *
 * @param {string} text - The raw message text
 * @param {Array} entities - Array of entity objects:
 *   { type: string, offset: number, length: number, url?: string }
 * @returns {object} Parsed profile data
 */
function parseTelelogProfile(text, entities = []) {
    const result = {};

    const textUrlEntities = entities.filter(e => e.type === 'MessageEntityTextUrl');
    const boldEntities = entities.filter(e => e.type === 'MessageEntityBold');
    const codeEntities = entities.filter(e => e.type === 'MessageEntityCode');
    const mentionEntities = entities.filter(e => e.type === 'MessageEntityMention');

    // -- 1. Display name + profile URL from first TextUrl --
    if (textUrlEntities.length > 0) {
        const nameEntity = textUrlEntities[0];
        result.displayName = normalizeText(text.substring(nameEntity.offset, nameEntity.offset + nameEntity.length).trim());
        result.profileUrl = nameEntity.url;
    }

    // -- 2. Core stats from first 9 bold entities --
    const boldValues = boldEntities.map(e => ({
        text: text.substring(e.offset, e.offset + e.length),
        offset: e.offset,
        length: e.length,
    }));

    if (boldValues.length >= 9) {
        result.messageDiversity = parseFloat(boldValues[0].text.replace(',', '.'));
        result.dateFrom = normalizeDateString(boldValues[1].text);
        result.dateTo = normalizeDateString(boldValues[2].text);
        result.messageCount = parseInt(boldValues[3].text, 10);
        result.chatCount = parseInt(boldValues[4].text, 10);
        result.replyPercentage = parseFloat(boldValues[5].text.replace(',', '.'));
        result.mediaPercentage = parseFloat(boldValues[6].text.replace(',', '.'));
        result.circles = parseInt(boldValues[7].text, 10);
        result.voice = parseInt(boldValues[8].text, 10);
    }

    // -- 3. Telegram ID from Code entity (numeric string) --
    const idEntity = codeEntities.find(e => {
        const val = text.substring(e.offset, e.offset + e.length);
        return /^\d+$/.test(val);
    });
    if (idEntity) {
        result.telegramId = text.substring(idEntity.offset, idEntity.offset + idEntity.length);
    }

    // -- 4. Usernames from Mention entities --
    result.usernames = mentionEntities.map(e =>
        text.substring(e.offset, e.offset + e.length)
    );

    // -- 5. Sticker pack URL + count --
    const stickerEntity = textUrlEntities.find(e => e.url && e.url.includes('start='));
    if (stickerEntity) {
        result.stickerPackUrl = stickerEntity.url;
        // Sticker count: the bold entity just before the sticker URL entity
        const stickerCountBold = boldValues.find(bv =>
            bv.offset < stickerEntity.offset &&
            stickerEntity.offset - (bv.offset + bv.length) < 10 &&
            /^\d+$/.test(bv.text)
        );
        if (stickerCountBold) result.stickerPackCount = parseInt(stickerCountBold.text, 10);
    }

    // -- 6. Find "ID:" label bold entity (just before the Code entity) --
    let idLabelBoldIndex = -1;
    if (idEntity) {
        idLabelBoldIndex = boldValues.findIndex(bv =>
            idEntity.offset >= bv.offset && idEntity.offset <= bv.offset + bv.length + 5
        );
    }

    // -- 7. Optional fields: text between voice (bold[8]) and ID section --
    // The first colon-separated line is always the favorite chat/group.
    // Subsequent lines are optional fields parsed by label pattern.
    if (boldValues.length >= 9 && idLabelBoldIndex > 8) {
        const optionalStart = boldValues[8].offset + boldValues[8].length;
        const optionalEnd = boldValues[idLabelBoldIndex].offset;
        const optionalBlock = text.substring(optionalStart, optionalEnd);
        const optionalLines = optionalBlock.split('\n').map(l => l.trim()).filter(Boolean);

        let favoriteChatParsed = false;
        for (const line of optionalLines) {
            const colonIdx = line.indexOf(':');
            if (colonIdx === -1) continue;

            const rawValue = line.substring(colonIdx + 1).trim();

            // Skip the sticker pack line - already parsed via entities
            if (/\[.+\]/.test(rawValue) && result.stickerPackUrl) continue;

            const cleanValue = rawValue.trim();

            // First colon-line is always favorite chat/group
            if (!favoriteChatParsed) {
                result.favoriteChat = normalizeText(cleanValue);
                favoriteChatParsed = true;
                continue;
            }

            // Remaining lines: try to classify by content and bold entity values
            const numMatch = cleanValue.match(/^(\d+)$/);
            if (numMatch) {
                // Pure number value - search count (sticker count already parsed from entities)
                if (result.stickerPackCount == null) {
                    result.stickerPackCount = parseInt(numMatch[1], 10);
                } else {
                    result.searchCount = parseInt(numMatch[1], 10);
                }
                continue;
            }

            // Text value - check bold entities in range for classification hints
            // Reputation is typically a long text phrase; channel is typically short
            const boldInRange = boldValues.find(bv =>
                bv.offset >= optionalStart &&
                bv.offset < optionalEnd &&
                bv.text === cleanValue
            );

            if (boldInRange) {
                // Bold text value - check if it has a TextUrl (channel) or not (reputation)
                const matchingUrl = textUrlEntities.find(e =>
                    e.offset === boldInRange.offset && e.length === boldInRange.length
                );
                if (matchingUrl) {
                    result.channel = { name: normalizeText(cleanValue), url: matchingUrl.url };
                } else {
                    result.reputation = normalizeText(cleanValue);
                }
            } else if (!result.reputation) {
                result.reputation = normalizeText(cleanValue);
            }
        }
    }

    // -- 8. Name history: ├ date ➜ name (language-independent) --
    result.nameHistory = [];
    const nameHistoryRegex = /[├└|]\s*(\d{4}-\d{2}-\d{2})\s*➜\s*(.+)/g;
    let match;
    while ((match = nameHistoryRegex.exec(text)) !== null) {
        result.nameHistory.push({
            date: match[1],
            name: normalizeText(match[2].trim()),
        });
    }

    return result;
}

/**
 * Normalize date strings from various formats to DD.MM.YYYY.
 * Handles: DD.MM.YYYY, M/DD/YYYY, MM/DD/YYYY, YYYY-MM-DD
 */
function normalizeDateString(dateStr) {
    // Already DD.MM.YYYY
    if (/^\d{2}\.\d{2}\.\d{4}$/.test(dateStr)) return dateStr;

    // US format: M/DD/YYYY or MM/DD/YYYY
    const usMatch = dateStr.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/);
    if (usMatch) {
        const [, month, day, year] = usMatch;
        return `${day.padStart(2, '0')}.${month.padStart(2, '0')}.${year}`;
    }

    // ISO format: YYYY-MM-DD
    const isoMatch = dateStr.match(/^(\d{4})-(\d{2})-(\d{2})$/);
    if (isoMatch) {
        const [, year, month, day] = isoMatch;
        return `${day}.${month}.${year}`;
    }

    return dateStr;
}

/**
 * Detect whether a bot reply is a Telelog profile response.
 * Uses entity pattern matching (language-agnostic).
 */
function isTelelogProfileReply(reply) {
    if (!reply.entities || reply.entities.length < 5) return false;
    const hasTextUrl = reply.entities.some(e => e.type === 'MessageEntityTextUrl');
    const hasCode = reply.entities.some(e => e.type === 'MessageEntityCode');
    const hasMention = reply.entities.some(e => e.type === 'MessageEntityMention');
    const hasBold = reply.entities.filter(e => e.type === 'MessageEntityBold').length >= 9;
    return hasTextUrl && hasCode && hasMention && hasBold;
}

module.exports = { parseTelelogProfile, normalizeHomoglyphs, normalizeText, isTelelogProfileReply };
