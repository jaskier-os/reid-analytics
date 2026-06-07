import React, { useRef, useEffect, useMemo, useCallback } from 'react';
import {
  Box,
  Typography,
  Avatar,
  CircularProgress,
  Paper,
  IconButton,
  Button,
  ButtonGroup,
  Switch,
  FormControlLabel
} from '@mui/material';
import { Close, Person } from '@mui/icons-material';
import { useMapReid } from '../../context/MapReidContext';
import { personIdToColor, groupSightingsByDay } from '../../utils/reidMapUtils';
import { formatTime } from '../../utils/formatTime';
import reidService from '../../services/reidService';

const SightingsPanel = () => {
  const {
    selectedPersonId,
    selectedSightings,
    selectedSightingsLoading,
    selectedSightingsHasMore,
    sortBy,
    hoveredSightingId,
    showTrajectory,
    deselectPerson,
    loadMoreSelectedSightings,
    setSortBy,
    setHoveredSightingId,
    setFocusedSighting,
    setShowTrajectory,
    persons
  } = useMapReid();

  const sentinelRef = useRef(null);

  const handleLoadMore = useCallback(() => {
    if (!selectedSightingsLoading && selectedSightingsHasMore) {
      loadMoreSelectedSightings();
    }
  }, [selectedSightingsLoading, selectedSightingsHasMore, loadMoreSelectedSightings]);

  useEffect(() => {
    const el = sentinelRef.current;
    if (!el || !selectedSightingsHasMore) return;
    const observer = new IntersectionObserver(
      ([entry]) => { if (entry.isIntersecting) handleLoadMore(); },
      { rootMargin: '200px' }
    );
    observer.observe(el);
    return () => observer.disconnect();
  }, [selectedSightingsHasMore, handleLoadMore]);

  const sortedSightings = useMemo(() => {
    const sorted = [...selectedSightings];
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
  }, [selectedSightings, sortBy]);

  const dayGroups = useMemo(() => groupSightingsByDay(sortedSightings), [sortedSightings]);

  if (!selectedPersonId) return null;

  const person = persons.find(p => p.id === selectedPersonId);
  const color = personIdToColor(selectedPersonId);

  return (
    <Paper
      elevation={4}
      sx={{
        position: 'absolute',
        bottom: 16,
        left: 330,
        zIndex: 1000,
        width: 300,
        minHeight: 500,
        maxHeight: '50vh',
        display: 'flex',
        flexDirection: 'column',
        background: 'rgba(40, 40, 40, 0.95)',
        backdropFilter: 'blur(20px)',
        border: '1px solid',
        borderColor: 'rgba(250, 189, 47, 0.15)',
        borderRadius: 2,
        overflow: 'hidden'
      }}
    >
      {/* Header */}
      <Box sx={{
        px: 1.5,
        py: 1,
        borderBottom: '1px solid',
        borderColor: 'rgba(250, 189, 47, 0.1)',
        display: 'flex',
        alignItems: 'center',
        gap: 1,
        flexShrink: 0
      }}>
        <Avatar
          src={person ? reidService.getPersonImageUrl(person.id) : undefined}
          variant="rounded"
          sx={{ width: 28, height: 28, border: `2px solid ${color}` }}
        >
          <Person sx={{ fontSize: 16 }} />
        </Avatar>
        <Typography variant="subtitle2" sx={{ fontWeight: 700, color: '#fabd2f', flex: 1 }}>
          Sightings
        </Typography>
        <IconButton
          size="small"
          onClick={deselectPerson}
          sx={{
            '&:hover': {
              background: 'rgba(251, 73, 52, 0.1)',
              color: '#fb4934'
            }
          }}
        >
          <Close fontSize="small" />
        </IconButton>
      </Box>

      {/* Controls */}
      <Box sx={{
        px: 1.5,
        py: 0.75,
        borderBottom: '1px solid',
        borderColor: 'rgba(250, 189, 47, 0.1)',
        display: 'flex',
        alignItems: 'center',
        gap: 1,
        flexWrap: 'wrap',
        flexShrink: 0
      }}>
        <ButtonGroup size="small" variant="outlined">
          <Button
            onClick={() => setSortBy('date-desc')}
            variant={sortBy === 'date-desc' ? 'contained' : 'outlined'}
            sx={{ fontSize: '0.65rem', px: 0.75 }}
          >
            Latest
          </Button>
          <Button
            onClick={() => setSortBy('date-asc')}
            variant={sortBy === 'date-asc' ? 'contained' : 'outlined'}
            sx={{ fontSize: '0.65rem', px: 0.75 }}
          >
            Oldest
          </Button>
          <Button
            onClick={() => setSortBy('camera')}
            variant={sortBy === 'camera' ? 'contained' : 'outlined'}
            sx={{ fontSize: '0.65rem', px: 0.75 }}
          >
            Cam
          </Button>
        </ButtonGroup>

        <FormControlLabel
          control={
            <Switch
              size="small"
              checked={showTrajectory}
              onChange={(e) => setShowTrajectory(e.target.checked)}
            />
          }
          label={<Typography variant="caption" sx={{ fontSize: '0.65rem' }}>Path</Typography>}
          sx={{ ml: 'auto', mr: 0 }}
        />
      </Box>

      {/* Sightings list */}
      <Box sx={{ flex: 1, overflow: 'auto', p: 0.5 }}>
        {dayGroups.map((group, gi) => (
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

            {group.sightings.map((sighting) => {
              const isHovered = sighting.id === hoveredSightingId;
              return (
                <Box
                  key={sighting.id || sighting.timestamp}
                  onMouseEnter={() => setHoveredSightingId(sighting.id)}
                  onMouseLeave={() => setHoveredSightingId(null)}
                  onClick={() => {
                    if (typeof sighting.latitude === 'number' && typeof sighting.longitude === 'number') {
                      setFocusedSighting(sighting);
                    }
                  }}
                  sx={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: 0.75,
                    px: 1,
                    py: 0.5,
                    borderRadius: 1,
                    cursor: 'pointer',
                    border: '1px solid',
                    borderColor: isHovered ? 'rgba(255, 50, 50, 0.5)' : 'transparent',
                    background: isHovered ? 'rgba(255, 50, 50, 0.07)' : 'transparent',
                    transition: 'all 0.15s',
                    '&:hover': {
                      background: 'rgba(250, 189, 47, 0.05)'
                    }
                  }}
                >
                  <Typography variant="caption" sx={{ fontSize: '0.7rem', color: 'text.secondary' }}>
                    {formatTime(sighting.timestamp)}
                    {sighting.camera_id ? ` -- Cam ${sighting.camera_id}` : ''}
                  </Typography>
                </Box>
              );
            })}
          </React.Fragment>
        ))}

        <Box ref={sentinelRef} sx={{ py: 1, display: 'flex', justifyContent: 'center' }}>
          {selectedSightingsLoading && <CircularProgress size={20} />}
        </Box>
      </Box>
    </Paper>
  );
};

export default SightingsPanel;
