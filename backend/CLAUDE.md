# reid-analytics backend

Express API server that aggregates data from reid-db-handler (persons, sightings, traits, cameras) and reid-worker (photo identification), adds OSINT enrichment via Telegram bots (Sherlock, Telelog), provides real-time updates via Socket.IO, and proxies map/fire tiles with MongoDB caching.

## Tech Stack

- Node.js 18+ (CommonJS)
- Express, Socket.IO, MongoDB (Mongoose), Helmet, CORS, Morgan
- Telegram MTProto client: `telegram` (GramJS v2)
- axios, cheerio, multer, form-data

## Architecture

### Route Groups

- `/api/reid` -- ReID operations (persons CRUD, sightings, cameras, search, OSINT). Controller: `reidController.js`
- `/api/layers` -- Map layer management (CRUD, elements). Controller: `layerController.js`
- `/api/tiles` -- Tile proxy with MongoDB caching (OSM, Google Satellite/Terrain, NASA FIRMS fire data)
- `/api/unfurl` -- URL metadata extraction for tldraw bookmark shapes
- `/api/permissions` -- Service permission checks. Controller: `permissionController.js`

### Key Services

- `reidService.js` -- Proxy to reid-db-handler API (`TRAITS_API_URL`) and reid-worker (`REID_WORKER_URL`). All person/sighting/trait/camera/OSINT-asset operations go through here. Never talks to any database directly.
- `socketService.js` -- Socket.IO server. Polls reid-db-handler for new sightings on watched persons, emits `person-sighting`, `person-updated`, `person-deleted`, `person-created` events. Clients join `person-<id>` rooms.
- `telegramService.js` -- MTProto user client (see Telegram Module below)
- `sherlockService.js` -- Sherlock OSINT bot interaction (see below)
- `telelogService.js` -- Telelog OSINT bot interaction (see below)
- `assetService.js` -- Local file storage for tldraw assets (`.assets/` dir)
- `unfurlService.js` -- Fetches Open Graph / HTML metadata from URLs
- `permissionService.js` -- Checks service-level permissions from config

### Models (MongoDB via Mongoose)

- `Layer.js` -- Map layers with embedded elements (polyline, circle, rectangle, polygon, marker). GeoJSON geometry + style.
- `TileCache.js` -- Cached map/fire tile data (provider, cacheKey, binary data, content type, TTL)

### ReID Endpoints (reidRoutes.js)

```
GET    /api/reid/persons                     -- list persons (limit, offset, isActive)
GET    /api/reid/persons/search?q=           -- text search
GET    /api/reid/persons/cross-search?type=&value= -- cross-search by phone/username/telegramId
POST   /api/reid/persons/batch-phone-lookup  -- batch Sherlock phone lookups
POST   /api/reid/persons/search/photo        -- multipart image upload -> reid-worker identify
GET    /api/reid/persons/:id                 -- single person
PUT    /api/reid/persons/:id                 -- update person
DELETE /api/reid/persons/:id                 -- delete person
PUT    /api/reid/persons/:id/information     -- update person OSINT information (source + data)
POST   /api/reid/persons/:id/search-info     -- trigger OSINT search (sherlock/telelog) for person
GET    /api/reid/persons/:id/sightings       -- person sightings
GET    /api/reid/persons/:id/snapshots       -- snapshot sightings (photo URLs)
GET    /api/reid/persons/:id/similar         -- similar persons by embedding
GET    /api/reid/persons/:id/traits          -- person traits/embeddings
GET    /api/reid/persons/:id/image           -- best face image
GET    /api/reid/persons/:id/face3d          -- 3D face model
GET    /api/reid/persons/:id/cross-search    -- cross-search starting from this person's data
POST   /api/reid/search-phone                -- standalone phone lookup (creates person if new)
GET    /api/reid/sightings                   -- all sightings (limit, offset, date range)
POST   /api/reid/sightings                   -- create sighting
GET    /api/reid/cameras                     -- list cameras
GET    /api/reid/osint-photos/:filename      -- serve OSINT photo from reid-db-handler
GET    /api/reid/osint-reports/:filename     -- serve OSINT HTML report from reid-db-handler
```

### Tile Proxy (tileRoutes.js)

- `GET /api/tiles/map/:provider/:z/:x/:y` -- XYZ map tiles. Providers: `osm`, `google-satellite`, `google-terrain`. Cached in MongoDB indefinitely.
- `GET /api/tiles/fires/:provider` -- WMS fire tiles. Provider: `firms` (NASA FIRMS). Cached 4h. Bypasses local DNS block on `firms.modaps.eosdis.nasa.gov` via Google DoH.

## Scripts

Run from the backend root:

```bash
node scripts/test-telegram.js <mode> [target] [searchType]
# mode: telelog, sherlock, both (default: both)
# searchType (sherlock): username, phone, telegram_id, name

node scripts/test-telegram.js sherlock @Zothie username
node scripts/test-telegram.js sherlock 79125036666 phone
node scripts/test-telegram.js sherlock 323894501 telegram_id
node scripts/test-telegram.js sherlock "Name DOB" name

node scripts/debug-chat.js <@bot> <limit>  # read last N messages from a bot chat
node scripts/click-button.js <@bot> <msgId> <buttonText>  # click a button on existing msg
node scripts/test-sherlock-parser.js [@bot]  # parse all bot messages offline (no bot calls)
node scripts/test-sherlock-photo.js [path-to-photo]  # test Sherlock photo search
node scripts/test-bot-lookup.js  # test getBotUsername() via OAuth flow
node scripts/download-sherlock-photos.js [@bot] [messageCount]  # download photos from bot chat
node scripts/migrate-osint-to-db.js  # one-time migration of local OSINT files to reid-db-handler
```

`debug-chat.js` is the primary debugging tool. Use it to inspect raw message flow
before writing interaction logic (shows id, text, buttons, entities, reply_to, edited flag).

## Telegram Module

### services/telegramService.js

- MTProto user client (not bot API)
- Auth: QR code login on first run, session persisted to `.env`
- Test/prod mode via `TELEGRAM_TEST_MODE=true/false`
- Sessions: `TELEGRAM_SESSION` (prod), `TELEGRAM_SESSION_TEST` (test)
- Exports: `initialize()`, `sendToSavedMessages(text)`, `getClient()`
- Called on server startup in `mainServer.js`

### utils/botHelper.js

Core utility for bot interaction. Key behaviors:
- `sendAndLog(client, botUsername, text, tag, silenceMs)` -- sends a message, collects all replies until `silenceMs` of silence (default 3s), logs and returns them
- `clickButtonAndLog(client, botUsername, message, buttonText, tag, silenceMs)` -- clicks an inline button, same collection logic
- `sendPhotoAndLog(client, botUsername, photoBuffer, tag, silenceMs)` -- sends a photo, same collection logic
- Listens to BOTH `NewMessage` AND `UpdateEditMessage` -- bots often send "searching..." then **edit** it into results rather than sending a new message
- Edit detection uses `msg.out === false` (not peerId matching)
- Each reply entry includes: `text`, `message` (raw), `entities` (parsed from msg.entities), `buttons`, `edited` flag
- Silence window is configurable per call; default 3s, use longer (e.g. 120000) for slow searches
- Max timeout: 10 minutes

### utils/telegramOAuth.js

Automated Telegram OAuth Login Widget flow via pure HTTP + MTProto. Used by sherlockService to authenticate with the Sherlock website.
- `performOAuth(client, phone, botId, siteUrl, verifyUrl)` -- full OAuth flow: establish session -> send phone -> accept MTProto confirmation from user 777000 -> login -> get signed auth data
- Exports: `performOAuth`, `mergeCookies`, `UA`

### services/telelogService.js

- Scrapes bot username from `https://telelog.link/` (.cta-section .cta-button href)
- `interact(target)` sends `/start`, then the target username/id, waits 15s for edited reply
- Detects profile reply by entity pattern (TextUrl + Bold>=9 + Code + Mention)
- Parses response with `utils/telelogParser.js` and returns structured data
- Bot username cached in memory for 1h

### utils/telelogParser.js

- Language-agnostic parser for Telelog bot profile responses
- Bot uses heavy Unicode homoglyph obfuscation (Greek, Latin, Kazakh, Armenian mixed with Cyrillic)
- Uses entity-based extraction for core data (bold positions, Code, Mention, TextUrl)
- First 9 bold entities always = diversity, dateFrom, dateTo, msgCount, chatCount, replyPct, mediaPct, circles, voice
- `normalizeText(str)` detects dominant script (Latin vs Cyrillic) and normalizes accordingly
- `normalizeHomoglyphs(str)` always normalizes to Cyrillic (for label matching)
- Handles digit-3-as-Z contextually (only when followed by Cyrillic)
- Date normalization: US (M/DD/YYYY), EU (DD.MM.YYYY), ISO all -> DD.MM.YYYY

### services/sherlockService.js

- Gets bot username from `https://serlocbot.pro/` via Telegram OAuth flow (bot username rotates frequently). Flow: scrape verify.php for login widget bot ID -> perform OAuth via `telegramOAuth.js` -> submit auth to auth.php -> scrape go.php for bot link. Requires `TELEGRAM_PHONE` env var.
- `interact(target, searchType, options)` handles 5 search types:
  - `username`: sends @username directly -> disambiguation -> clicks "Telegram" -> telegram_result
  - `phone`: sends phone number directly -> phone_result (inline)
  - `telegram_id`: sends ID directly -> disambiguation -> clicks "Telegram" -> telegram_result
  - `name`: sends "Name DOB" directly -> country selection -> clicks country -> name_result
  - `photo`: sends photo via `sendPhotoAndLog` -> person cards with similarity % -> paginates "Show more" -> parses all results
- Auto-detects disambiguation and country selection steps, clicks appropriate buttons
- When result has `reportUrl` (phone and name searches), auto-fetches and parses the full HTML report via `fetchReport(url)` using `sherlockReportParser`, stores report in reid-db-handler as OSINT asset
- Pass `{ skipReport: true }` in options to skip report fetching
- Exports: `getBotUsername()`, `interact(target, searchType, options)`, `fetchReport(url)`
- Bot username cached in memory for 1h

### utils/sherlockParser.js

Entity-based parser for Sherlock bot responses. Handles 4 result formats:

**phone_result** (phone search): phone, operator, region, country, phonebook names, VK profile, bank info, Telegram username+ID, emails, interest count, report URL

**telegram_result** (username and ID searches): Telegram ID, phone, name history (date/username/name/id entries), derived usernames list, derived names list, interest count

**name_result** (name+DOB search): full name, date of birth, match count, interest count, report URL

**photo_result** (photo search): person cards with similarity percentages, parsed via `parsePhotoSearchResults(replies)`

Detection functions: `isPhoneSearchResult`, `isTelegramSearchResult`, `isNameSearchResult`, `isDisambiguationMessage`, `isCountrySelectionMessage`, `isHelpMessage`, `isPhotoSearchResult`, `isPhotoSimilarityMessage`

Main entry: `parseSherlockReply(reply)` returns `{ type, parsed, buttons? }`

**Aggregation keys** across search types: `telegramId`, `phone`, `usernames` - any overlap means same person.

### utils/sherlockReportParser.js

Parses full Sherlock HTML report pages (fetched from sherlock-report.at URLs). Uses cheerio.

`parseSherlockReport(html)` returns MongoDB-ready document with all-optional sections:
- `searchQuery` - from page title
- `summary` - passport, phone, cars, snils, inn, email, driverLicense (each: `[{value, probability?}]`)
- `relationships` - `[{fullName, dateOfBirth?, age?, sameSurname}]`
- `jobs`, `cars` - generic table rows
- `companies` - with nested aviato sub-detail fields
- `addresses` - `[{address, count?, percent?}]`
- `travel` - `{countries: [{country, count}], flights: [{date, from/toCountry/City, flightNumber, transport}]}`
- `sites` - string array
- `records` - `[{source, year?, fields: {label: value}}]` (hundreds of DB leak entries)
- `parsedAt` - timestamp

## Known Bot Behaviors

### Sherlock (bot username obtained via OAuth from serlocbot.pro, rotates frequently)

**Search flows by input type:**

1. **Phone number** (e.g. `79125036666`): Bot responds with rich inline report (edited message) containing phone info, contacts, social profiles, Telegram link, emails
2. **Username** (e.g. `@Zothie`): Bot shows "Detected login" with buttons [Instagram | Tiktok | Telegram]. Click "Telegram" -> edited message with ID, phone, name history
3. **Telegram ID** (e.g. `323894501`): Bot shows "Detected identifier" with buttons [Passport | VK | Telegram]. Same flow as username after clicking "Telegram"
4. **Name+DOB** (e.g. `Name Surname Patronymic DD.MM.YYYY`): Bot shows FIO breakdown with country buttons. Click country -> summary with match count + link to full report
5. **Photo**: Bot responds with person cards containing similarity percentages. Supports pagination via "Show more" button.

All results arrive as **edited messages** - bot sends placeholder then edits in data.

Always use `debug-chat.js` to inspect actual message history before changing interaction logic.

## Env Vars

```
PORT=3400
NODE_ENV=development
MONGO_URI=mongodb://localhost:27017/reid-analytics
JWT_SECRET=
JWT_EXPIRE=30d
CORS_ORIGIN=http://localhost:5173
TRAITS_API_URL=http://localhost:3001    # reid-db-handler API
TRAITS_API_KEY=                          # reid-db-handler API key
REID_WORKER_URL=http://localhost:5000    # reid-worker API (photo identification)
AUTO_SAVE_INTERVAL_LAYERS=300000         # layer auto-save interval (ms)
TELEGRAM_API_ID=                         # from my.telegram.org
TELEGRAM_API_HASH=                       # from my.telegram.org
TELEGRAM_PHONE=                          # for automated Telegram OAuth (Sherlock bot lookup)
TELEGRAM_TEST_MODE=false
TELEGRAM_SESSION=                        # auto-populated after first QR login (prod)
TELEGRAM_SESSION_TEST=                   # auto-populated after first QR login (test)
```
