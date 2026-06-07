import React from 'react';
import {
  Card,
  CardMedia,
  CardContent,
  CardActions,
  Typography,
  IconButton,
  Box,
  Chip
} from '@mui/material';
import { PushPin, PushPinOutlined, LocationOn, Visibility, VisibilityOff } from '@mui/icons-material';
import { useReid } from '../../context/ReidContext';
import reidService from '../../services/reidService';
import { formatDate } from '../../utils/formatTime';

const PersonCard = ({ person, onClick, similarity }) => {
  const { isPinned, togglePin } = useReid();
  const pinned = isPinned(person.id);

  const handlePinClick = (e) => {
    e.stopPropagation();
    togglePin(person.id);
  };

  const imageUrl = reidService.getPersonImageUrl(person.id);
  const similarityPercent = similarity ? (similarity * 100).toFixed(1) : null;
  const isHidden = person.is_active === false;

  return (
    <Card
      elevation={0}
      sx={{
        height: '100%',
        display: 'flex',
        flexDirection: 'column',
        cursor: 'pointer',
        border: '1px solid',
        borderColor: isHidden ? 'rgba(251, 73, 52, 0.3)' : pinned ? '#fabd2f' : 'rgba(250, 189, 47, 0.2)',
        opacity: isHidden ? 0.6 : 1,
        boxShadow: '0 10px 40px -12px rgba(0, 0, 0, 0.4)',
        transition: 'all 0.3s cubic-bezier(0.4, 0, 0.2, 1)',
        position: 'relative',
        overflow: 'hidden',
        borderRadius: 2,
        '&::before': {
          content: '""',
          position: 'absolute',
          top: 0,
          left: 0,
          right: 0,
          height: '3px',
          background: 'linear-gradient(90deg, #d79921 0%, #d3869b 100%)',
          opacity: 0,
          transition: 'opacity 0.3s ease'
        },
        '&:hover': {
          transform: 'translateY(-8px)',
          boxShadow: '0 20px 60px -15px rgba(0, 0, 0, 0.6), 0 0 0 1px rgba(250, 189, 47, 0.2)',
          '&::before': {
            opacity: 1
          }
        }
      }}
      onClick={onClick}
    >
      <Box sx={{ position: 'relative' }}>
        <CardMedia
          component="img"
          height="200"
          image={imageUrl}
          alt={`Person ${person.id}`}
          sx={{
            objectFit: 'cover',
            backgroundColor: '#f5f5f5'
          }}
          onError={(e) => {
            e.target.src = 'data:image/svg+xml,%3Csvg xmlns="http://www.w3.org/2000/svg" width="200" height="200"%3E%3Crect fill="%23ddd" width="200" height="200"/%3E%3Ctext fill="%23999" x="50%25" y="50%25" dominant-baseline="middle" text-anchor="middle" font-family="sans-serif" font-size="16"%3ENo Image%3C/text%3E%3C/svg%3E';
          }}
        />

        {similarityPercent && (
          <Chip
            label={`${similarityPercent}% Match`}
            size="small"
            sx={{
              position: 'absolute',
              top: 8,
              right: 8,
              backgroundColor: '#b8bb26',
              color: 'white',
              fontWeight: 700,
              fontSize: '0.75rem'
            }}
          />
        )}

        {isHidden && (
          <Chip
            icon={<VisibilityOff sx={{ fontSize: 14 }} />}
            label="Hidden"
            size="small"
            sx={{
              position: 'absolute',
              top: 8,
              left: 8,
              backgroundColor: 'rgba(251, 73, 52, 0.85)',
              color: 'white',
              fontWeight: 600,
              fontSize: '0.7rem',
              height: 24,
              '& .MuiChip-icon': { color: 'white' }
            }}
          />
        )}

        {pinned && !isHidden && (
          <Box
            sx={{
              position: 'absolute',
              top: 8,
              left: 8,
              background: 'rgba(250, 189, 47, 0.9)',
              color: 'white',
              p: 0.5,
              borderRadius: 1,
              display: 'flex',
              alignItems: 'center'
            }}
          >
            <PushPin sx={{ fontSize: 16 }} />
          </Box>
        )}
      </Box>

      <CardContent sx={{ flexGrow: 1, p: 2 }}>
        <Typography
          variant="h6"
          component="div"
          gutterBottom
          sx={{
            fontWeight: 600,
            overflow: 'hidden',
            textOverflow: 'ellipsis',
            whiteSpace: 'nowrap',
            fontSize: '1rem'
          }}
        >
          ID: {person.id.substring(0, 8)}...
        </Typography>

        <Box sx={{ display: 'flex', flexDirection: 'column', gap: 0.5, mt: 1 }}>
          {person.created_at && (
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
              <LocationOn sx={{ fontSize: 14, color: 'text.secondary' }} />
              <Typography variant="caption" color="text.secondary">
                First: {formatDate(person.created_at)}
              </Typography>
            </Box>
          )}

          {person.last_seen_at && (
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
              <LocationOn sx={{ fontSize: 14, color: 'primary.main' }} />
              <Typography variant="caption" color="text.secondary">
                Last: {formatDate(person.last_seen_at)}
              </Typography>
            </Box>
          )}

          {person.total_sightings && (
            <Chip
              icon={<Visibility sx={{ fontSize: 14 }} />}
              label={`${person.total_sightings} sighting${person.total_sightings !== 1 ? 's' : ''}`}
              size="small"
              sx={{
                mt: 0.5,
                height: 24,
                fontSize: '0.75rem',
                backgroundColor: 'rgba(250, 189, 47, 0.2)',
                color: '#fabd2f',
                border: '1px solid',
                borderColor: 'rgba(250, 189, 47, 0.4)',
                fontWeight: 600,
                '& .MuiChip-icon': {
                  color: '#fabd2f'
                }
              }}
            />
          )}
        </Box>
      </CardContent>

      <CardActions
        sx={{
          justifyContent: 'space-between',
          px: 2,
          pb: 2,
          pt: 0
        }}
      >
        <Typography variant="caption" color="text.secondary">
          Click for details
        </Typography>
        <IconButton
          size="small"
          onClick={handlePinClick}
          sx={{
            color: pinned ? '#fabd2f' : 'text.secondary',
            transition: 'all 0.2s',
            '&:hover': {
              color: '#fabd2f',
              background: 'rgba(250, 189, 47, 0.1)'
            }
          }}
        >
          {pinned ? <PushPin /> : <PushPinOutlined />}
        </IconButton>
      </CardActions>
    </Card>
  );
};

export default PersonCard;
