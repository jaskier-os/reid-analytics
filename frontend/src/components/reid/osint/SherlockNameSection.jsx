import React from 'react';
import { Box, Typography, Chip } from '@mui/material';
import { Badge, OpenInNew } from '@mui/icons-material';
import OsintSection from './OsintSection';

const SherlockNameSection = ({ data }) => {
  if (!data) return null;

  const { matchCount, reportUrl } = data;

  return (
    <OsintSection
      title="Name Lookup"
      icon={<Badge fontSize="small" />}
      chipLabel={matchCount != null ? `${matchCount} matches` : undefined}
    >
      <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5 }}>
        {matchCount != null && (
          <Typography variant="body2" color="text.secondary">
            Found {matchCount} match{matchCount !== 1 ? 'es' : ''}
          </Typography>
        )}
        {reportUrl && (
          <Chip
            label="View Report"
            size="small"
            component="a"
            href={reportUrl}
            target="_blank"
            rel="noopener noreferrer"
            clickable
            icon={<OpenInNew sx={{ fontSize: '0.8rem !important' }} />}
            sx={{
              backgroundColor: 'rgba(250, 189, 47, 0.15)',
              color: '#fabd2f',
              '&:hover': { backgroundColor: 'rgba(250, 189, 47, 0.3)' }
            }}
          />
        )}
      </Box>
    </OsintSection>
  );
};

export default SherlockNameSection;
