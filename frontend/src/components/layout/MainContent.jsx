import React from 'react';
import { Box } from '@mui/material';
import MapView from '../map/MapView';

const MainContent = ({ activeView }) => {
  return (
    <Box
      component="main"
      sx={{
        flexGrow: 1,
        p: 0,
        height: '100vh',
        overflow: 'hidden',
        display: 'flex',
        flexDirection: 'column',
      }}
    >
      <MapView />
    </Box>
  );
};

export default MainContent;