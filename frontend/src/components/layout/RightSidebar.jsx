import React from 'react';
import {
  Drawer,
  Box
} from '@mui/material';
import LayerList from '../map/LayerList';

const drawerWidth = 280;

const RightSidebar = ({ activeView }) => {
  return (
    <Box sx={{ position: 'relative' }}>
      <Drawer
        variant="persistent"
        anchor="right"
        open={true}
        sx={{
          width: drawerWidth,
          flexShrink: 0,
          '& .MuiDrawer-paper': {
            width: drawerWidth,
            boxSizing: 'border-box',
            borderLeft: '1px solid rgba(250, 189, 47, 0.1)',
            height: '100vh',
            background: 'rgba(60, 56, 54, 0.7)',
            backdropFilter: 'blur(20px)',
          },
        }}
      >
        <Box sx={{ p: 2 }}>
          {activeView === 'map' && <LayerList />}
        </Box>
      </Drawer>
    </Box>
  );
};

export default RightSidebar;
