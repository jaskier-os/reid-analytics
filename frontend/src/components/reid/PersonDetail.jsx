import React, { useState, useEffect, useMemo, useRef, useCallback, Component } from 'react';
import {
  Box,
  Typography,
  Grid,
  CircularProgress,
  Alert,
  IconButton,
  Chip,
  Paper,
  Tabs,
  Tab,
  List,
  ListItem,
  ListItemText,
  Avatar,
  Divider,
  Switch,
  FormControlLabel,
  Tooltip,
  Button,
  ButtonGroup,
  Modal,
  Card,
  CardMedia,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogContentText,
  DialogActions
} from '@mui/material';
import {
  Close,
  PushPin,
  PushPinOutlined,
  LocationOn,
  Visibility,
  Person,
  AccessTime,
  Map as MapIcon,
  Navigation,
  VisibilityOff,
  ViewInAr,
  PhotoLibrary,
  CameraAlt,
  Delete as DeleteIcon,
  Policy
} from '@mui/icons-material';
import { MapContainer, TileLayer, Marker, Popup, Polyline, useMap } from 'react-leaflet';
import 'leaflet/dist/leaflet.css';
import L from 'leaflet';
import { useReid } from '../../context/ReidContext';
import reidService from '../../services/reidService';
import { getSocket } from '../../services/socketService';
import Face3DViewer from './Face3DViewer';
import OsintTab from './OsintTab';
import { formatDateTime } from '../../utils/formatTime';
import { createGazeIcon, mapSighting, groupSightingsByDay } from '../../utils/reidMapUtils';

const BACKEND_URL = '';

// Sherlock / OSINT UI is hidden by default. Enable by setting VITE_ENABLE_OSINT=true.
const OSINT_ENABLED = String(import.meta.env.VITE_ENABLE_OSINT).toLowerCase() === 'true';

delete L.Icon.Default.prototype._getIconUrl;
L.Icon.Default.mergeOptions({
  iconUrl: 'https://unpkg.com/leaflet@1.7.1/dist/images/marker-icon.png',
  iconRetinaUrl: 'https://unpkg.com/leaflet@1.7.1/dist/images/marker-icon-2x.png',
  shadowUrl: 'https://unpkg.com/leaflet@1.7.1/dist/images/marker-shadow.png'
});


class MapErrorBoundary extends Component {
  constructor(props) {
    super(props);
    this.state = { hasError: false };
  }

  static getDerivedStateFromError() {
    return { hasError: true };
  }

  componentDidCatch(error, info) {
    console.error('MapContainer crash caught:', error, info);
  }

  render() {
    if (this.state.hasError) {
      return (
        <Box sx={{ textAlign: 'center', py: 4 }}>
          <MapIcon sx={{ fontSize: 48, color: 'text.secondary', mb: 1 }} />
          <Typography variant="body2" color="text.secondary">
            Map failed to load
          </Typography>
          <Button
            size="small"
            sx={{ mt: 1 }}
            onClick={() => this.setState({ hasError: false })}
          >
            Retry
          </Button>
        </Box>
      );
    }
    return this.props.children;
  }
}

const MapController = ({ target }) => {
  const map = useMap();
  useEffect(() => {
    if (target) map.flyTo([target.latitude, target.longitude], 18, { duration: 0.7 });
  }, [target, map]);
  return null;
};

const SIGHTINGS_PAGE_SIZE = 50;

const OsintTabPoller = ({ personId, onUpdate }) => {
  const lastJsonRef = useRef(null);
  useEffect(() => {
    const poll = async () => {
      try {
        const updated = await reidService.getPerson(personId);
        const newJson = JSON.stringify(updated.information_found);
        if (lastJsonRef.current !== newJson) {
          lastJsonRef.current = newJson;
          onUpdate(updated);
        }
      } catch {}
    };
    const id = setInterval(poll, 5000);
    return () => clearInterval(id);
  }, [personId, onUpdate]);
  return null;
};

const PersonDetail = ({ person, onClose, onPersonClick }) => {
  const { isPinned, togglePin, hidePerson, unhidePerson, deletePerson } = useReid();
  const [similarPersons, setSimilarPersons] = useState([]);
  const [sightings, setSightings] = useState([]);
  const [snapshots, setSnapshots] = useState([]);
  const [loading, setLoading] = useState(false);
  const [loadingMore, setLoadingMore] = useState(false);
  const [hasMore, setHasMore] = useState(false);
  const [error, setError] = useState(null);
  const [activeTab, setActiveTab] = useState(0);
  const [sortBy, setSortBy] = useState('date-desc');
  const [hiddenSightings, setHiddenSightings] = useState(new Set());
  const [showTrajectory, setShowTrajectory] = useState(true);
  const [modalImage, setModalImage] = useState(null);
  const [hoveredSightingId, setHoveredSightingId] = useState(null);
  const [focusedSighting, setFocusedSighting] = useState(null);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [personData, setPersonData] = useState(person);
  const [modelKey, setModelKey] = useState(0);
  const sentinelRef = useRef(null);

  const pinned = isPinned(person.id);
  const isHidden = personData.is_active === false;

  const handleHideToggle = async () => {
    if (isHidden) {
      await unhidePerson(person.id);
    } else {
      await hidePerson(person.id);
      onClose();
    }
  };

  const handleDelete = async () => {
    await deletePerson(person.id);
    setDeleteDialogOpen(false);
    onClose();
  };

  const loadPersonDetails = async () => {
    try {
      setLoading(true);
      setError(null);

      const [similarResponse, sightingsResponse, snapshotsResponse] = await Promise.all([
        reidService.getSimilarPersons(person.id, 0.3, 10),
        reidService.getPersonSightings(person.id, SIGHTINGS_PAGE_SIZE, 0),
        reidService.getPersonSnapshots(person.id)
      ]);

      setSimilarPersons(similarResponse.similar_persons || similarResponse.persons || []);

      const items = (sightingsResponse.sightings || []).map(mapSighting);
      setSightings(items);
      setHasMore(items.length >= SIGHTINGS_PAGE_SIZE);

      setSnapshots((snapshotsResponse.sightings || []).map(mapSighting));
    } catch (err) {
      console.error('Error loading person details:', err);
      setError('Failed to load person details');
    } finally {
      setLoading(false);
    }
  };

  const loadMoreSightings = useCallback(async () => {
    if (loadingMore || !hasMore) return;
    setLoadingMore(true);
    try {
      const response = await reidService.getPersonSightings(person.id, SIGHTINGS_PAGE_SIZE, sightings.length);
      const items = (response.sightings || []).map(mapSighting);
      setSightings(prev => [...prev, ...items]);
      setHasMore(items.length >= SIGHTINGS_PAGE_SIZE);
    } catch (err) {
      console.error('Error loading more sightings:', err);
    } finally {
      setLoadingMore(false);
    }
  }, [loadingMore, hasMore, person.id, sightings.length]);

  useEffect(() => {
    setPersonData(person);
    loadPersonDetails();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [person.id]);

  useEffect(() => {
    const socket = getSocket();
    socket.emit('watch-person', { personId: person.id });

    const onSighting = ({ personId: pid, sighting }) => {
      if (pid !== person.id) return;
      const mapped = mapSighting(sighting);
      setSightings(prev => [mapped, ...prev]);
      if (sighting.snapshot_path) {
        setSnapshots(prev => [mapped, ...prev]);
      }
    };

    const onUpdated = async ({ person: updated }) => {
      if (updated.id !== person.id) return;
      setPersonData(updated);
      setModelKey(k => k + 1);
      try {
        const similarResponse = await reidService.getSimilarPersons(person.id, 0.7, 10);
        setSimilarPersons(similarResponse.similar_persons || similarResponse.persons || []);
      } catch (err) {
        console.error('Error refreshing similar persons:', err);
      }
    };

    const onDeleted = ({ personId: pid }) => {
      if (pid === person.id) onClose();
    };

    socket.on('person-sighting', onSighting);
    socket.on('person-updated', onUpdated);
    socket.on('person-deleted', onDeleted);

    return () => {
      socket.emit('unwatch-person', { personId: person.id });
      socket.off('person-sighting', onSighting);
      socket.off('person-updated', onUpdated);
      socket.off('person-deleted', onDeleted);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [person.id]);

  useEffect(() => {
    const el = sentinelRef.current;
    if (!el || !hasMore) return;
    const observer = new IntersectionObserver(
      ([entry]) => { if (entry.isIntersecting) loadMoreSightings(); },
      { rootMargin: '200px' }
    );
    observer.observe(el);
    return () => observer.disconnect();
  }, [hasMore, loadMoreSightings]);

  const imageUrl = reidService.getPersonImageUrl(person.id);

  const sortedSightings = useMemo(() => {
    let sorted = [...sightings];

    switch (sortBy) {
      case 'date-desc':
        sorted.sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp));
        break;
      case 'date-asc':
        sorted.sort((a, b) => new Date(a.timestamp) - new Date(b.timestamp));
        break;
      case 'camera':
        sorted.sort((a, b) => (a.camera_id || '').localeCompare(b.camera_id || ''));
        break;
      default:
        break;
    }

    return sorted;
  }, [sightings, sortBy]);

  const visibleSightings = useMemo(() =>
    sortedSightings.filter((s, idx) => !hiddenSightings.has(idx)),
    [sortedSightings, hiddenSightings]
  );

  const sightingsWithLocation = visibleSightings.filter(s =>
    typeof s.latitude === 'number' && typeof s.longitude === 'number' &&
    isFinite(s.latitude) && isFinite(s.longitude)
  );

  const mapCenter = sightingsWithLocation.length > 0
    ? [sightingsWithLocation[0].latitude, sightingsWithLocation[0].longitude]
    : [55.738322, 37.618561];

  const trajectorySegments = useMemo(() => {
    if (!showTrajectory || sightingsWithLocation.length < 2) return [];
    const sorted = [...sightingsWithLocation].sort(
      (a, b) => new Date(a.timestamp) - new Date(b.timestamp)
    );
    const times = sorted.map(s => new Date(s.timestamp).getTime());
    const tMin = Math.min(...times);
    const tMax = Math.max(...times);
    const range = tMax - tMin || 1;
    return sorted.slice(0, -1).map((s, i) => {
      const t1 = (times[i] - tMin) / range;
      const t2 = (times[i + 1] - tMin) / range;
      return {
        positions: [[s.latitude, s.longitude], [sorted[i + 1].latitude, sorted[i + 1].longitude]],
        opacity: (t1 + t2) / 2
      };
    });
  }, [sightingsWithLocation, showTrajectory]);


  const toggleSightingVisibility = (idx) => {
    setHiddenSightings(prev => {
      const newSet = new Set(prev);
      if (newSet.has(idx)) {
        newSet.delete(idx);
      } else {
        newSet.add(idx);
      }
      return newSet;
    });
  };

  return (
    <Box
      sx={{
        position: 'fixed',
        top: 0,
        right: 0,
        width: { xs: '100%', lg: '1200px' },
        height: '100vh',
        zIndex: 1300,
        display: 'flex',
        flexDirection: 'column',
        overflow: 'hidden',
        background: 'rgba(40, 40, 40, 0.98)',
        backdropFilter: 'blur(20px)',
        boxShadow: '-4px 0 20px rgba(0,0,0,0.2)',
        borderLeft: '1px solid',
        borderRadius: '16px',
        borderColor: 'rgba(250, 189, 47, 0.1)'
      }}
    >
      {/* Header */}
      <Paper
        elevation={0}
        sx={{
          p: 1.5,
          px: 2,
          display: 'flex',
          alignItems: 'center',
          gap: 1.5,
          borderBottom: '1px solid',
          borderColor: 'rgba(250, 189, 47, 0.1)'
        }}
      >
        <Avatar
          src={imageUrl}
          variant="rounded"
          sx={{ width: 48, height: 48 }}
        >
          <Person />
        </Avatar>
        <Box sx={{ flex: 1, minWidth: 0 }}>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
            <Typography
              variant="subtitle1"
              sx={{ fontWeight: 700, color: '#fabd2f' }}
            >
              Person Details
            </Typography>
            {isHidden && (
              <Chip
                label="Hidden"
                size="small"
                sx={{
                  backgroundColor: 'rgba(251, 73, 52, 0.2)',
                  color: '#fb4934',
                  fontWeight: 600,
                  fontSize: '0.7rem',
                  height: 22,
                  border: '1px solid',
                  borderColor: 'rgba(251, 73, 52, 0.4)'
                }}
              />
            )}
          </Box>
          <Typography
            variant="caption"
            sx={{
              fontFamily: 'monospace',
              color: 'text.secondary',
              display: 'block',
              overflow: 'hidden',
              textOverflow: 'ellipsis',
              whiteSpace: 'nowrap'
            }}
          >
            {person.id}
          </Typography>
        </Box>
        <Tooltip title={isHidden ? 'Unhide person' : 'Hide person'}>
          <IconButton
            size="small"
            onClick={handleHideToggle}
            sx={{
              color: isHidden ? '#fb4934' : 'text.secondary',
              '&:hover': {
                color: isHidden ? '#cc241d' : '#fb4934',
                background: 'rgba(251, 73, 52, 0.1)'
              }
            }}
          >
            {isHidden ? <Visibility /> : <VisibilityOff />}
          </IconButton>
        </Tooltip>
        <Tooltip title="Delete person">
          <IconButton
            size="small"
            onClick={() => setDeleteDialogOpen(true)}
            sx={{
              color: 'text.secondary',
              '&:hover': {
                color: '#fb4934',
                background: 'rgba(251, 73, 52, 0.1)'
              }
            }}
          >
            <DeleteIcon />
          </IconButton>
        </Tooltip>
        <IconButton
          size="small"
          onClick={() => togglePin(person.id)}
          sx={{
            color: pinned ? '#fabd2f' : 'text.secondary',
            '&:hover': {
              color: '#fabd2f',
              background: 'rgba(250, 189, 47, 0.1)'
            }
          }}
        >
          {pinned ? <PushPin /> : <PushPinOutlined />}
        </IconButton>
        <IconButton
          size="small"
          onClick={onClose}
          sx={{
            '&:hover': {
              background: 'rgba(251, 73, 52, 0.1)',
              color: '#fb4934'
            }
          }}
        >
          <Close />
        </IconButton>
      </Paper>

      {error && (
        <Alert severity="error" sx={{ m: 2 }}>
          {error}
        </Alert>
      )}

      {/* Content */}
      <Box sx={{ flexGrow: 1, overflow: 'auto', display: 'flex', flexDirection: 'column' }}>
        <Paper
          sx={{
            m: 2,
            borderRadius: 2,
            overflow: 'hidden',
            border: '1px solid',
            borderColor: 'rgba(250, 189, 47, 0.1)',
            flex: 1,
            display: 'flex',
            flexDirection: 'column'
          }}
        >
          <Tabs
            value={activeTab}
            onChange={(e, newValue) => setActiveTab(newValue)}
            variant="fullWidth"
            sx={{
              borderBottom: '1px solid',
              borderColor: 'rgba(250, 189, 47, 0.1)',
              '& .MuiTab-root': {
                minHeight: 48,
                fontSize: '0.875rem'
              }
            }}
          >
            <Tab icon={<PhotoLibrary fontSize="small" />} label="Overview" iconPosition="start" />
            <Tab icon={<MapIcon fontSize="small" />} label="Map" iconPosition="start" />
            <Tab icon={<Person fontSize="small" />} label="Similar" iconPosition="start" />
            <Tab icon={<ViewInAr fontSize="small" />} label="3D Model" iconPosition="start" />
            {OSINT_ENABLED && (
              <Tab icon={<Policy fontSize="small" />} label="OSINT" iconPosition="start" />
            )}
          </Tabs>

          <Box sx={{ p: 2, flex: 1, overflow: 'auto' }}>
            {/* Overview Tab */}
            {activeTab === 0 && (
              <Box>
                {/* Stats row */}
                <Box sx={{ display: 'flex', gap: 1, flexWrap: 'wrap', mb: 2 }}>
                  {personData.last_seen_at && (
                    <Chip
                      icon={<AccessTime />}
                      label={`Last seen: ${formatDateTime(personData.last_seen_at)}`}
                      size="small"
                      variant="outlined"
                      sx={{ borderColor: 'rgba(250, 189, 47, 0.3)' }}
                    />
                  )}
                  {personData.total_sightings && (
                    <Chip
                      icon={<Visibility />}
                      label={`${personData.total_sightings} sightings`}
                      size="small"
                      sx={{
                        backgroundColor: 'rgba(250, 189, 47, 0.2)',
                        color: '#fabd2f',
                        border: '1px solid',
                        borderColor: 'rgba(250, 189, 47, 0.4)',
                        fontWeight: 600
                      }}
                    />
                  )}
                  {personData.created_at && (
                    <Chip
                      icon={<AccessTime />}
                      label={`First seen: ${formatDateTime(personData.created_at)}`}
                      size="small"
                      variant="outlined"
                      sx={{ borderColor: 'rgba(250, 189, 47, 0.3)' }}
                    />
                  )}
                </Box>

                {/* Snapshot grid */}
                {loading ? (
                  <Box sx={{ display: 'flex', justifyContent: 'center', py: 4 }}>
                    <CircularProgress size={32} />
                  </Box>
                ) : snapshots.length > 0 ? (
                  <Box
                    sx={{
                      display: 'grid',
                      gridTemplateColumns: 'repeat(auto-fill, minmax(120px, 1fr))',
                      gap: 1.5
                    }}
                  >
                    {snapshots.map((sighting, idx) => (
                      <Box
                        key={idx}
                        onClick={() => setModalImage(sighting.snapshot_path)}
                        sx={{
                          cursor: 'pointer',
                          borderRadius: 1,
                          overflow: 'hidden',
                          border: '1px solid',
                          borderColor: 'rgba(250, 189, 47, 0.15)',
                          transition: 'all 0.2s',
                          '&:hover': {
                            borderColor: '#fabd2f',
                            transform: 'scale(1.03)'
                          }
                        }}
                      >
                        <Box
                          sx={{
                            width: '100%',
                            aspectRatio: '1',
                            background: 'rgba(0, 0, 0, 0.3)',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center'
                          }}
                        >
                          <Box
                            component="img"
                            src={sighting.snapshot_path}
                            alt={`Sighting ${idx}`}
                            sx={{
                              width: '100%',
                              height: '100%',
                              objectFit: 'contain'
                            }}
                          />
                        </Box>
                        <Box sx={{ p: 0.5, background: 'rgba(0, 0, 0, 0.4)' }}>
                          <Typography variant="caption" display="block" sx={{ fontSize: '0.65rem', color: 'text.secondary' }}>
                            <CameraAlt sx={{ fontSize: 10, mr: 0.3, verticalAlign: 'middle' }} />
                            {sighting.camera_id || 'N/A'}
                          </Typography>
                          <Typography variant="caption" display="block" sx={{ fontSize: '0.6rem', color: 'text.secondary' }}>
                            {formatDateTime(sighting.timestamp)}
                          </Typography>
                        </Box>
                      </Box>
                    ))}
                  </Box>
                ) : (
                  <Box sx={{ textAlign: 'center', py: 4 }}>
                    <PhotoLibrary sx={{ fontSize: 48, color: 'text.secondary', mb: 1 }} />
                    <Typography variant="body2" color="text.secondary">
                      No snapshots available
                    </Typography>
                  </Box>
                )}
              </Box>
            )}

            {/* Map Tab */}
            {activeTab === 1 && (
              <Box sx={{ display: 'flex', gap: 2, height: '100%', minHeight: 500 }}>
                {/* Map area */}
                <Box sx={{ flex: 1, display: 'flex', flexDirection: 'column', minWidth: 0 }}>
                  <Box sx={{ mb: 1, display: 'flex', gap: 1, flexWrap: 'wrap', alignItems: 'center' }}>
                    <FormControlLabel
                      control={
                        <Switch
                          size="small"
                          checked={showTrajectory}
                          onChange={(e) => setShowTrajectory(e.target.checked)}
                        />
                      }
                      label={<Typography variant="caption">Show Path</Typography>}
                    />
                    <Chip
                      size="small"
                      icon={<Visibility />}
                      label={`${visibleSightings.length} / ${sortedSightings.length}`}
                      variant="outlined"
                    />
                  </Box>

                  {sightingsWithLocation.length > 0 ? (
                    <MapErrorBoundary>
                      <Box sx={{ flex: 1, borderRadius: 2, overflow: 'hidden', minHeight: 450 }}>
                        <MapContainer key={person.id} center={mapCenter} zoom={15} style={{ height: '100%', width: '100%' }}>
                          <TileLayer
                            url={`${BACKEND_URL}/api/tiles/map/osm/{z}/{x}/{y}`}
                            attribution='&copy; OpenStreetMap'
                          />

                          <MapController target={focusedSighting} />

                          {trajectorySegments.map((seg, i) => (
                            <Polyline
                              key={i}
                              positions={seg.positions}
                              color="#d79921"
                              weight={3}
                              opacity={seg.opacity}
                            />
                          ))}

                          {sightingsWithLocation.map((sighting, idx) => (
                            <Marker
                              key={idx}
                              position={[sighting.latitude, sighting.longitude]}
                              icon={createGazeIcon(sighting.gaze ?? sighting.heading, '#cc0000', sighting.id === hoveredSightingId)}
                            >
                              <Popup>
                                <Box sx={{ minWidth: 200 }}>
                                  <Typography variant="body2" fontWeight={600}>
                                    Camera {sighting.camera_id || 'Unknown'}
                                  </Typography>
                                  <Typography variant="caption" display="block" color="text.secondary">
                                    {formatDateTime(sighting.timestamp)}
                                  </Typography>
                                  <Divider sx={{ my: 1 }} />
                                  <Typography variant="caption" display="block">
                                    Lat: {sighting.latitude.toFixed(6)}
                                  </Typography>
                                  <Typography variant="caption" display="block">
                                    Lon: {sighting.longitude.toFixed(6)}
                                  </Typography>
                                  {sighting.gaze !== null && (
                                    <Typography variant="caption" display="block">
                                      Gaze: {sighting.gaze.toFixed(1)}&deg;
                                    </Typography>
                                  )}
                                  {sighting.heading !== null && (
                                    <Typography variant="caption" display="block">
                                      Heading: {sighting.heading.toFixed(1)}&deg;
                                    </Typography>
                                  )}
                                  {sighting.distance && (
                                    <Typography variant="caption" display="block">
                                      Distance: {sighting.distance.toFixed(1)}m
                                    </Typography>
                                  )}
                                  {sighting.confidence_score && (
                                    <Typography variant="caption" display="block">
                                      Confidence: {(sighting.confidence_score * 100).toFixed(1)}%
                                    </Typography>
                                  )}
                                </Box>
                              </Popup>
                            </Marker>
                          ))}
                        </MapContainer>
                      </Box>
                    </MapErrorBoundary>
                  ) : (
                    <Box sx={{ textAlign: 'center', py: 4 }}>
                      <LocationOn sx={{ fontSize: 48, color: 'text.secondary', mb: 1 }} />
                      <Typography variant="body2" color="text.secondary">
                        No location data available
                      </Typography>
                    </Box>
                  )}
                </Box>

                {/* Timeline sidebar */}
                <Box
                  sx={{
                    width: 280,
                    flexShrink: 0,
                    display: 'flex',
                    flexDirection: 'column',
                    borderLeft: '1px solid',
                    borderColor: 'rgba(250, 189, 47, 0.1)',
                    pl: 2
                  }}
                >
                  <Box sx={{ mb: 1, display: 'flex', gap: 1, alignItems: 'center', justifyContent: 'space-between' }}>
                    <Typography variant="caption" color="text.secondary">
                      Sort:
                    </Typography>
                    <ButtonGroup size="small" variant="outlined">
                      <Button
                        onClick={() => setSortBy('date-desc')}
                        variant={sortBy === 'date-desc' ? 'contained' : 'outlined'}
                        sx={{ fontSize: '0.7rem', px: 1 }}
                      >
                        Latest
                      </Button>
                      <Button
                        onClick={() => setSortBy('date-asc')}
                        variant={sortBy === 'date-asc' ? 'contained' : 'outlined'}
                        sx={{ fontSize: '0.7rem', px: 1 }}
                      >
                        Oldest
                      </Button>
                      <Button
                        onClick={() => setSortBy('camera')}
                        variant={sortBy === 'camera' ? 'contained' : 'outlined'}
                        sx={{ fontSize: '0.7rem', px: 1 }}
                      >
                        Cam
                      </Button>
                    </ButtonGroup>
                  </Box>

                  {loading ? (
                    <Box sx={{ display: 'flex', justifyContent: 'center', py: 4 }}>
                      <CircularProgress size={24} />
                    </Box>
                  ) : sortedSightings.length > 0 ? (
                    <List sx={{ flex: 1, overflow: 'auto', p: 0 }}>
                      {groupSightingsByDay(sortedSightings).map((group, gi) => {
                        // Build a running index to match hiddenSightings set
                        const startIdx = sortedSightings.indexOf(group.sightings[0]);
                        return (
                          <React.Fragment key={gi}>
                            <Typography
                              variant="caption"
                              sx={{
                                color: 'text.secondary',
                                fontSize: '0.7rem',
                                px: 1,
                                py: 0.5,
                                display: 'block'
                              }}
                            >
                              {group.dayLabel}
                            </Typography>
                            {group.sightings.map((sighting, si) => {
                              const idx = startIdx + si;
                              const isHiddenItem = hiddenSightings.has(idx);
                              return (
                                <ListItem
                                  key={idx}
                                  onMouseEnter={() => setHoveredSightingId(sighting.id)}
                                  onMouseLeave={() => setHoveredSightingId(null)}
                                  onClick={() => {
                                    if (typeof sighting.latitude === 'number' && typeof sighting.longitude === 'number') {
                                      setFocusedSighting(sighting);
                                    }
                                  }}
                                  sx={{
                                    mb: 0.5,
                                    borderRadius: 1,
                                    opacity: isHiddenItem ? 0.4 : 1,
                                    transition: 'all 0.2s',
                                    border: '1px solid',
                                    borderColor: sighting.id === hoveredSightingId
                                      ? 'rgba(255, 50, 50, 0.5)'
                                      : isHiddenItem ? 'transparent' : 'rgba(250, 189, 47, 0.1)',
                                    py: 0.5,
                                    px: 1,
                                    cursor: 'pointer',
                                    background: sighting.id === hoveredSightingId
                                      ? 'rgba(255, 50, 50, 0.07)'
                                      : 'transparent',
                                    '&:hover': {
                                      background: 'rgba(250, 189, 47, 0.05)'
                                    }
                                  }}
                                  secondaryAction={
                                    <Tooltip title={isHiddenItem ? "Show on map" : "Hide from map"}>
                                      <IconButton
                                        edge="end"
                                        size="small"
                                        onClick={() => toggleSightingVisibility(idx)}
                                        sx={{ p: 0.5 }}
                                      >
                                        {isHiddenItem ? <VisibilityOff sx={{ fontSize: 16 }} /> : <Visibility sx={{ fontSize: 16 }} />}
                                      </IconButton>
                                    </Tooltip>
                                  }
                                >
                                  <Avatar
                                    src={imageUrl}
                                    sx={{ mr: 1, width: 28, height: 28, fontSize: '0.8rem' }}
                                  />
                                  <ListItemText
                                    primary={
                                      <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
                                        <Typography variant="caption" fontWeight={600}>
                                          Cam {sighting.camera_id || '?'}
                                        </Typography>
                                        {sighting.heading !== null && (
                                          <Chip
                                            size="small"
                                            icon={<Navigation sx={{ fontSize: 10 }} />}
                                            label={`${sighting.heading.toFixed(0)}`}
                                            sx={{ height: 16, fontSize: '0.6rem', '& .MuiChip-icon': { fontSize: 10 } }}
                                          />
                                        )}
                                      </Box>
                                    }
                                    secondary={
                                      <Typography variant="caption" display="block" color="text.secondary" sx={{ fontSize: '0.65rem' }}>
                                        {formatDateTime(sighting.timestamp)}
                                      </Typography>
                                    }
                                  />
                                </ListItem>
                              );
                            })}
                          </React.Fragment>
                        );
                      })}
                      <Box ref={sentinelRef} sx={{ py: 1, display: 'flex', justifyContent: 'center' }}>
                        {loadingMore && <CircularProgress size={20} />}
                      </Box>
                    </List>
                  ) : (
                    <Box sx={{ textAlign: 'center', py: 4 }}>
                      <AccessTime sx={{ fontSize: 36, color: 'text.secondary', mb: 1 }} />
                      <Typography variant="caption" color="text.secondary">
                        No sightings
                      </Typography>
                    </Box>
                  )}
                </Box>
              </Box>
            )}

            {/* Similar Tab */}
            {activeTab === 2 && (
              <Box>
                {loading ? (
                  <Box sx={{ display: 'flex', justifyContent: 'center', py: 4 }}>
                    <CircularProgress size={32} />
                  </Box>
                ) : similarPersons.length > 0 ? (
                  <Grid container spacing={1.5} sx={{ maxHeight: 300, overflow: 'auto' }}>
                    {similarPersons.map((similarPerson) => (
                      <Grid item xs={12} key={similarPerson.id}>
                        <Card
                          elevation={0}
                          sx={{
                            cursor: 'pointer',
                            border: '1px solid',
                            borderColor: 'rgba(250, 189, 47, 0.2)',
                            borderRadius: 1,
                            transition: 'all 0.2s',
                            '&:hover': {
                              borderColor: '#fabd2f',
                              background: 'rgba(250, 189, 47, 0.05)'
                            }
                          }}
                          onClick={() => onPersonClick(similarPerson)}
                        >
                          <Box sx={{ display: 'flex', p: 1 }}>
                            <CardMedia
                              component="img"
                              sx={{ width: 60, height: 60, objectFit: 'cover', borderRadius: 1 }}
                              image={reidService.getPersonImageUrl(similarPerson.id)}
                              alt={`Person ${similarPerson.id}`}
                              onError={(e) => {
                                e.target.src = 'data:image/svg+xml,%3Csvg xmlns="http://www.w3.org/2000/svg" width="60" height="60"%3E%3Crect fill="%23ddd" width="60" height="60"/%3E%3C/svg%3E';
                              }}
                            />
                            <Box sx={{ ml: 1.5, flexGrow: 1 }}>
                              <Typography variant="body2" fontWeight={600} noWrap>
                                {similarPerson.id.substring(0, 12)}...
                              </Typography>
                              {similarPerson.similarity && (
                                <Chip
                                  label={`${(similarPerson.similarity * 100).toFixed(1)}% match`}
                                  size="small"
                                  sx={{
                                    mt: 0.5,
                                    height: 20,
                                    fontSize: '0.7rem',
                                    backgroundColor: '#b8bb2640',
                                    color: '#b8bb26',
                                    border: '1px solid',
                                    borderColor: '#b8bb2680',
                                    fontWeight: 600
                                  }}
                                />
                              )}
                            </Box>
                          </Box>
                        </Card>
                      </Grid>
                    ))}
                  </Grid>
                ) : (
                  <Box sx={{ textAlign: 'center', py: 4 }}>
                    <Person sx={{ fontSize: 48, color: 'text.secondary', mb: 1 }} />
                    <Typography variant="body2" color="text.secondary">
                      No similar persons
                    </Typography>
                  </Box>
                )}
              </Box>
            )}

            {/* 3D Model Tab */}
            {activeTab === 3 && (
              <Face3DViewer personId={person.id} modelVersion={modelKey} />
            )}

            {OSINT_ENABLED && activeTab === 4 && (
              <OsintTabPoller personId={person.id} onUpdate={setPersonData} />
            )}
            {OSINT_ENABLED && activeTab === 4 && (
              <OsintTab
                informationFound={personData.information_found}
                personId={person.id}
                snapshots={snapshots}
                onDataUpdated={async () => {
                  try {
                    const updated = await reidService.getPerson(person.id);
                    setPersonData(updated);
                  } catch (err) {
                    console.error('Error refreshing person after OSINT:', err);
                  }
                }}
              />
            )}
          </Box>
        </Paper>
      </Box>

      {/* Delete Confirmation Dialog */}
      <Dialog
        open={deleteDialogOpen}
        onClose={() => setDeleteDialogOpen(false)}
        PaperProps={{
          sx: {
            background: 'rgba(40, 40, 40, 0.98)',
            border: '1px solid',
            borderColor: 'rgba(251, 73, 52, 0.3)',
            borderRadius: 2
          }
        }}
      >
        <DialogTitle sx={{ color: '#fb4934', fontWeight: 700 }}>
          Delete Person
        </DialogTitle>
        <DialogContent>
          <DialogContentText sx={{ color: 'text.secondary' }}>
            Are you sure? This will permanently delete this person and all their sightings and traits.
          </DialogContentText>
        </DialogContent>
        <DialogActions sx={{ p: 2 }}>
          <Button
            onClick={() => setDeleteDialogOpen(false)}
            sx={{ color: 'text.secondary' }}
          >
            Cancel
          </Button>
          <Button
            onClick={handleDelete}
            variant="contained"
            sx={{
              backgroundColor: '#fb4934',
              '&:hover': { backgroundColor: '#cc241d' }
            }}
          >
            Delete
          </Button>
        </DialogActions>
      </Dialog>

      {/* Image Modal */}
      <Modal
        open={!!modalImage}
        onClose={() => setModalImage(null)}
        sx={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center'
        }}
        slotProps={{
          backdrop: {
            sx: { backgroundColor: 'rgba(0, 0, 0, 0.85)' }
          }
        }}
      >
        <Box
          onClick={() => setModalImage(null)}
          sx={{
            outline: 'none',
            maxWidth: '90vw',
            maxHeight: '90vh'
          }}
        >
          <Box
            component="img"
            src={modalImage}
            alt="Sighting snapshot"
            sx={{
              maxWidth: '90vw',
              maxHeight: '90vh',
              objectFit: 'contain',
              borderRadius: 1
            }}
          />
        </Box>
      </Modal>
    </Box>
  );
};

export default PersonDetail;
