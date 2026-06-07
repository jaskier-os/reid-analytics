import React from 'react';
import ReactDOM from 'react-dom/client';
import App from './App';
import './index.css';

// Fix for Leaflet icon issues
import L from 'leaflet';
import icon from 'leaflet/dist/images/marker-icon.png';
import iconShadow from 'leaflet/dist/images/marker-shadow.png';

let DefaultIcon = L.icon({
  iconUrl: icon,
  shadowUrl: iconShadow,
  iconSize: [25, 41],
  iconAnchor: [12, 41],
  popupAnchor: [1, -34],
  shadowSize: [41, 41]
});

L.Marker.prototype.options.icon = DefaultIcon;

// Patch Marker cleanup to handle React destroying DOM before Leaflet
// can remove its event listeners (causes _leaflet_events crash).
const _origMarkerOnRemove = L.Marker.prototype.onRemove;
L.Marker.prototype.onRemove = function (map) {
  try {
    return _origMarkerOnRemove.call(this, map);
  } catch (_) {
    // swallow cleanup error
  }
};

// Create the root element
const root = ReactDOM.createRoot(document.getElementById('root'));

// Render the application
root.render(<App />);