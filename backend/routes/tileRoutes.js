const express = require('express');
const axios = require('axios');
const crypto = require('crypto');
const https = require('https');
const tls = require('tls');
const TileCache = require('../models/TileCache');

const router = express.Router();

// System DNS blocks firms.modaps.eosdis.nasa.gov (returns 0.0.0.0).
// Resolve the real IP via Google DoH over HTTPS to bypass it.
const FIRMS_HOST = 'firms.modaps.eosdis.nasa.gov';
let firmsIpCache = null;
let firmsIpExpiry = 0;

async function resolveFirmsIp() {
  if (firmsIpCache && Date.now() < firmsIpExpiry) return firmsIpCache;
  const resp = await axios.get('https://8.8.8.8/resolve', {
    params: { name: FIRMS_HOST, type: 'A' },
    headers: { Accept: 'application/dns-json' },
    timeout: 5000,
  });
  const record = resp.data?.Answer?.find(r => r.type === 1);
  if (!record?.data) throw new Error(`DoH returned no A record for ${FIRMS_HOST}`);
  firmsIpCache = record.data;
  firmsIpExpiry = Date.now() + 3_600_000;
  return firmsIpCache;
}

// Strip Helmet headers that block cross-origin image loading
// (frontend on :5400 loads these as <img> from :3400)
router.use((req, res, next) => {
  res.removeHeader('Content-Security-Policy');
  res.removeHeader('Cross-Origin-Opener-Policy');
  res.removeHeader('Origin-Agent-Cluster');
  res.set('Cross-Origin-Resource-Policy', 'cross-origin');
  next();
});

const UPSTREAM_MAP_URLS = {
  'osm': (z, x, y) => `https://tile.openstreetmap.org/${z}/${x}/${y}.png`,
  'google-satellite': (z, x, y) => `https://mt0.google.com/vt/lyrs=s,h&x=${x}&y=${y}&z=${z}`,
  'google-terrain': (z, x, y) => `https://mt0.google.com/vt/lyrs=p&x=${x}&y=${y}&z=${z}`,
};

const UPSTREAM_FIRE_URLS = {
  'firms': 'https://firms.modaps.eosdis.nasa.gov/mapserver/wms/fires/4dd8376751ea9bf9e2ff17c786943fcd',
};

// XYZ map tiles: GET /api/tiles/map/:provider/:z/:x/:y
router.get('/map/:provider/:z/:x/:y', async (req, res) => {
  const { provider, z, x, y } = req.params;

  if (!UPSTREAM_MAP_URLS[provider]) {
    return res.status(400).json({ error: `Unknown provider: ${provider}` });
  }

  const cacheKey = `${z}/${x}/${y}`;

  try {
    const cached = await TileCache.findOne({ provider, cacheKey }).lean();
    if (cached) {
      res.set('Content-Type', cached.contentType);
      res.set('Cache-Control', 'public, max-age=86400');
      res.set('X-Cache', 'HIT');
      return res.send(cached.data);
    }

    const upstreamUrl = UPSTREAM_MAP_URLS[provider](z, x, y);
    const response = await axios.get(upstreamUrl, {
      responseType: 'arraybuffer',
      timeout: 15000,
      headers: {
        'User-Agent': 'FireFighters/1.0',
      },
    });

    const contentType = response.headers['content-type'] || 'image/png';

    TileCache.create({
      provider,
      cacheKey,
      data: Buffer.from(response.data),
      contentType,
    }).catch(err => {
      if (err.code !== 11000) {
        console.error('Failed to cache tile:', err.message);
      }
    });

    res.set('Content-Type', contentType);
    res.set('Cache-Control', 'public, max-age=86400');
    res.set('X-Cache', 'MISS');
    return res.send(Buffer.from(response.data));
  } catch (err) {
    console.error(`Tile fetch error [${provider}/${cacheKey}]:`, err.message);
    return res.status(502).json({ error: 'Failed to fetch tile' });
  }
});

const FIRE_CACHE_TTL_MS = 4 * 60 * 60 * 1000; // 4 hours
const FIRE_CACHE_MAX_AGE = 14400; // 4 hours in seconds

// WMS fire tiles: GET /api/tiles/fires/:provider
router.get('/fires/:provider', async (req, res) => {
  const { provider } = req.params;

  if (!UPSTREAM_FIRE_URLS[provider]) {
    return res.status(400).json({ error: `Unknown fire provider: ${provider}` });
  }

  const queryString = Object.keys(req.query)
    .sort()
    .map(k => `${k}=${req.query[k]}`)
    .join('&');

  const cacheKey = crypto.createHash('sha256').update(queryString).digest('hex');
  const cacheMinAge = new Date(Date.now() - FIRE_CACHE_TTL_MS);

  try {
    const cached = await TileCache.findOne({
      provider,
      cacheKey,
      createdAt: { $gte: cacheMinAge },
    }).lean();
    if (cached) {
      res.set('Content-Type', cached.contentType);
      res.set('Cache-Control', `public, max-age=${FIRE_CACHE_MAX_AGE}`);
      res.set('X-Cache', 'HIT');
      return res.send(cached.data);
    }

    const firmsIp = await resolveFirmsIp();
    const upstreamUrl = UPSTREAM_FIRE_URLS[provider].replace(FIRMS_HOST, firmsIp);
    const agent = new https.Agent({
      servername: FIRMS_HOST,
      checkServerIdentity: (_h, cert) => tls.checkServerIdentity(FIRMS_HOST, cert),
    });
    const response = await axios.get(upstreamUrl, {
      params: req.query,
      responseType: 'arraybuffer',
      timeout: 30000,
      httpsAgent: agent,
      headers: {
        Host: FIRMS_HOST,
        'User-Agent': 'FireFighters/1.0',
      },
    });

    const contentType = response.headers['content-type'] || 'image/png';

    TileCache.findOneAndUpdate(
      { provider, cacheKey },
      { data: Buffer.from(response.data), contentType, createdAt: new Date() },
      { upsert: true },
    ).catch(err => {
      console.error('Failed to cache fire tile:', err.message);
    });

    res.set('Content-Type', contentType);
    res.set('Cache-Control', `public, max-age=${FIRE_CACHE_MAX_AGE}`);
    res.set('X-Cache', 'MISS');
    return res.send(Buffer.from(response.data));
  } catch (err) {
    console.error(`Fire tile fetch error [${provider}]:`, err.message);
    return res.status(502).json({ error: 'Failed to fetch fire tile' });
  }
});

module.exports = router;
