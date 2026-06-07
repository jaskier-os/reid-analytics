import React, { createContext, useContext, useState, useEffect } from 'react';
import { useMap } from './MapContext';

const DrawContext = createContext();

export function useDraw() {
  return useContext(DrawContext);
}

export function DrawProvider({ children }) {
  const [mapInstance, setMapInstance] = useState(null);
  const [drawControl, setDrawControl] = useState(null);
  const { activeDrawingTool } = useMap();

  // Handle drawing tool changes from MapContext
  useEffect(() => {
    if (mapInstance && drawControl && activeDrawingTool) {
      // This allows for synchronization between context values if needed
      console.log(`Drawing tool changed to: ${activeDrawingTool}`);
    }
  }, [mapInstance, drawControl, activeDrawingTool]);

  const value = {
    mapInstance,
    setMapInstance,
    drawControl,
    setDrawControl
  };

  return (
    <DrawContext.Provider value={value}>
      {children}
    </DrawContext.Provider>
  );
}