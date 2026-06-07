const cheerio = require('cheerio');

// Label -> key mapping for summary section
const SUMMARY_LABEL_MAP = {
  'Паспорт': 'passport',
  'Телефон': 'phone',
  'Автомобили': 'cars',
  'СНИЛС': 'snils',
  'ИНН': 'inn',
  'Email': 'email',
  'Водительское удостоверение': 'driverLicense',
};

/**
 * Parses a Sherlock report HTML page into a flat MongoDB-ready document.
 * All fields are optional and missing sections are handled gracefully.
 *
 * @param {string} html - Full HTML string of the Sherlock report page
 * @returns {object} MongoDB-ready document
 */
function parseSherlockReport(html) {
  const $ = cheerio.load(html);

  const result = {
    searchQuery: parseSearchQuery($),
    summary: parseSummary($),
    relationships: parseRelationships($),
    jobs: parseJobs($),
    cars: parseCars($),
    companies: parseCompanies($),
    addresses: parseAddresses($),
    travel: parseTravel($),
    sites: parseSites($),
    records: parseRecords($),
    parsedAt: new Date(),
  };

  return result;
}

// ---------------------------------------------------------------------------
// Section parsers
// ---------------------------------------------------------------------------

function parseSearchQuery($) {
  const title = $('title').text().trim();
  // Title format: "Sherlock - Name DOB"
  const match = title.match(/Sherlock\s*[-\u2014\u2013]\s*(.+)/i);
  return match ? match[1].trim() : title || null;
}

function parseSummary($) {
  const summary = {};

  $('ul.report-summary > li').each((_, li) => {
    const $li = $(li);
    const label = $li.find('.report-card__label').text().trim();
    const key = SUMMARY_LABEL_MAP[label];
    if (!key) return; // unknown label, skip

    const values = [];
    $li.find('span.copyable').each((__, span) => {
      const $span = $(span);
      const value = ($span.attr('data-clipboard-text') || '').trim();
      if (!value) return;

      const smallText = $span.find('small').text().trim();
      const entry = { value };
      if (smallText) {
        const probMatch = smallText.match(/([\d.]+)%/);
        if (probMatch) {
          entry.probability = parseFloat(probMatch[1]);
        }
      }
      values.push(entry);
    });

    if (values.length > 0) {
      summary[key] = values;
    }
  });

  return Object.keys(summary).length > 0 ? summary : null;
}

function parseRelationships($) {
  const relationships = [];

  $('#relationship .relation-item').each((_, el) => {
    const $el = $(el);
    const clipboardText = ($el.attr('data-clipboard-text') || '').trim();
    const sameSurname = $el.hasClass('same-surname');

    // Parse "FullName DD.MM.YYYY" from clipboard text
    const dateMatch = clipboardText.match(/(\d{2}\.\d{2}\.\d{4})\s*$/);
    let fullName, dateOfBirth;
    if (dateMatch) {
      fullName = clipboardText.slice(0, dateMatch.index).trim();
      dateOfBirth = dateMatch[1];
    } else {
      fullName = clipboardText;
    }

    // Extract age from relation-right
    const ageText = $el.find('.relation-right').text().trim();
    const ageMatch = ageText.match(/(\d+)/);
    const age = ageMatch ? parseInt(ageMatch[1], 10) : undefined;

    const entry = { fullName, sameSurname };
    if (dateOfBirth) entry.dateOfBirth = dateOfBirth;
    if (age !== undefined) entry.age = age;
    relationships.push(entry);
  });

  return relationships.length > 0 ? relationships : null;
}

function parseJobs($) {
  return parseTableSection($, '#jobs');
}

function parseCars($) {
  return parseTableSection($, '#cars');
}

function parseCompanies($) {
  const rows = [];
  const $section = $('#legals');
  if (!$section.length) return null;

  $section.find('table').each((_, table) => {
    const $table = $(table);
    const headers = [];
    $table.find('thead th').each((__, th) => {
      headers.push($(th).text().trim());
    });

    $table.find('tbody tr').each((__, tr) => {
      const row = {};
      $(tr).find('td').each((i, td) => {
        const $td = $(td);
        const headerKey = headers[i] || $td.attr('data-title') || `col${i}`;
        // Companies have nested .aviato spans with <small> sub-info
        const $aviato = $td.find('.aviato');
        if ($aviato.length) {
          const mainText = $aviato.find('> span').text().trim();
          const subText = $aviato.find('small').text().trim();
          row[headerKey] = mainText;
          if (subText) {
            row[headerKey + '_detail'] = subText;
          }
        } else {
          row[headerKey] = extractCellText($, $td);
        }
      });
      if (Object.values(row).some(v => v)) {
        rows.push(row);
      }
    });
  });

  return rows.length > 0 ? rows : null;
}

function parseAddresses($) {
  const addresses = [];
  const $section = $('#adresses');
  if (!$section.length) return null;

  $section.find('tbody tr').each((_, tr) => {
    const $tr = $(tr);
    const $addressTd = $tr.find('td.address-line');
    const address = ($addressTd.attr('data-clipboard-text') || $addressTd.text()).trim();
    const tds = $tr.find('td');
    const count = tds.eq(1).length ? parseInt(tds.eq(1).text().trim(), 10) : undefined;
    const percentText = tds.eq(2).length ? tds.eq(2).text().trim() : undefined;
    const percent = percentText ? parseFloat(percentText) : undefined;

    const entry = { address };
    if (!isNaN(count)) entry.count = count;
    if (!isNaN(percent)) entry.percent = percent;
    addresses.push(entry);
  });

  return addresses.length > 0 ? addresses : null;
}

function parseTravel($) {
  const $section = $('#kardon');
  if (!$section.length) return null;

  const travel = {
    countries: [],
    flights: [],
  };

  // Parse country summary from getcontacts spans
  $section.find('.getcontacts span').each((_, span) => {
    const text = $(span).text().trim();
    if (!text) return;
    // Format: "flag Country xN" or "flag Country" (count=1 implied)
    // Strip leading emoji flags and other non-letter non-digit chars
    const cleaned = text.replace(/^[^\p{L}\p{N}]+/u, '').trim();
    const countMatch = cleaned.match(/^(.+?)\s+x(\d+)$/);
    if (countMatch) {
      travel.countries.push({ country: countMatch[1].trim(), count: parseInt(countMatch[2], 10) });
    } else if (cleaned) {
      travel.countries.push({ country: cleaned, count: 1 });
    }
  });

  // Parse flights table
  $section.find('tr.flight-item').each((_, tr) => {
    const tds = $(tr).find('td');
    const date = tds.eq(0).text().trim() || undefined;

    const fromCountry = tds.eq(1).find('.aviato > span').text().trim() || undefined;
    const fromCity = tds.eq(1).find('.aviato small').text().trim() || undefined;

    const toCountry = tds.eq(2).find('.aviato > span').text().trim() || undefined;
    const toCity = tds.eq(2).find('.aviato small').text().trim() || undefined;

    const flightNumber = tds.eq(3).find('.aviato > span').text().trim() || undefined;
    const transport = tds.eq(3).find('.aviato small').text().trim() || undefined;

    const flight = {};
    if (date) flight.date = date;
    if (fromCountry) flight.fromCountry = fromCountry;
    if (fromCity) flight.fromCity = fromCity;
    if (toCountry) flight.toCountry = toCountry;
    if (toCity) flight.toCity = toCity;
    if (flightNumber) flight.flightNumber = flightNumber;
    if (transport) flight.transport = transport;
    travel.flights.push(flight);
  });

  const hasData = travel.countries.length > 0 || travel.flights.length > 0;
  return hasData ? travel : null;
}

function parseSites($) {
  const sites = [];
  $('#sites .getcontacts span').each((_, span) => {
    const text = $(span).text().trim();
    if (text) sites.push(text);
  });
  return sites.length > 0 ? sites : null;
}

function parseRecords($) {
  const records = [];

  // Items are in <div id="itemN"> containers, each containing one or more <section class="report-card">
  $('div[id^="item"]').each((_, itemDiv) => {
    const $item = $(itemDiv);
    $item.find('section.report-card').each((__, section) => {
      const $section = $(section);
      const $title = $section.find('h3.report-card__title');
      if (!$title.length) return;

      // Extract source name and year from title
      const yearText = $title.find('small').text().trim();
      const year = yearText ? parseInt(yearText, 10) : undefined;

      // Source name = title text minus the small tag content
      $title.find('small').remove();
      const source = $title.text().trim();

      // Extract fields from dl.report-details
      const fields = {};
      $section.find('dl.report-details').each((___, dl) => {
        const dts = $(dl).find('dt');
        dts.each((____, dt) => {
          const $dt = $(dt);
          const label = $dt.text().trim();
          const $dd = $dt.next('dd');
          if ($dd.length) {
            const value = ($dd.attr('data-clipboard-text') || $dd.text()).trim();
            if (label && value) {
              fields[label] = value;
            }
          }
        });
      });

      const entry = { source };
      if (!isNaN(year)) entry.year = year;
      if (Object.keys(fields).length > 0) entry.fields = fields;
      records.push(entry);
    });
  });

  return records.length > 0 ? records : null;
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/**
 * Generic table parser for sections that have a standard table (jobs, cars).
 */
function parseTableSection($, sectionSelector) {
  const rows = [];
  const $section = $(sectionSelector);
  if (!$section.length) return null;

  $section.find('table').each((_, table) => {
    const $table = $(table);
    const headers = [];
    $table.find('thead th').each((__, th) => {
      headers.push($(th).text().trim());
    });

    $table.find('tbody tr').each((__, tr) => {
      const row = {};
      $(tr).find('td').each((i, td) => {
        const $td = $(td);
        const headerKey = headers[i] || $td.attr('data-title') || `col${i}`;
        row[headerKey] = extractCellText($, $td);
      });
      if (Object.values(row).some(v => v)) {
        rows.push(row);
      }
    });
  });

  return rows.length > 0 ? rows : null;
}

/**
 * Extracts text value from a table cell, preferring data-clipboard-text, then span text, then raw text.
 */
function extractCellText($, $td) {
  const clipboard = $td.attr('data-clipboard-text');
  if (clipboard && clipboard.trim()) return clipboard.trim();

  const $span = $td.find('span');
  if ($span.length) return $span.text().trim();

  return $td.text().trim();
}

module.exports = { parseSherlockReport };

// ---------------------------------------------------------------------------
// Quick self-test when run directly
// ---------------------------------------------------------------------------
if (require.main === module) {
  const fs = require('fs');
  const path = '/tmp/sherlock-report.html';

  if (!fs.existsSync(path)) {
    console.log('Test file not found at ' + path);
    process.exit(1);
  }

  console.log('Loading ' + path + ' ...');
  const html = fs.readFileSync(path, 'utf-8');
  console.log('HTML size: ' + (html.length / 1024).toFixed(1) + ' KB, ' + html.split('\n').length + ' lines');

  const result = parseSherlockReport(html);

  console.log('\n=== Parsed Report Stats ===');
  console.log('searchQuery:', result.searchQuery);

  if (result.summary) {
    console.log('\nsummary:');
    for (const [key, arr] of Object.entries(result.summary)) {
      console.log('  ' + key + ': ' + arr.length + ' values');
    }
  } else {
    console.log('summary: (none)');
  }

  console.log('relationships:', result.relationships ? result.relationships.length + ' items' : '(none)');
  console.log('jobs:', result.jobs ? result.jobs.length + ' items' : '(none)');
  console.log('cars:', result.cars ? result.cars.length + ' items' : '(none)');
  console.log('companies:', result.companies ? result.companies.length + ' items' : '(none)');
  console.log('addresses:', result.addresses ? result.addresses.length + ' items' : '(none)');

  if (result.travel) {
    console.log('travel.countries:', result.travel.countries.length + ' countries');
    console.log('travel.flights:', result.travel.flights.length + ' flights');
  } else {
    console.log('travel: (none)');
  }

  console.log('sites:', result.sites ? result.sites.length + ' items' : '(none)');
  console.log('records:', result.records ? result.records.length + ' items' : '(none)');

  // Print first record as sample
  if (result.records && result.records.length > 0) {
    console.log('\n--- Sample record (first) ---');
    console.log(JSON.stringify(result.records[0], null, 2));
  }

  // Print first relationship as sample
  if (result.relationships && result.relationships.length > 0) {
    console.log('\n--- Sample relationship (first) ---');
    console.log(JSON.stringify(result.relationships[0], null, 2));
  }

  // Print first flight as sample
  if (result.travel && result.travel.flights.length > 0) {
    console.log('\n--- Sample flight (first) ---');
    console.log(JSON.stringify(result.travel.flights[0], null, 2));
  }

  // Print first address as sample
  if (result.addresses && result.addresses.length > 0) {
    console.log('\n--- Sample address (first) ---');
    console.log(JSON.stringify(result.addresses[0], null, 2));
  }

  // Print first company as sample
  if (result.companies && result.companies.length > 0) {
    console.log('\n--- Sample company (first) ---');
    console.log(JSON.stringify(result.companies[0], null, 2));
  }

  console.log('\nparsedAt:', result.parsedAt.toISOString());
}
