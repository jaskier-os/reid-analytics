import L from 'leaflet';

export const mapSighting = (s) => ({
  ...s,
  latitude: s.person_latitude ?? s.metadata?.latitude ?? s.latitude ?? null,
  longitude: s.person_longitude ?? s.metadata?.longitude ?? s.longitude ?? null,
  altitude: s.person_altitude ?? s.metadata?.altitude ?? s.altitude ?? null,
  distance: s.distance_meters ?? s.metadata?.distance ?? s.distance ?? null,
  heading: s.heading_degrees ?? s.metadata?.heading ?? s.heading ?? null,
  gaze: s.gaze_degrees ?? s.metadata?.gaze_degrees ?? null,
  timestamp: s.detected_at || s.timestamp
});

export const createGazeIcon = (gazeDegrees, color = '#cc0000', isHighlighted = false) => {
  const size = isHighlighted ? 42 : 32;
  const dotR = isHighlighted ? 8 : 6;
  const half = size / 2;
  const highlightedClass = isHighlighted ? 'gaze-highlighted' : '';
  return L.divIcon({
    className: 'custom-gaze-icon',
    html: `
      <div class="${highlightedClass}" style="width:${size}px;height:${size}px;">
        <div style="width:${size}px;height:${size}px;transform:rotate(${gazeDegrees || 0}deg);display:flex;align-items:center;justify-content:center;">
          <svg width="${size}" height="${size}" viewBox="0 0 ${size} ${size}" fill="none" xmlns="http://www.w3.org/2000/svg">
            <line x1="${half}" y1="${half}" x2="${half}" y2="4" stroke="${color}" stroke-width="2.5"/>
            <polygon points="${half},2 ${half - 4},10 ${half + 4},10" fill="${color}"/>
            <circle cx="${half}" cy="${half}" r="${dotR}" fill="${color}" stroke="white" stroke-width="1.5"/>
          </svg>
        </div>
      </div>
    `,
    iconSize: [size, size],
    iconAnchor: [half, half]
  });
};

export const personIdToColor = (personId) => {
  let hash = 0;
  for (let i = 0; i < personId.length; i++) {
    hash = ((hash << 5) - hash + personId.charCodeAt(i)) | 0;
  }
  const hue = ((hash % 360) + 360) % 360;
  return `hsl(${hue}, 70%, 50%)`;
};

const dayFormatter = new Intl.DateTimeFormat('en-GB', {
  day: 'numeric',
  month: 'long',
  year: 'numeric'
});

export const formatDaySeparator = (dateStr) => {
  return dayFormatter.format(new Date(dateStr));
};

export const groupSightingsByDay = (sightings) => {
  const groups = [];
  let currentDay = null;
  let currentGroup = null;

  for (const s of sightings) {
    const date = new Date(s.timestamp);
    const dayKey = `${date.getFullYear()}-${date.getMonth()}-${date.getDate()}`;

    if (dayKey !== currentDay) {
      currentDay = dayKey;
      currentGroup = { dayLabel: formatDaySeparator(s.timestamp), sightings: [] };
      groups.push(currentGroup);
    }
    currentGroup.sightings.push(s);
  }

  return groups;
};
