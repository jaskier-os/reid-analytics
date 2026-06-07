import React, { useState, useEffect, useRef } from "react";
import {
  Box,
  Button,
  Tooltip,
  Menu,
  MenuItem,
  ListItemIcon,
  ListItemText,
  Divider,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Typography,
  Alert,
  IconButton,
  Snackbar,
} from "@mui/material";
import "./StreetView.css";
import { 
  DirectionsWalk,
  Google,
  OpenInNew,
  LocationOn,
  Close,
  ArrowDropDown,
  Public 
} from "@mui/icons-material";
import L from "leaflet";
import { useMap } from "../../context/MapContext";

// Custom SVG for the street view person icon
const streetViewPersonSvg = `
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" width="36" height="36">
  <circle cx="12" cy="6" r="4" fill="#d79921" />
  <path d="M12 12c-2.8 0-5 2.2-5 5v7h10v-7c0-2.8-2.2-5-5-5z" fill="#d79921" />
  <circle cx="12" cy="6" r="4" fill="none" stroke="#fff" stroke-width="1" />
  <path d="M12 12c-2.8 0-5 2.2-5 5v7h10v-7c0-2.8-2.2-5-5-5z" fill="none" stroke="#fff" stroke-width="1" />
</svg>`;

// Street view person icon for the map
const streetViewPersonIcon = L.divIcon({
  className: "street-view-person-icon",
  html: `<div style="width: 36px; height: 36px;">${streetViewPersonSvg}</div>`,
  iconSize: [36, 36],
  iconAnchor: [18, 36],
});

// Active state icon with pulse animation
const streetViewPersonActiveIcon = L.divIcon({
  className: "street-view-person-icon street-view-person-active",
  html: `<div style="width: 36px; height: 36px;">${streetViewPersonSvg}</div>`,
  iconSize: [36, 36],
  iconAnchor: [18, 36],
});

// Street view providers configuration
const STREET_VIEW_PROVIDERS = [
  {
    id: 'google',
    name: 'Google Street View',
    icon: <Google />,
    url: 'https://www.google.com/maps?layer=c&cbll={lat},{lon}',
    bounds: false, // available globally
  },
//   {
//     id: 'bing',
//     name: 'Bing StreetSide',
//     icon: <Public />,
//     url: 'https://www.bing.com/maps?cp={lat}~{lon}&lvl=19&style=x&v=2',
//     bounds: [[25, -168], [71.4, 8.8]] // approximate bounds where available
//   },
  {
    id: 'yandex',
    name: 'Yandex Panoramas',
    icon: <Public />,
    url: 'https://yandex.ru/maps/?panorama%5Bpoint%5D={lon},{lat}',
    bounds: [[35.6, 18.5], [72, 180]] // approximate bounds where available
  }
];

const StreetViewControl = ({ map }) => {
  const [anchorEl, setAnchorEl] = useState(null);
  const [activeProvider, setActiveProvider] = useState(STREET_VIEW_PROVIDERS[0]);
  const [personMarker, setPersonMarker] = useState(null);
  const [isDragging, setIsDragging] = useState(false);
  const [infoDialogOpen, setInfoDialogOpen] = useState(false);
  const [noStreetViewAlert, setNoStreetViewAlert] = useState(false);
  
  // Reference to the draggable element
  const dragIconRef = useRef(null);
  
  // Clean up on unmount
  useEffect(() => {
    return () => {
      resetStreetViewMode();
    };
  }, []);

  // Handle menu open
  const handleMenuOpen = (event) => {
    setAnchorEl(event.currentTarget);
  };

  // Handle menu close
  const handleMenuClose = () => {
    setAnchorEl(null);
  };

  // Handle provider selection
  const handleProviderSelect = (provider) => {
    setActiveProvider(provider);
    handleMenuClose();
  };

  // Check if provider is available at given location
  const isProviderAvailable = (provider, latlng) => {
    if (!provider.bounds) return true;
    
    const bounds = L.latLngBounds(provider.bounds);
    return bounds.contains(latlng);
  };

  // Reset the street view mode
  const resetStreetViewMode = () => {
    if (personMarker) {
      personMarker.remove();
      setPersonMarker(null);
    }
    
    // Remove overlay and events
    if (map) {
      document.removeEventListener('mousemove', handleMouseMove);
      document.removeEventListener('mouseup', handleMouseUp);
      map.getContainer().classList.remove('street-view-cursor');
      map.dragging.enable();
      
      // Remove overlay if exists
      const overlay = document.getElementById('street-view-overlay');
      if (overlay) {
        overlay.remove();
      }
    }
    
    setIsDragging(false);
  };

  // Setup drag start
  const handleDragStart = (e) => {
    e.preventDefault();
    
    // Only proceed if we have a map
    if (!map) return;
    
    // Mark as dragging
    setIsDragging(true);
    
    // Disable map dragging while placing street view
    map.dragging.disable();
    
    // Add cursor style to map
    map.getContainer().classList.add('street-view-cursor');
    
    // Create an overlay div to track mouse position over the map
    const mapContainer = map.getContainer();
    const overlay = document.createElement('div');
    overlay.id = 'street-view-overlay';
    overlay.style.position = 'absolute';
    overlay.style.top = '0';
    overlay.style.left = '0';
    overlay.style.width = '100%';
    overlay.style.height = '100%';
    overlay.style.zIndex = '1000';
    overlay.style.cursor = 'none'; // Hide cursor
    mapContainer.appendChild(overlay);
    
    // Create a floating pegman that follows the cursor
    const pegman = document.createElement('div');
    pegman.id = 'floating-pegman';
    pegman.className = 'floating-street-view-icon';
    pegman.innerHTML = streetViewPersonSvg;
    document.body.appendChild(pegman);
    
    // Position pegman at cursor
    const updatePegmanPosition = (x, y) => {
      pegman.style.position = 'absolute';
      pegman.style.left = `${x - 18}px`; // Center horizontally
      pegman.style.top = `${y - 36}px`;  // Position bottom at cursor
      pegman.style.pointerEvents = 'none';
      pegman.style.zIndex = '10000';
    };
    
    // Initial position
    updatePegmanPosition(e.clientX, e.clientY);
    
    // Handle mouse movement
    const handleMouseMove = (e) => {
      updatePegmanPosition(e.clientX, e.clientY);
    };
    
    // Handle mouse up (drop)
    const handleMouseUp = (e) => {
      // Remove the floating pegman
      pegman.remove();
      
      // Get the coordinates where the pegman was dropped
      const mapRect = mapContainer.getBoundingClientRect();
      const x = e.clientX - mapRect.left;
      const y = e.clientY - mapRect.top;
      
      // Convert screen coordinates to map coordinates
      const point = L.point(x, y);
      const latlng = map.containerPointToLatLng(point);
      
      // Place the marker at the drop location
      placePegmanOnMap(latlng);
      
      // Remove overlay and events
      overlay.remove();
      document.removeEventListener('mousemove', handleMouseMove);
      document.removeEventListener('mouseup', handleMouseUp);
    };
    
    // Add event listeners
    document.addEventListener('mousemove', handleMouseMove);
    document.addEventListener('mouseup', handleMouseUp);
    
    // Store the handlers for cleanup
    this.handleMouseMove = handleMouseMove;
    this.handleMouseUp = handleMouseUp;
  };
  
  // Handle mouse move during drag
  const handleMouseMove = (e) => {
    // This is implemented within handleDragStart
  };
  
  // Handle mouse up (drop)
  const handleMouseUp = (e) => {
    // This is implemented within handleDragStart
  };
  
  // Place pegman marker on the map at the specified location
  const placePegmanOnMap = (latlng) => {
    // Remove any existing marker
    if (personMarker) {
      personMarker.remove();
    }
    
    // Create a new marker at the drop location
    const marker = L.marker(latlng, {
      icon: streetViewPersonActiveIcon,
      draggable: false
    }).addTo(map);
    
    // Store the marker reference
    setPersonMarker(marker);
    
    // Open street view after a short delay to show the animation
    setTimeout(() => {
      handleStreetViewOpen(latlng);
    }, 800);
  };

  // Handle opening the street view
  const handleStreetViewOpen = (latlng) => {
    // Check if the selected provider is available at this location
    if (!isProviderAvailable(activeProvider, latlng)) {
      setNoStreetViewAlert(true);
      setTimeout(() => setNoStreetViewAlert(false), 3000);
      resetStreetViewMode();
      return;
    }

    const url = activeProvider.url
      .replace(/{lat}/g, latlng.lat.toFixed(6))
      .replace(/{lon}/g, latlng.lng.toFixed(6));

    // Open the street view in a new tab
    window.open(url, '_blank');
    
    // Reset the street view mode
    resetStreetViewMode();
  };

  // Cancel street view mode
  const handleCancelStreetView = () => {
    resetStreetViewMode();
    setInfoDialogOpen(false);
  };

  return (
    <>
      <Box sx={{ 
        display: 'flex', 
        width: "100%",
        flexDirection: 'row', 
        alignItems: 'center',
        bgcolor: isDragging ? 'rgba(215, 153, 33, 0.1)' : 'transparent',
        borderRadius: 1,
        justifyContent: "center",
        transition: 'background-color 0.3s ease'
      }}>
        <Tooltip disableInteractive title="Drag to map for Street View">
          <Button 
            ref={dragIconRef}
            size="small"
            onMouseDown={handleDragStart}
            sx={{ 
              minWidth: 'auto', 
              display: 'flex', 
              alignItems: 'center',
              color: isDragging ? 'primary.main' : 'inherit',
              cursor: 'grab',
              '&:active': {
                cursor: 'grabbing',
              }
            }}
          >
            <div className="street-view-drag-button">
              <DirectionsWalk fontSize="small" />
            </div>
          </Button>
        </Tooltip>
        
        <Tooltip disableInteractive title="Choose Provider">
          <Button 
            size="small" 
            onClick={handleMenuOpen}
            sx={{ 
              minWidth: 'auto', 
              paddingLeft: 0,
              color: isDragging ? 'primary.main' : 'inherit'
            }}
          >
            <ArrowDropDown fontSize="small" />
          </Button>
        </Tooltip>
      </Box>

      {/* Provider selection menu */}
      <Menu
        anchorEl={anchorEl}
        open={Boolean(anchorEl)}
        onClose={handleMenuClose}
      >
        {STREET_VIEW_PROVIDERS.map((provider) => (
          <MenuItem 
            key={provider.id}
            onClick={() => handleProviderSelect(provider)}
            selected={provider.id === activeProvider.id}
          >
            <ListItemIcon>{provider.icon}</ListItemIcon>
            <ListItemText>{provider.name}</ListItemText>
          </MenuItem>
        ))}
      </Menu>

      {/* No Street View Available Alert */}
      <Snackbar
        open={noStreetViewAlert}
        autoHideDuration={3000}
        onClose={() => setNoStreetViewAlert(false)}
        anchorOrigin={{ vertical: 'bottom', horizontal: 'center' }}
      >
        <Alert 
          onClose={() => setNoStreetViewAlert(false)} 
          severity="warning" 
          sx={{ width: '100%' }}
        >
          Street View not available at this location with {activeProvider.name}
        </Alert>
      </Snackbar>
    </>
  );
};

export default StreetViewControl;