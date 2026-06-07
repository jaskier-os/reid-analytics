import React, { useState } from 'react';
import { Box, CssBaseline } from '@mui/material';
import LeftSidebar from './LeftSidebar';
import RightSidebar from './RightSidebar';
import MainContent from './MainContent';

const Layout = () => {
  const [activeView, setActiveView] = useState('map'); // 'map' or 'whiteboard'

  return (
    <Box sx={{ display: 'flex', height: '100vh', overflow: 'hidden' }}>
      <CssBaseline />
      
      {/* Left Sidebar - Navigation */}
      <LeftSidebar 
        activeView={activeView} 
        setActiveView={setActiveView} 
      />
      
      {/* Main Content Area */}
      <MainContent activeView={activeView} />
      
      {/* Right Sidebar - Layers or Whiteboards */}
      <RightSidebar activeView={activeView} />
    </Box>
  );
};

export default Layout;