import React, { useRef, useEffect, useCallback } from 'react';
import {
  Box,
  Typography,
  Avatar,
  CircularProgress,
  Paper
} from '@mui/material';
import { Person } from '@mui/icons-material';
import { useMapReid } from '../../context/MapReidContext';
import { personIdToColor } from '../../utils/reidMapUtils';
import { formatDateTime } from '../../utils/formatTime';
import reidService from '../../services/reidService';

const RecentPeoplePanel = () => {
  const {
    persons,
    personsLoading,
    personsHasMore,
    selectedPersonId,
    loadPersons,
    selectPerson,
    deselectPerson
  } = useMapReid();

  const sentinelRef = useRef(null);

  const handleLoadMore = useCallback(() => {
    if (!personsLoading && personsHasMore) {
      loadPersons(false);
    }
  }, [personsLoading, personsHasMore, loadPersons]);

  useEffect(() => {
    const el = sentinelRef.current;
    if (!el || !personsHasMore) return;
    const observer = new IntersectionObserver(
      ([entry]) => { if (entry.isIntersecting) handleLoadMore(); },
      { rootMargin: '200px' }
    );
    observer.observe(el);
    return () => observer.disconnect();
  }, [personsHasMore, handleLoadMore]);

  const handleClick = (personId) => {
    if (selectedPersonId === personId) {
      deselectPerson();
    } else {
      selectPerson(personId);
    }
  };

  return (
    <Paper
      elevation={4}
      sx={{
        position: 'absolute',
        bottom: 16,
        left: 16,
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
      <Box sx={{
        px: 2,
        py: 2,
        borderBottom: '1px solid',
        borderColor: 'rgba(250, 189, 47, 0.1)',
        flexShrink: 0
      }}>
        <Typography variant="subtitle2" sx={{ fontWeight: 700, color: '#fabd2f' }}>
          Recent People
        </Typography>
      </Box>

      <Box sx={{ flex: 1, overflow: 'auto', p: 0.5 }}>
        {persons.map(p => {
          const color = personIdToColor(p.id);
          const isSelected = selectedPersonId === p.id;

          return (
            <Box
              key={p.id}
              onClick={() => handleClick(p.id)}
              sx={{
                display: 'flex',
                alignItems: 'center',
                gap: 1,
                px: 1,
                py: 0.75,
                borderRadius: 1,
                cursor: 'pointer',
                border: '1px solid',
                borderColor: isSelected ? color : 'transparent',
                background: isSelected ? 'rgba(250, 189, 47, 0.08)' : 'transparent',
                transition: 'all 0.15s',
                '&:hover': {
                  background: 'rgba(250, 189, 47, 0.05)'
                }
              }}
            >
              <Box sx={{ position: 'relative' }}>
                <Avatar
                  src={reidService.getPersonImageUrl(p.id)}
                  variant="rounded"
                  sx={{ width: 36, height: 36 }}
                >
                  <Person sx={{ fontSize: 20 }} />
                </Avatar>
                <Box sx={{
                  position: 'absolute',
                  bottom: -2,
                  right: -2,
                  width: 10,
                  height: 10,
                  borderRadius: '50%',
                  background: color,
                  border: '1.5px solid rgba(40, 40, 40, 0.95)'
                }} />
              </Box>

              <Box sx={{ flex: 1, minWidth: 0 }}>
                <Typography
                  variant="caption"
                  sx={{
                    fontFamily: 'monospace',
                    fontWeight: 600,
                    display: 'block',
                    fontSize: '0.75rem',
                    overflow: 'hidden',
                    textOverflow: 'ellipsis',
                    whiteSpace: 'nowrap'
                  }}
                >
                  {p.id.substring(0, 8)}
                </Typography>
                <Typography
                  variant="caption"
                  color="text.secondary"
                  sx={{ fontSize: '0.6rem', display: 'block' }}
                >
                  {p.last_seen_at ? formatDateTime(p.last_seen_at) : 'No sightings'}
                </Typography>
              </Box>

              {p.total_sightings != null && (
                <Typography
                  variant="caption"
                  sx={{
                    fontSize: '0.65rem',
                    color: 'text.secondary',
                    flexShrink: 0
                  }}
                >
                  {p.total_sightings}
                </Typography>
              )}
            </Box>
          );
        })}

        <Box ref={sentinelRef} sx={{ py: 1, display: 'flex', justifyContent: 'center' }}>
          {personsLoading && <CircularProgress size={20} />}
        </Box>
      </Box>
    </Paper>
  );
};

export default RecentPeoplePanel;
