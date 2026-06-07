const asyncHandler = require('express-async-handler');
const axios = require('axios');
const reidService = require('../services/reidService');
const sherlockService = require('../services/sherlockService');
const telelogService = require('../services/telelogService');
const vkSearchService = require('../services/vkSearchService');
const socketService = require('../services/socketService');

function extractBestName(person) {
  let osintName = null;
  const info = person.information_found;
  if (info && typeof info === 'object') {
    for (const source of Object.values(info)) {
      if (!source || typeof source !== 'object') continue;
      if (source.names && source.names.length > 0) {
        osintName = source.names[0];
        break;
      }
      if (source.fullName) {
        osintName = source.fullName;
        break;
      }
      if (source.persons && Array.isArray(source.persons)) {
        for (const p of source.persons) {
          if (p.fullName) { osintName = p.fullName; break; }
          if (p.firstName) { osintName = p.firstName; break; }
        }
        if (osintName) break;
      }
    }
  }
  return osintName || person.display_name || null;
}

const getPersons = asyncHandler(async (req, res) => {
  const limit = parseInt(req.query.limit) || 20;
  const offset = parseInt(req.query.offset) || 0;
  const isActive = req.query.is_active !== undefined ? req.query.is_active : undefined;

  const data = await reidService.getPersons(limit, offset, isActive);
  if (data.persons) {
    for (const person of data.persons) {
      person.display_name = extractBestName(person);
    }
  }
  res.json(data);
});

const getPerson = asyncHandler(async (req, res) => {
  const { id } = req.params;
  const data = await reidService.getPerson(id);
  if (data) {
    data.display_name = extractBestName(data);
  }
  res.json(data);
});

const getPersonSightings = asyncHandler(async (req, res) => {
  const { id } = req.params;
  const limit = parseInt(req.query.limit) || 50;
  const offset = parseInt(req.query.offset) || 0;

  const data = await reidService.getPersonSightings(id, limit, offset);
  res.json(data);
});

const getSimilarPersons = asyncHandler(async (req, res) => {
  const { id } = req.params;
  const threshold = parseFloat(req.query.threshold) || 0.7;
  const limit = parseInt(req.query.limit) || 10;

  const data = await reidService.getSimilarPersons(id, threshold, limit);
  res.json(data);
});

const getAllSightings = asyncHandler(async (req, res) => {
  const limit = parseInt(req.query.limit) || 100;
  const offset = parseInt(req.query.offset) || 0;
  const startDate = req.query.startDate || null;
  const endDate = req.query.endDate || null;

  const data = await reidService.getAllSightings(limit, offset, startDate, endDate);
  res.json(data);
});

const getPersonTraits = asyncHandler(async (req, res) => {
  const { id } = req.params;
  const data = await reidService.getPersonTraits(id);
  res.json(data);
});

const searchPersons = asyncHandler(async (req, res) => {
  const query = req.query.q || '';
  const data = await reidService.searchPersons(query);
  if (data.persons) {
    for (const person of data.persons) {
      person.display_name = extractBestName(person);
    }
  }
  res.json(data);
});

const getCameras = asyncHandler(async (req, res) => {
  const data = await reidService.getCameras();
  res.json(data);
});

const getOsintReport = asyncHandler(async (req, res) => {
  const { filename } = req.params;
  const asset = await reidService.getOsintAsset(filename);
  res.set('Cross-Origin-Resource-Policy', 'cross-origin');
  res.set('Access-Control-Allow-Origin', '*');
  res.set('Content-Type', 'text/html; charset=utf-8');
  res.send(asset.data);
});

const getOsintPhoto = asyncHandler(async (req, res) => {
  const { filename } = req.params;
  const asset = await reidService.getOsintAsset(filename);
  res.set('Cross-Origin-Resource-Policy', 'cross-origin');
  res.set('Access-Control-Allow-Origin', '*');
  res.set('Content-Type', asset.content_type);
  res.set('Cache-Control', 'public, max-age=86400');
  res.send(asset.data);
});

const getPersonImage = asyncHandler(async (req, res) => {
  const { id } = req.params;
  const imageBuffer = await reidService.getPersonImage(id);

  // Set CORS headers
  res.set('Cross-Origin-Resource-Policy', 'cross-origin');
  res.set('Access-Control-Allow-Origin', '*');
  res.set('Content-Type', 'image/jpeg');
  res.send(imageBuffer);
});

const getPersonFace3D = asyncHandler(async (req, res) => {
  const { id } = req.params;
  const modelBuffer = await reidService.getPersonFace3D(id);

  res.set('Cross-Origin-Resource-Policy', 'cross-origin');
  res.set('Access-Control-Allow-Origin', '*');
  res.set('Content-Type', 'model/gltf-binary');
  res.send(modelBuffer);
});

const searchByPhoto = asyncHandler(async (req, res) => {
  if (!req.file) {
    res.status(400);
    throw new Error('No image file provided');
  }

  const threshold = parseFloat(req.body.threshold) || 0.7;
  const limit = parseInt(req.body.limit) || 10;

  console.log('[reidController] REID_PROXY_REQ searchByPhoto threshold=' + threshold + ' limit=' + limit + ' imgSize=' + req.file.size);

  let data;
  try {
    data = await reidService.searchByPhoto(req.file.buffer, threshold, limit);
  } catch (err) {
    console.error(`[searchByPhoto] failed: ${err.message}`);
    return res.status(503).json({ success: false, error: err.message });
  }
  console.log('[reidController] REID_PROXY_RESP searchByPhoto personCount=' + (data?.persons?.length || 0));
  res.json(data);
});

const updatePerson = asyncHandler(async (req, res) => {
  const { id } = req.params;
  const data = await reidService.updatePerson(id, req.body);
  socketService.emitToRoom(`person-${id}`, 'person-updated', { person: data });
  socketService.emitToAll('person-updated', { person: data });
  res.json(data);
});

const deletePerson = asyncHandler(async (req, res) => {
  const { id } = req.params;
  await reidService.deletePerson(id);
  socketService.emitToAll('person-deleted', { personId: id });
  res.status(204).send();
});

const getPersonSnapshotSightings = asyncHandler(async (req, res) => {
  const { id } = req.params;
  const data = await reidService.getPersonSnapshotSightings(id);
  res.json(data);
});

const updatePersonInformation = asyncHandler(async (req, res) => {
  const { id } = req.params;
  const { source, data } = req.body;

  if (!source || !data) {
    res.status(400);
    throw new Error('Both "source" and "data" are required');
  }

  const result = await reidService.updatePersonInformation(id, source, data);
  socketService.emitToRoom(`person-${id}`, 'person-updated', { person: result });
  socketService.emitToAll('person-updated', { person: result });
  res.json(result);
});

const crossSearchPersons = asyncHandler(async (req, res) => {
  const { type, value } = req.query;
  const data = await reidService.crossSearchPersons(type, value);
  res.json(data);
});

const crossSearchByPerson = asyncHandler(async (req, res) => {
  const { id } = req.params;
  const data = await reidService.crossSearchByPerson(id);
  res.json(data);
});

const searchPersonInfo = asyncHandler(async (req, res) => {
  const { id } = req.params;
  const { searchType, query, service = 'sherlock', options = {} } = req.body;

  if (!searchType && service === 'sherlock') {
    res.status(400);
    throw new Error('"searchType" is required for sherlock');
  }

  if (!query && service === 'telelog') {
    res.status(400);
    throw new Error('"query" is required for telelog');
  }

  if (service === 'telelog') {
    let parsed;
    try {
      parsed = await telelogService.interact(query);
    } catch (err) {
      console.error(`[Telelog] interact failed: ${err.message}`);
      return res.status(503).json({ success: false, error: err.message });
    }

    if (parsed) {
      await reidService.updatePersonInformation(id, 'telelog', parsed);
    }

    return res.json({
      success: !!parsed,
      type: parsed ? 'telelog_result' : 'telelog_no_result',
      source: 'telelog',
      data: parsed
    });
  }

  // search4faces VK photo search flow
  if (service === 'search4faces') {
    let photoBuffer;
    if (options.snapshotUrl) {
      const imgResp = await axios.get(options.snapshotUrl, { responseType: 'arraybuffer' });
      photoBuffer = Buffer.from(imgResp.data);
    } else {
      const imageData = await reidService.getPersonImage(id);
      photoBuffer = Buffer.from(imageData);
    }

    let result;
    try {
      result = await vkSearchService.search(photoBuffer, {
        maxResults: options.maxResults || 50,
      });
    } catch (err) {
      console.error(`[VkSearch] search failed: ${err.message}`);
      return res.status(503).json({ success: false, error: err.message });
    }

    if (result.persons && result.persons.length > 0) {
      try {
        await reidService.updatePersonInformation(id, 'search4faces_vk', result);
        console.log(`[VkSearch] Saved ${result.persons.length} results for person ${id}`);
      } catch (saveErr) {
        console.error(`[VkSearch] Failed to save results for person ${id}: ${saveErr.message}`);
      }
    }

    return res.json({
      success: result.persons && result.persons.length > 0,
      type: result.persons?.length > 0 ? 'vk_photo_result' : 'vk_photo_no_result',
      source: 'search4faces_vk',
      data: result
    });
  }

  // Sherlock flow
  let searchQuery = query;
  const searchOptions = { ...options };

  // For photo search, fetch the specified snapshot or fall back to person's best photo
  if (searchType === 'photo') {
    if (options.snapshotUrl) {
      const imgResp = await axios.get(options.snapshotUrl, { responseType: 'arraybuffer' });
      searchOptions.photoBuffer = Buffer.from(imgResp.data);
    } else {
      const imageData = await reidService.getPersonImage(id);
      searchOptions.photoBuffer = Buffer.from(imageData);
    }
    searchQuery = searchQuery || id;
  }

  if (!searchQuery && searchType !== 'photo') {
    res.status(400);
    throw new Error('"query" is required for non-photo searches');
  }

  let result;
  try {
    result = await sherlockService.interact(searchQuery, searchType, searchOptions);
  } catch (err) {
    console.error(`[Sherlock] interact failed: ${err.message}`);
    return res.status(503).json({ success: false, error: err.message });
  }

  const source = `sherlock_${searchType}`;

  // If we got parsed data, store it on the person
  if (result.parsed) {
    await reidService.updatePersonInformation(id, source, result.parsed);
  }

  res.json({
    success: !!result.parsed,
    type: result.type,
    source,
    data: result.parsed
  });
});

const searchPhone = asyncHandler(async (req, res) => {
  const { phone } = req.body;
  if (!phone) {
    res.status(400);
    throw new Error('"phone" is required');
  }

  // Cross-search for existing person with this phone
  let personId;
  const crossSearchResult = await reidService.crossSearchPersons('phone', phone);

  if (crossSearchResult && crossSearchResult.length > 0) {
    personId = crossSearchResult[0].id;
  } else {
    // Create new person
    const newPerson = await reidService.createPerson({
      display_name: phone,
      information_found: {
        phone: [{ value: phone, source: 'call_log' }]
      }
    });
    personId = newPerson.id;
  }

  // Query sherlock - no retry, 503 on any failure
  let result;
  try {
    result = await sherlockService.interact(phone, 'phone', {});
  } catch (err) {
    console.error(`[Sherlock] interact failed: ${err.message}`);
    return res.status(503).json({ success: false, error: err.message });
  }

  // Store results if we got parsed data
  if (result.parsed) {
    await reidService.updatePersonInformation(personId, 'sherlock_phone', result.parsed);
  }

  res.json({
    success: !!result.parsed,
    personId,
    data: result.parsed
  });
});

const batchPhoneLookup = asyncHandler(async (req, res) => {
  const { phones } = req.body;
  if (!phones || !Array.isArray(phones)) {
    res.status(400);
    throw new Error('"phones" array is required');
  }
  if (phones.length > 200) {
    res.status(400);
    throw new Error('Maximum 200 phones per batch');
  }

  const results = {};
  await Promise.all(phones.map(async (phone) => {
    try {
      const matches = await reidService.crossSearchPersons('phone', phone);
      if (matches && matches.length > 0) {
        results[phone] = {
          personId: matches[0].id,
          displayName: matches[0].display_name || matches[0].id.substring(0, 8)
        };
      }
    } catch (err) {
      // Skip failed lookups silently
    }
  }));

  res.json({ results });
});

const createSighting = asyncHandler(async (req, res) => {
  const { person_id, camera_id, confidence_score, detected_at } = req.body;
  if (!person_id || !camera_id) {
    return res.status(400).json({ error: 'person_id and camera_id are required' });
  }
  if (confidence_score == null || detected_at == null) {
    return res.status(400).json({ error: 'confidence_score and detected_at are required' });
  }
  const data = await reidService.createSighting(req.body);
  res.status(201).json(data);
});

module.exports = {
  getPersons,
  getPerson,
  getPersonSightings,
  getPersonSnapshotSightings,
  getSimilarPersons,
  getAllSightings,
  getPersonTraits,
  searchPersons,
  getCameras,
  getPersonImage,
  getPersonFace3D,
  searchByPhoto,
  updatePerson,
  deletePerson,
  updatePersonInformation,
  crossSearchPersons,
  crossSearchByPerson,
  searchPersonInfo,
  searchPhone,
  batchPhoneLookup,
  createSighting,
  getOsintPhoto,
  getOsintReport
};
