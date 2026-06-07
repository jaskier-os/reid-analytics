import React, { useMemo, useEffect } from 'react';
import { Marker, Popup, Polyline, useMap } from 'react-leaflet';
import { Box, Typography, Divider } from '@mui/material';
import { useMapReid } from '../../context/MapReidContext';
import { createGazeIcon, personIdToColor } from '../../utils/reidMapUtils';
import { formatDateTime } from '../../utils/formatTime';

const MapFlyController = () => {
  const map = useMap();
  const { focusedSighting } = useMapReid();

  useEffect(() => {
    if (focusedSighting && typeof focusedSighting.latitude === 'number' && typeof focusedSighting.longitude === 'number') {
      map.flyTo([focusedSighting.latitude, focusedSighting.longitude], 18, { duration: 0.7 });
    }
  }, [focusedSighting, map]);

  return null;
};

const hasLocation = (s) =>
  typeof s.latitude === 'number' && typeof s.longitude === 'number' &&
  isFinite(s.latitude) && isFinite(s.longitude);

const buildTrajectorySegments = (sightings, color) => {
  const withLoc = sightings.filter(hasLocation);
  if (withLoc.length < 2) return [];
  const sorted = [...withLoc].sort((a, b) => new Date(a.timestamp) - new Date(b.timestamp));
  const times = sorted.map(s => new Date(s.timestamp).getTime());
  const tMin = Math.min(...times);
  const tMax = Math.max(...times);
  const range = tMax - tMin || 1;
  return sorted.slice(0, -1).map((s, i) => {
    const t1 = (times[i] - tMin) / range;
    const t2 = (times[i + 1] - tMin) / range;
    return {
      positions: [[s.latitude, s.longitude], [sorted[i + 1].latitude, sorted[i + 1].longitude]],
      opacity: (t1 + t2) / 2,
      color
    };
  });
};

const SightingPopup = ({ sighting }) => (
  <Box sx={{ minWidth: 200 }}>
    <Typography variant="body2" fontWeight={600}>
      Camera {sighting.camera_id || 'Unknown'}
    </Typography>
    <Typography variant="caption" display="block" color="text.secondary">
      {formatDateTime(sighting.timestamp)}
    </Typography>
    <Divider sx={{ my: 1 }} />
    <Typography variant="caption" display="block">
      Lat: {sighting.latitude?.toFixed(6)}
    </Typography>
    <Typography variant="caption" display="block">
      Lon: {sighting.longitude?.toFixed(6)}
    </Typography>
    {sighting.gaze !== null && sighting.gaze !== undefined && (
      <Typography variant="caption" display="block">
        Gaze: {sighting.gaze.toFixed(1)}&deg;
      </Typography>
    )}
    {sighting.heading !== null && sighting.heading !== undefined && (
      <Typography variant="caption" display="block">
        Heading: {sighting.heading.toFixed(1)}&deg;
      </Typography>
    )}
    {sighting.distance && (
      <Typography variant="caption" display="block">
        Distance: {sighting.distance.toFixed(1)}m
      </Typography>
    )}
  </Box>
);

const ReidMapMarkers = () => {
  const {
    persons,
    personSightings,
    selectedPersonId,
    selectedSightings,
    hoveredSightingId,
    showTrajectory,
    selectPerson
  } = useMapReid();

  const allPersonMarkers = useMemo(() => {
    if (selectedPersonId) return null;

    const markers = [];
    const trajectories = [];

    for (const p of persons) {
      const sightings = personSightings[p.id];
      if (!sightings || sightings.length === 0) continue;

      const color = personIdToColor(p.id);
      const withLoc = sightings.filter(hasLocation);

      for (const s of withLoc) {
        markers.push({
          key: `${p.id}-${s.id || s.timestamp}`,
          position: [s.latitude, s.longitude],
          icon: createGazeIcon(s.gaze ?? s.heading, color, s.id === hoveredSightingId),
          sighting: s,
          personId: p.id
        });
      }

      if (showTrajectory) {
        trajectories.push(...buildTrajectorySegments(sightings, color));
      }
    }

    return { markers, trajectories };
  }, [persons, personSightings, selectedPersonId, hoveredSightingId, showTrajectory]);

  const selectedMarkers = useMemo(() => {
    if (!selectedPersonId) return null;

    const color = personIdToColor(selectedPersonId);
    const withLoc = selectedSightings.filter(hasLocation);

    const markers = withLoc.map(s => ({
      key: `sel-${s.id || s.timestamp}`,
      position: [s.latitude, s.longitude],
      icon: createGazeIcon(s.gaze ?? s.heading, color, s.id === hoveredSightingId),
      sighting: s,
      personId: selectedPersonId
    }));

    const trajectories = showTrajectory ? buildTrajectorySegments(selectedSightings, color) : [];

    return { markers, trajectories };
  }, [selectedPersonId, selectedSightings, hoveredSightingId, showTrajectory]);

  const data = selectedPersonId ? selectedMarkers : allPersonMarkers;

  if (!data) return <MapFlyController />;

  return (
    <>
      <MapFlyController />

      {data.trajectories.map((seg, i) => (
        <Polyline
          key={`traj-${i}`}
          positions={seg.positions}
          color={seg.color}
          weight={3}
          opacity={seg.opacity}
        />
      ))}

      {data.markers.map(m => (
        <Marker
          key={m.key}
          position={m.position}
          icon={m.icon}
          eventHandlers={{
            click: () => {
              if (!selectedPersonId) selectPerson(m.personId);
            }
          }}
        >
          <Popup>
            <SightingPopup sighting={m.sighting} />
          </Popup>
        </Marker>
      ))}
    </>
  );
};

export default ReidMapMarkers;
