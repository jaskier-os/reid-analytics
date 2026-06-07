/**
 * Parser for Sherlock bot responses.
 *
 * Handles response types:
 * 1. Phone search - rich report with phone info, contacts, socials, emails
 * 2. Telegram search - compact report with ID, phone, name history
 *    (same format for username search and ID->Telegram button click)
 * 3. Name search - summary with match count + link to full report
 *
 * All parsed results share a common structure for cross-search aggregation.
 * Aggregation keys: telegramId, phone, usernames.
 */

// --- Entity helpers ---

function entityText(text, entity) {
    return text.substring(entity.offset, entity.offset + entity.length);
}

function textAfterEntity(text, entity) {
    const start = entity.offset + entity.length;
    const rest = text.substring(start);
    const newline = rest.indexOf('\n');
    return (newline === -1 ? rest : rest.substring(0, newline)).trim();
}

function entitiesByType(entities, type) {
    return entities.filter(e => e.type === type);
}

function findBoldByText(text, entities, label) {
    return entities.find(e =>
        e.type === 'MessageEntityBold' && entityText(text, e).includes(label)
    );
}

function findCodeAfter(text, entities, afterOffset) {
    return entities.find(e =>
        e.type === 'MessageEntityCode' && e.offset > afterOffset
    );
}

// --- Response type detection ---

function isPhoneSearchResult(reply) {
    const text = reply.text || '';
    return text.includes('Телефон:') && text.includes('Оператор:');
}

function isTelegramSearchResult(reply) {
    if (!reply.entities || reply.entities.length < 3) return false;
    const text = reply.text || '';
    const bolds = entitiesByType(reply.entities, 'MessageEntityBold');
    const hasIdLabel = bolds.some(e => entityText(text, e) === 'ID:');
    return hasIdLabel && text.includes('История изменения имени:');
}

// Disambiguation: "Обнаружен логин/идентификатор" with service selection buttons
function isDisambiguationMessage(reply) {
    const text = reply.text || '';
    return text.includes('Обнаружен') && text.includes('Выберите направление')
        && reply.buttons && reply.buttons.length > 0;
}

// Country selection: name search shows ФИО breakdown + country buttons
// Format: "Фамилия: ...\nИмя: ...\n...\nВыберите направление для поиска:"
function isCountrySelectionMessage(reply) {
    const text = reply.text || '';
    return text.includes('Фамилия:') && text.includes('Выберите направление')
        && reply.buttons && reply.buttons.length > 0;
}

// Name search result: "Запрос: ... Обнаружено N совпадений"
function isNameSearchResult(reply) {
    if (!reply.entities || reply.entities.length < 2) return false;
    const text = reply.text || '';
    return text.includes('Запрос:') && text.includes('совпадений');
}

// --- Photo search result detection and parsing ---
// Bot sends multiple person cards after photo search. Each card is an edited message with format:
//   💡 {FullName} {DOB}
//
//   Возраст: {age}
//   Имя: {firstName}
//   Город: {city}
//   Вконтакте: {url}
//   Телефон: {phone}
//   Совпадение: {similarity}%
//
// Similarity messages have format: "Похожесть лица составляет около: {N}%"
// with pagination buttons: [N / total | Показать еще]

function isPhotoSearchResult(reply) {
    const text = reply.text || '';
    return text.includes('Совпадение:');
}

function isPhotoSimilarityMessage(reply) {
    const text = reply.text || '';
    return text.includes('Похожесть лица составляет около:');
}

function parsePhotoSearchResults(replies) {
    const persons = [];

    for (const r of replies) {
        if (!isPhotoSearchResult(r)) continue;
        const text = r.text || '';
        const entities = r.entities || [];
        const person = { searchType: 'photo' };

        // Full name + DOB from first Code entity (after 💡)
        const codes = entitiesByType(entities, 'MessageEntityCode');
        if (codes.length > 0) {
            const nameText = entityText(text, codes[0]);
            const dobMatch = nameText.match(/^(.+?)\s+(\d{2}\.\d{2}\.\d{4})$/);
            if (dobMatch) {
                person.fullName = dobMatch[1].trim();
                person.dateOfBirth = dobMatch[2];
            } else {
                person.fullName = nameText;
            }
        }

        // Parse line-based fields
        const lines = text.split('\n');
        for (const line of lines) {
            const trimmed = line.trim();
            if (trimmed.startsWith('Возраст:')) {
                const age = parseInt(trimmed.substring(8).trim(), 10);
                if (!isNaN(age)) person.age = age;
            } else if (trimmed.startsWith('Имя:') && !person.firstName) {
                person.firstName = trimmed.substring(4).trim();
            } else if (trimmed.startsWith('Город:')) {
                person.city = trimmed.substring(6).trim();
            } else if (trimmed.startsWith('Совпадение:')) {
                const pct = parseInt(trimmed.match(/(\d+)%/)?.[1], 10);
                if (!isNaN(pct)) person.similarity = pct;
            }
        }

        // VK URL from MessageEntityUrl
        const urls = entitiesByType(entities, 'MessageEntityUrl');
        const vkUrl = urls.find(e => entityText(text, e).includes('vk.com'));
        if (vkUrl) {
            person.vk = { url: entityText(text, vkUrl) };
        }

        // Phone from MessageEntityPhone
        const phones = entitiesByType(entities, 'MessageEntityPhone');
        if (phones.length > 0) {
            person.phone = entityText(text, phones[0]).replace(/^\+/, '');
        }

        // First name from Имя bold field
        const bolds = entitiesByType(entities, 'MessageEntityBold');
        const nameBold = bolds.find(e => entityText(text, e) === 'Имя:');
        if (nameBold) {
            person.firstName = textAfterEntity(text, nameBold);
        }

        persons.push(person);
    }

    return persons;
}

function isHelpMessage(reply) {
    const text = reply.text || '';
    return text.includes('Личность:') && text.includes('@sherlock');
}

// --- Phone search parser ---
// Response format (msg 761534):
//   📱
//   ├ Телефон: {phone}
//   ├ Оператор: {operator}
//   ├ Регион: {region}
//   └ Страна: {country}
//   🔎 Телефонные книги: {comma-separated names}
//   🧑‍💻 Вконтакте: {name} [TextUrl to vk.com]
//   🏦 Мобильный банк: {name} ({bank details})
//   💬 Telegram: @{username} [{id}]
//   📧 E-mail: {comma-separated emails}
//   👁 Интересовались этим: {count}

function parsePhoneSearchResult(text, entities, buttons) {
    const result = { searchType: 'phone' };

    const codes = entitiesByType(entities, 'MessageEntityCode');
    const bolds = entitiesByType(entities, 'MessageEntityBold');
    const mentions = entitiesByType(entities, 'MessageEntityMention');
    const emails = entitiesByType(entities, 'MessageEntityEmail');
    const textUrls = entitiesByType(entities, 'MessageEntityTextUrl');

    // Phone - first Code entity that is purely digits
    const phoneCode = codes.find(e => /^\d{10,15}$/.test(entityText(text, e)));
    if (phoneCode) result.phone = entityText(text, phoneCode);

    // Phone info from tree structure
    const lines = text.split('\n');
    for (const line of lines) {
        const trimmed = line.replace(/^[├└│\s]+/, '').trim();
        if (trimmed.startsWith('Оператор:')) {
            result.phoneOperator = trimmed.substring(10).trim();
        } else if (trimmed.startsWith('Регион:')) {
            result.phoneRegion = trimmed.substring(8).trim();
        } else if (trimmed.startsWith('Страна:')) {
            result.phoneCountry = trimmed.substring(8).trim();
        }
    }

    // Phonebook names
    const phonebookBold = findBoldByText(text, entities, 'Телефонные книги');
    if (phonebookBold) {
        const val = textAfterEntity(text, phonebookBold);
        result.phonebookNames = val.split(',').map(n => n.trim()).filter(Boolean);
    }

    // VK profile
    const vkUrl = textUrls.find(e => e.url && e.url.includes('vk.com'));
    if (vkUrl) {
        result.vk = { name: entityText(text, vkUrl), url: vkUrl.url };
    }

    // Bank info
    const bankBold = findBoldByText(text, entities, 'Мобильный банк');
    if (bankBold) {
        const bankNameBold = bolds.find(e =>
            e.offset > bankBold.offset + bankBold.length &&
            e.offset < bankBold.offset + 100
        );
        if (bankNameBold) {
            const bankName = entityText(text, bankNameBold);
            const afterName = text.substring(bankNameBold.offset + bankNameBold.length);
            const newline = afterName.indexOf('\n');
            const lineRest = newline === -1 ? afterName : afterName.substring(0, newline);
            const parenMatch = lineRest.match(/\((.+)\)/);
            result.bank = { name: bankName };
            if (parenMatch) result.bank.details = parenMatch[1];
        }
    }

    // Telegram username + ID
    const tgBold = findBoldByText(text, entities, 'Telegram:');
    if (tgBold) {
        const tgMention = mentions.find(e => e.offset > tgBold.offset);
        if (tgMention) {
            result.usernames = [entityText(text, tgMention)];
        }
        const tgIdCode = codes.find(e =>
            e.offset > tgBold.offset && /^\d+$/.test(entityText(text, e))
        );
        if (tgIdCode) {
            result.telegramId = entityText(text, tgIdCode);
        }
    }

    // Emails
    if (emails.length > 0) {
        result.emails = emails.map(e => entityText(text, e));
    }

    // Interest count
    const interestBold = findBoldByText(text, entities, 'Интересовались этим');
    if (interestBold) {
        const ic = findCodeAfter(text, entities, interestBold.offset);
        if (ic) result.interestCount = parseInt(entityText(text, ic), 10);
    }

    // Report URL from button (same as name search)
    if (buttons && buttons.length > 0) {
        for (const btn of buttons) {
            if (typeof btn === 'object' && btn.url && btn.url.includes('sherlock-report')) {
                result.reportUrl = btn.url;
            }
        }
    }

    return result;
}

// --- Telegram search parser ---
// Response format (msg 761537, same for username and ID->Telegram):
//   💬 ID: {id}
//   📞 Телефон: {phone}
//   🕓 История изменения имени:
//   {date} -> @{username}, {name}, {id}
//   ...
//   👁 Интересовались этим: {count}

function parseTelegramSearchResult(text, entities) {
    const result = { searchType: 'telegram' };

    const codes = entitiesByType(entities, 'MessageEntityCode');
    const bolds = entitiesByType(entities, 'MessageEntityBold');

    // ID
    const idBold = bolds.find(e => entityText(text, e) === 'ID:');
    if (idBold) {
        const idCode = codes.find(e =>
            e.offset > idBold.offset && /^\d+$/.test(entityText(text, e))
        );
        if (idCode) result.telegramId = entityText(text, idCode);
    }

    // Phone
    const phoneBold = bolds.find(e => entityText(text, e) === 'Телефон:');
    if (phoneBold) {
        const phoneCode = codes.find(e =>
            e.offset > phoneBold.offset && /^\d+$/.test(entityText(text, e))
        );
        if (phoneCode) result.phone = entityText(text, phoneCode);
    }

    // Name history
    const historyBold = findBoldByText(text, entities, 'История изменения имени');
    const interestBold = findBoldByText(text, entities, 'Интересовались этим');

    if (historyBold) {
        result.nameHistory = [];
        const historyEnd = interestBold ? interestBold.offset : text.length;
        const historyText = text.substring(historyBold.offset + historyBold.length, historyEnd);

        for (const line of historyText.split('\n')) {
            const match = line.match(/(\d{2}\.\d{2}\.\d{4})\s*\u2192\s*(.+)/);
            if (!match) continue;
            const entry = { date: match[1] };
            for (const part of match[2].split(',').map(p => p.trim())) {
                if (part.startsWith('@')) entry.username = part;
                else if (/^\d+$/.test(part)) entry.id = part;
                else entry.name = part;
            }
            result.nameHistory.push(entry);
        }

        const usernames = [...new Set(result.nameHistory.filter(e => e.username).map(e => e.username))];
        if (usernames.length > 0) result.usernames = usernames;
        const names = [...new Set(result.nameHistory.filter(e => e.name).map(e => e.name))];
        if (names.length > 0) result.names = names;
    }

    // Interest count
    if (interestBold) {
        const ic = findCodeAfter(text, entities, interestBold.offset);
        if (ic) result.interestCount = parseInt(entityText(text, ic), 10);
    }

    return result;
}

// --- Name search parser ---
// Response format (msg 761551):
//   📄 Запрос: {name DOB}
//   🔍 Обнаружено {N} совпадений.
//   📂 Ознакомиться с полным отчетом можно по ссылке ниже.
//   👁 Интересовались этим: {count}
//   Buttons: [Комментарии | 📄 Открыть полный отчет ({N} шт)]

function parseNameSearchResult(text, entities, buttons) {
    const result = { searchType: 'name' };

    const codes = entitiesByType(entities, 'MessageEntityCode');
    const bolds = entitiesByType(entities, 'MessageEntityBold');

    // Search query (the Code entity after "Запрос:")
    const queryBold = findBoldByText(text, entities, 'Запрос');
    if (queryBold) {
        const queryCode = findCodeAfter(text, entities, queryBold.offset);
        if (queryCode) {
            const queryText = entityText(text, queryCode);
            // Parse "Фамилия Имя Отчество ДД.ММ.ГГГГ"
            const dobMatch = queryText.match(/^(.+?)\s+(\d{2}\.\d{2}\.\d{4})$/);
            if (dobMatch) {
                result.fullName = dobMatch[1].trim();
                result.dateOfBirth = dobMatch[2];
            } else {
                result.fullName = queryText;
            }
        }
    }

    // Match count from "Обнаружено N совпадений"
    const matchBold = findBoldByText(text, entities, 'Обнаружено');
    if (matchBold) {
        const matchText = entityText(text, matchBold);
        const numMatch = matchText.match(/(\d+)/);
        if (numMatch) result.matchCount = parseInt(numMatch[1], 10);
    }

    // Interest count
    const interestBold = findBoldByText(text, entities, 'Интересовались этим');
    if (interestBold) {
        const ic = findCodeAfter(text, entities, interestBold.offset);
        if (ic) {
            const val = entityText(text, ic).replace(/,/g, '');
            result.interestCount = parseInt(val, 10);
        }
    }

    // Report URL from button
    if (buttons && buttons.length > 0) {
        // buttons might be raw objects with .url or just text strings
        // In botHelper, buttons are stored as text strings, but the raw message has URL buttons
        // We need to handle both formats
        for (const btn of buttons) {
            if (typeof btn === 'object' && btn.url && btn.url.includes('sherlock-report')) {
                result.reportUrl = btn.url;
            }
        }
    }

    return result;
}

// --- Main entry point ---

/**
 * Classify and parse a Sherlock bot reply.
 *
 * @param {object} reply - { text, entities, buttons, edited, message }
 * @returns {{ type: string, parsed: object|null, buttons?: string[] }}
 */
function parseSherlockReply(reply) {
    if (isHelpMessage(reply)) {
        return { type: 'help', parsed: null };
    }
    if (isCountrySelectionMessage(reply)) {
        return { type: 'country_selection', parsed: null, buttons: reply.buttons };
    }
    if (isDisambiguationMessage(reply)) {
        return { type: 'disambiguation', parsed: null, buttons: reply.buttons };
    }
    if (isTelegramSearchResult(reply)) {
        return { type: 'telegram_result', parsed: parseTelegramSearchResult(reply.text, reply.entities || []) };
    }
    if (isPhoneSearchResult(reply)) {
        return { type: 'phone_result', parsed: parsePhoneSearchResult(reply.text, reply.entities || [], extractButtonData(reply)) };
    }
    if (isNameSearchResult(reply)) {
        return { type: 'name_result', parsed: parseNameSearchResult(reply.text, reply.entities || [], extractButtonData(reply)) };
    }
    if (isPhotoSearchResult(reply)) {
        return { type: 'photo_result', parsed: null };
    }
    if (isPhotoSimilarityMessage(reply)) {
        return { type: 'photo_similarity', parsed: null };
    }
    return { type: 'unknown', parsed: null };
}

/**
 * Extract button data (text + url) from reply.
 * Orchestrator replies already have buttons in [{text, url}] or string format.
 */
function extractButtonData(reply) {
    if (!reply.buttons || reply.buttons.length === 0) return [];
    return reply.buttons.map(btn => {
        if (typeof btn === 'object') return { text: btn.text, url: btn.url };
        return { text: btn };
    });
}

module.exports = {
    parseSherlockReply,
    parsePhoneSearchResult,
    parseTelegramSearchResult,
    parseNameSearchResult,
    parsePhotoSearchResults,
    isPhoneSearchResult,
    isTelegramSearchResult,
    isNameSearchResult,
    isPhotoSearchResult,
    isPhotoSimilarityMessage,
    isDisambiguationMessage,
    isCountrySelectionMessage,
    isHelpMessage,
};
