import React, { useState } from 'react';
import { Box, Paper, Typography, Chip, Collapse, IconButton } from '@mui/material';
import { ExpandMore, ExpandLess } from '@mui/icons-material';

const OsintSection = ({ title, icon, children, defaultExpanded = true, chipLabel, chipColor }) => {
  const [expanded, setExpanded] = useState(defaultExpanded);

  return (
    <Paper
      elevation={0}
      sx={{
        mb: 2,
        border: '1px solid',
        borderColor: 'rgba(250, 189, 47, 0.15)',
        borderRadius: 2,
        overflow: 'hidden'
      }}
    >
      <Box
        onClick={() => setExpanded(prev => !prev)}
        sx={{
          display: 'flex',
          alignItems: 'center',
          gap: 1,
          p: 1.5,
          cursor: 'pointer',
          userSelect: 'none',
          '&:hover': { background: 'rgba(250, 189, 47, 0.05)' }
        }}
      >
        {icon && (
          <Box sx={{ color: '#fabd2f', display: 'flex', alignItems: 'center' }}>
            {icon}
          </Box>
        )}
        <Typography variant="subtitle2" sx={{ fontWeight: 600, flex: 1 }}>
          {title}
        </Typography>
        {chipLabel && (
          <Chip
            size="small"
            label={chipLabel}
            sx={{
              backgroundColor: chipColor ? `${chipColor}33` : 'rgba(250, 189, 47, 0.2)',
              color: chipColor || '#fabd2f',
              border: '1px solid',
              borderColor: chipColor ? `${chipColor}66` : 'rgba(250, 189, 47, 0.4)',
              fontWeight: 600,
              fontSize: '0.7rem',
              height: 22
            }}
          />
        )}
        <IconButton size="small" sx={{ color: 'text.secondary' }}>
          {expanded ? <ExpandLess fontSize="small" /> : <ExpandMore fontSize="small" />}
        </IconButton>
      </Box>
      <Collapse in={expanded}>
        <Box sx={{ p: 2, pt: 0 }}>
          {children}
        </Box>
      </Collapse>
    </Paper>
  );
};

export default OsintSection;
