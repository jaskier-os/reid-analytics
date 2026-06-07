import React, { useState } from 'react';
import { Box, Typography, Chip, Grid, Link, Modal, Divider } from '@mui/material';
import { PhotoCamera, OpenInNew, Person } from '@mui/icons-material';
import OsintSection from './OsintSection';

const BACKEND_URL = '';

const getSimilarityColor = (similarity) => {
  if (similarity >= 90) return '#b8bb26';
  if (similarity >= 70) return '#fabd2f';
  return '#fb4934';
};

const SherlockPhotoSection = ({ data, onQuery }) => {
  const [lightboxPhoto, setLightboxPhoto] = useState(null);

  if (!data) return null;

  const { persons, similarities, totalResults } = data;
  if (!persons?.length) return null;

  return (
    <OsintSection
      title="Photo Matches"
      icon={<PhotoCamera fontSize="small" />}
      chipLabel={`${totalResults || persons.length} match${(totalResults || persons.length) !== 1 ? 'es' : ''}`}
    >
      {/* Person cards with their photos */}
      {persons.map((person, i) => {
        const similarity = person.similarity || similarities?.[i];
        const simColor = similarity != null ? getSimilarityColor(similarity) : null;
        const vkUrl = person.vk?.url || person.vkUrl;
        const personPhotos = person.photos || [];

        return (
          <Box
            key={i}
            sx={{
              mb: 2,
              p: 1.5,
              borderRadius: 1.5,
              border: '1px solid',
              borderColor: similarity >= 90
                ? 'rgba(184, 187, 38, 0.2)'
                : 'rgba(250, 189, 47, 0.1)',
              background: 'rgba(40, 40, 40, 0.4)'
            }}
          >
            {/* Identifiers row */}
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, flexWrap: 'wrap', mb: personPhotos.length > 0 ? 1 : 0 }}>
              {/* Confidence */}
              {similarity != null && (
                <Chip
                  label={`${similarity}%`}
                  size="small"
                  sx={{
                    backgroundColor: `${simColor}22`,
                    color: simColor,
                    border: '1px solid',
                    borderColor: `${simColor}55`,
                    fontWeight: 700,
                    fontSize: '0.8rem',
                    height: 24,
                    minWidth: 48
                  }}
                />
              )}

              {/* Name */}
              {(() => {
                const name = person.fullName || person.firstName;
                const canQuery = name && person.dateOfBirth;
                return name ? (
                  <Typography
                    variant="body2"
                    onClick={canQuery ? () => onQuery?.('name', `${name} ${person.dateOfBirth}`) : undefined}
                    sx={{
                      fontWeight: 700,
                      ...(canQuery ? { cursor: 'pointer', '&:hover': { color: '#fabd2f', textDecoration: 'underline' } } : {})
                    }}
                    noWrap
                  >
                    {name}
                  </Typography>
                ) : (
                  <Typography variant="body2" sx={{ fontWeight: 700, color: 'text.disabled' }} noWrap>Unknown</Typography>
                );
              })()}

              {person.dateOfBirth && (
                <Chip label={person.dateOfBirth} size="small" variant="outlined" sx={{ fontSize: '0.7rem', height: 20, borderColor: 'rgba(255,255,255,0.15)' }} />
              )}
              {person.age != null && (
                <Chip label={`${person.age} y/o`} size="small" variant="outlined" sx={{ fontSize: '0.7rem', height: 20, borderColor: 'rgba(255,255,255,0.15)' }} />
              )}
              {person.city && (
                <Chip label={person.city} size="small" variant="outlined" sx={{ fontSize: '0.7rem', height: 20, borderColor: 'rgba(255,255,255,0.15)' }} />
              )}
              {person.phone && (
                <Chip
                  label={person.phone}
                  size="small"
                  clickable
                  onClick={() => onQuery?.('phone', person.phone)}
                  sx={{ fontFamily: 'monospace', fontSize: '0.7rem', height: 20, backgroundColor: 'rgba(184, 187, 38, 0.15)', color: '#b8bb26', cursor: 'pointer', '&:hover': { outline: '1px solid #fabd2f', outlineOffset: 1 } }}
                />
              )}
              {vkUrl && (
                <Typography
                  component="span"
                  onClick={() => {
                    const vkId = vkUrl.replace(/^https?:\/\/(vk\.com|m\.vk\.com)\//, '').replace(/\/$/, '');
                    onQuery?.('username', vkId, vkUrl);
                  }}
                  sx={{
                    fontSize: '0.7rem',
                    fontFamily: 'monospace',
                    color: '#83a598',
                    cursor: 'pointer',
                    wordBreak: 'break-all',
                    '&:hover': { color: '#fabd2f', textDecoration: 'underline' }
                  }}
                >
                  <OpenInNew sx={{ fontSize: 10, mr: 0.3, verticalAlign: 'middle' }} />
                  {vkUrl}
                </Typography>
              )}
            </Box>

            {/* This person's photos */}
            {personPhotos.length > 0 && (
              <Grid container spacing={0.5}>
                {personPhotos.map((filename, j) => {
                  if (!filename) return null;
                  const photoUrl = `${BACKEND_URL}/api/reid/osint-photos/${filename}`;
                  return (
                    <Grid key={j} size={{ xs: 3, sm: 2 }}>
                      <Box
                        onClick={() => setLightboxPhoto(photoUrl)}
                        sx={{
                          aspectRatio: '3/4',
                          borderRadius: 1,
                          overflow: 'hidden',
                          border: '1px solid',
                          borderColor: 'rgba(255,255,255,0.1)',
                          cursor: 'pointer',
                          '&:hover': { borderColor: '#fabd2f' }
                        }}
                      >
                        <Box
                          component="img"
                          src={photoUrl}
                          alt={`${person.fullName || 'Match'} photo ${j + 1}`}
                          sx={{ width: '100%', height: '100%', objectFit: 'cover' }}
                        />
                      </Box>
                    </Grid>
                  );
                })}
              </Grid>
            )}
          </Box>
        );
      })}

      {/* Lightbox */}
      <Modal open={!!lightboxPhoto} onClose={() => setLightboxPhoto(null)}>
        <Box
          onClick={() => setLightboxPhoto(null)}
          sx={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            height: '100%',
            cursor: 'pointer'
          }}
        >
          <Box
            component="img"
            src={lightboxPhoto}
            sx={{
              maxWidth: '90vw',
              maxHeight: '90vh',
              borderRadius: 2,
              boxShadow: '0 8px 32px rgba(0,0,0,0.8)'
            }}
          />
        </Box>
      </Modal>
    </OsintSection>
  );
};

export default SherlockPhotoSection;
