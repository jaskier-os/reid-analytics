import L from 'leaflet';

/**
 * Convert a GeoJSON object to a Leaflet layer
 * @param {object} geoJSON - The GeoJSON object
 * @param {object} style - Style options for the layer
 * @returns {object} - Leaflet layer
 */
export const geoJSONToLayer = (geoJSON, style = {}) => {
  return L.geoJSON(geoJSON, {
    style: () => style
  });
};

/**
 * Convert a Leaflet layer to GeoJSON
 * @param {object} layer - The Leaflet layer
 * @returns {object} - GeoJSON object
 */
export const layerToGeoJSON = (layer) => {
  return layer.toGeoJSON();
};

/**
 * Get the bounds of a set of GeoJSON features
 * @param {Array} features - Array of GeoJSON features
 * @returns {object} - Leaflet bounds object
 */
export const getGeoJSONBounds = (features) => {
  if (!features || features.length === 0) {
    return null;
  }
  
  const tempLayer = L.geoJSON(features);
  return tempLayer.getBounds();
};

/**
 * Create a styled layer for a drawing
 * @param {string} type - The type of drawing
 * @param {object} geoJSON - The GeoJSON representation
 * @param {object} style - Style options
 * @returns {object} - Leaflet layer
 */
export const createDrawingLayer = (type, geoJSON, style) => {
  let layer;
  
  switch (type) {
    case 'marker':
      const { coordinates } = geoJSON.geometry;
      layer = L.marker([coordinates[1], coordinates[0]]);
      break;
      
    case 'circle':
      // GeoJSON doesn't have circle, so we need to extract from properties
      if (geoJSON.properties && geoJSON.properties.radius) {
        const center = geoJSON.geometry.coordinates;
        layer = L.circle([center[1], center[0]], {
          radius: geoJSON.properties.radius,
          ...style
        });
      }
      break;
      
    case 'rectangle':
    case 'polygon':
    case 'polyline':
    default:
      layer = geoJSONToLayer(geoJSON, style);
      break;
  }
  
  return layer;
};

/**
 * Calculate the area of a polygon in square meters
 * @param {object} polygon - Leaflet polygon
 * @returns {number} - Area in square meters
 */
export const calculateArea = (polygon) => {
  return L.GeometryUtil.geodesicArea(polygon.getLatLngs()[0]);
};

/**
 * Calculate the length of a polyline in meters
 * @param {object} polyline - Leaflet polyline
 * @returns {number} - Length in meters
 */
export const calculateLength = (polyline) => {
  const latLngs = polyline.getLatLngs();
  let totalLength = 0;
  
  for (let i = 1; i < latLngs.length; i++) {
    totalLength += latLngs[i-1].distanceTo(latLngs[i]);
  }
  
  return totalLength;
};

/**
 * Group layers by type
 * @param {Array} layers - Array of layer objects
 * @returns {object} - Object with layers grouped by type
 */
export const groupLayersByType = (layers) => {
  return layers.reduce((grouped, layer) => {
    const { type } = layer;
    
    if (!grouped[type]) {
      grouped[type] = [];
    }
    
    grouped[type].push(layer);
    return grouped;
  }, {});
};

/**
 * Get a color from a predefined palette by index
 * @param {number} index - The index in the palette
 * @returns {string} - Hex color code
 */
export const getColorFromPalette = (index) => {
  const palette = [
    '#1976D2', // Blue
    '#D32F2F', // Red
    '#388E3C', // Green
    '#FFA000', // Amber
    '#7B1FA2', // Purple
    '#C2185B', // Pink
    '#0097A7', // Cyan
    '#F57C00', // Orange
    '#512DA8', // Deep Purple
    '#00796B', // Teal
  ];
  
  return palette[index % palette.length];
};

/**
 * Create an image overlay on the map
 * @param {string} imageUrl - The image URL
 * @param {Array} bounds - Bounds in format [[lat1, lng1], [lat2, lng2]]
 * @returns {object} - Leaflet image overlay
 */
export const createImageOverlay = (imageUrl, bounds) => {
  return L.imageOverlay(imageUrl, [
    [bounds[0][0], bounds[0][1]],
    [bounds[1][0], bounds[1][1]]
  ]);
};

/**
 * Parse a KML file and return GeoJSON
 * @param {string} kmlString - KML file contents as string
 * @returns {object} - GeoJSON object
 */
export const parseKML = (kmlString) => {
  // In a real implementation, you would use a library like togeojson
  // This is a placeholder implementation
  const parser = new DOMParser();
  const kml = parser.parseFromString(kmlString, 'text/xml');
  
  // Convert KML to GeoJSON (simplified implementation)
  // In a real app, use a proper KML to GeoJSON library
  const features = [];
  
  // Parse placemarks
  const placemarks = kml.getElementsByTagName('Placemark');
  for (let i = 0; i < placemarks.length; i++) {
    const placemark = placemarks[i];
    const name = placemark.getElementsByTagName('name')[0]?.textContent || '';
    
    // This is a simplified example, real implementation would be more complex
    features.push({
      type: 'Feature',
      properties: { name },
      geometry: {
        type: 'Point',
        coordinates: [0, 0] // Placeholder
      }
    });
  }
  
  return {
    type: 'FeatureCollection',
    features
  };
};