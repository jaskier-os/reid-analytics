const fs   = require('fs');
const path = require('path');
const axios = require('axios');
const xml2js = require('xml2js');

const WMS_URL = 'https://firms.modaps.eosdis.nasa.gov/mapserver/wms/fires/4dd8376751ea9bf9e2ff17c786943fcd?request=GetCapabilities';

/**
 * Recursively collect sub‑layers under the main FIRMS layer
 */
function collectFirmsLayers(layers, isRoot = true) {
  let results = [];

  for (const layer of layers) {
    const name  = layer.Name  && layer.Name[0];
    const title = layer.Title && layer.Title[0];
    const abs   = layer.Abstract && layer.Abstract[0];

    if (isRoot) {
      // only descend into children
      if (layer.Layer) {
        results.push(...collectFirmsLayers(layer.Layer, false));
      }
    } else {
      // this is a FIRMS sub-layer
      if (name && title) {
        results.push({ name, title, abstract: abs || '' });
      }
      // in case of deeper nesting
      if (layer.Layer) {
        results.push(...collectFirmsLayers(layer.Layer, false));
      }
    }
  }

  return results;
}

async function run() {
  try {
    console.log(`Fetching GetCapabilities from ${WMS_URL}...`);
    const response = await axios.get(WMS_URL, { responseType: 'text' });
    const xml = response.data;

    const parserOpts = { explicitArray: true };
    const parsed = await xml2js.parseStringPromise(xml, parserOpts);

    // navigate to Capability → Layer (root)
    const caps      = parsed.WMT_MS_Capabilities;
    const topLayers = caps.Capability[0].Layer[0].Layer
      ? caps.Capability[0].Layer
      : caps.Capability[0].Layer;

    // collect FIRMS layers
    const firmsLayers = collectFirmsLayers(topLayers);

    // format output
    const lines = firmsLayers.map(l =>
      `${l.name} | ${l.title}${l.abstract ? ' | ' + l.abstract : ''}`
    );

    const outPath = path.resolve(__dirname, 'firms_layers.txt');
    fs.writeFileSync(outPath, lines.join('\n'), 'utf8');

    console.log(`✔ Extracted ${firmsLayers.length} FIRMS layers to ${outPath}`);
  } catch (err) {
    console.error('Error:', err.message);
    process.exit(1);
  }
}

run();
