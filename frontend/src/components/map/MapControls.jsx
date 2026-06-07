import React, { useContext, useState, useEffect, useRef } from "react";
import {
  Box,
  ToggleButtonGroup,
  ToggleButton,
  Divider,
  IconButton,
  Tooltip,
  Button,
  Snackbar,
  Alert,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  TextField,
  List,
  ListItem,
  ListItemText,
  ListItemIcon,
  Typography,
  CircularProgress,
  InputAdornment,
} from "@mui/material";
import {
  Satellite,
  Map as MapIcon,
  Terrain,
  ZoomIn,
  ZoomOut,
  MyLocation,
  Fullscreen,
  Search,
  Share,
  ContentCopy,
  Place,
  Close,
  LocationCity,
  Landscape,
  Public,
  Business,
  Whatshot, // Import fire icon
} from "@mui/icons-material";
import { useMap } from "../../context/MapContext";
import StreetViewControl from "./StreetViewControl";
import { Settings as SettingsIcon } from '@mui/icons-material';
import FireConfiguratorDialog from './FireConfiguratorDialog';

const MapControls = ({ map }) => {
  const { mapType, changeMapType, showFires, toggleShowFires, openFireConfigDialog } = useMap(); // Get fire state and toggle function
  const [snackbarOpen, setSnackbarOpen] = useState(false);

  // Search dialog state
  const [searchDialogOpen, setSearchDialogOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [searchResults, setSearchResults] = useState([]);
  const [isSearching, setIsSearching] = useState(false);
  const [searchError, setSearchError] = useState(null);

  // Handle map type change
  const handleMapTypeChange = (event, newType) => {
    if (newType !== null) {
      // Update map type in context
      changeMapType(newType);

      // Also update the URL parameter for map type
      const params = new URLSearchParams(window.location.search);
      params.set('type', newType);
      const newUrl = `${window.location.pathname}?${params.toString()}`;
      window.history.replaceState({ path: newUrl }, '', newUrl);
    }
  };

  // Handle zoom in
  const handleZoomIn = () => {
    if (map) {
      map.zoomIn();
    }
  };

  // Handle zoom out
  const handleZoomOut = () => {
    if (map) {
      map.zoomOut();
    }
  };

  // Handle locate me
  const handleLocateMe = () => {
    if (map) {
      map.locate({ setView: true, maxZoom: 16 });
    }
  };

  // Handle Share (copy current URL to clipboard)
  const handleShare = () => {
    navigator.clipboard.writeText(window.location.href)
      .then(() => {
        setSnackbarOpen(true);
      })
      .catch((error) => {
        console.error('Error copying URL to clipboard:', error);
      });
  };

  // Handle snackbar close
  const handleSnackbarClose = (event, reason) => {
    if (reason === 'clickaway') {
      return;
    }
    setSnackbarOpen(false);
  };

  // Create a ref for the search input
  const searchInputRef = useRef(null);

  // Open search dialog
  const handleOpenSearchDialog = () => {
    setSearchDialogOpen(true);
    setSearchQuery("");
    setSearchResults([]);
    setSearchError(null);
  };

  // Focus the search input when dialog opens
  useEffect(() => {
    if (searchDialogOpen && searchInputRef.current) {
      // Use a short timeout to ensure dialog is fully rendered
      const timer = setTimeout(() => {
        searchInputRef.current.focus();
      }, 100);
      return () => clearTimeout(timer);
    }
  }, [searchDialogOpen]);

  // Close search dialog
  const handleCloseSearchDialog = () => {
    setSearchDialogOpen(false);
  };

  // Handle search input change
  const handleSearchQueryChange = (event) => {
    setSearchQuery(event.target.value);
  };

  // Perform the search when Enter is pressed or after a delay
  useEffect(() => {
    if (!searchQuery.trim() || !searchDialogOpen) {
      setSearchResults([]);
      return;
    }

    const timer = setTimeout(() => {
      performSearch(searchQuery);
    }, 500); // Debounce search for 500ms

    return () => clearTimeout(timer);
  }, [searchQuery, searchDialogOpen]);

  // Search for locations using Nominatim API
  const performSearch = async (query) => {
    if (!query.trim()) return;

    setIsSearching(true);
    setSearchError(null);

    try {
      const response = await fetch(
        `https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(
          query
        )}&limit=10`
      );

      if (!response.ok) {
        throw new Error("Failed to fetch search results");
      }

      const data = await response.json();
      setSearchResults(data);
    } catch (error) {
      console.error("Error searching for location:", error);
      setSearchError("Error searching for location. Please try again.");
      setSearchResults([]);
    } finally {
      setIsSearching(false);
    }
  };

  // Handle search result selection
  const handleResultSelect = (result) => {
    if (map && result.lat && result.lon) {
      // Convert string coordinates to numbers
      const lat = parseFloat(result.lat);
      const lon = parseFloat(result.lon);

      // Center map on the selected location with animation
      map.flyTo([lat, lon], 14, { duration: 1.5 });

      // Close the dialog
      handleCloseSearchDialog();

      // Update URL parameters
      const params = new URLSearchParams(window.location.search);
      params.set('lat', lat.toFixed(6));
      params.set('lng', lon.toFixed(6));
      params.set('zoom', '14');
      const newUrl = `${window.location.pathname}?${params.toString()}`;
      window.history.replaceState({ path: newUrl }, '', newUrl);
    }
  };

  // Get appropriate icon based on location type
  const getLocationIcon = (type) => {
    switch (type) {
      case 'city':
        return <LocationCity />;
      case 'town':
      case 'village':
        return <Business />;
      case 'mountain':
      case 'peak':
      case 'hill':
        return <Landscape />;
      case 'country':
        return <Public />;
      default:
        return <Place />;
    }
  };

  return (
    <>
      <Box sx={{ display: "flex", flexDirection: "column", p: 1, }}>
        {/* Map Type Controls */}
        <ToggleButtonGroup
          value={mapType}
          exclusive
          onChange={handleMapTypeChange}
          aria-label="map type"
          size="small"
          sx={{ mb: 1, maxWidth: 100 }}
        >
          <ToggleButton value="satellite" aria-label="satellite">
            <Tooltip title="Satellite">
              <Satellite fontSize="small" />
            </Tooltip>
          </ToggleButton>
          {/* <ToggleButton value="street" aria-label="street">
            <Tooltip title="Street">
              <MapIcon fontSize="small" />
            </Tooltip>
          </ToggleButton> */}
          <ToggleButton value="terrain" aria-label="terrain">
            <Tooltip title="Terrain">
              <Terrain fontSize="small" />
            </Tooltip>
          </ToggleButton>
        </ToggleButtonGroup>

        {/* Fire Layer Toggle & Config */}
        <Box sx={{ display: 'flex', alignItems: 'center', mb: 1 }}>
          <ToggleButton
            value="fires"
            selected={showFires}
            onChange={toggleShowFires}
            aria-label="toggle fires"
            size="small"
            sx={{
              // maxWidth: 50, // Keep or adjust
              justifyContent: 'center',
              marginRight: 0.5, // Add some space
              ...(showFires && {
                backgroundColor: 'error.main', // Use theme's error color for red
                color: 'common.white', // Ensure icon is visible
                '&:hover': {
                  backgroundColor: 'error.dark',
                },
              }),
            }}
          >
            <Tooltip title={showFires ? "Hide Active Fires" : "Show Active Fires"}>
              {/* Icon color will be white due to parent sx when active */}
              <Whatshot fontSize="small" />
            </Tooltip>
          </ToggleButton>
          <Tooltip title="Configure Fire Layer">
            <IconButton onClick={openFireConfigDialog} size="small">
              <SettingsIcon fontSize="small" />
            </IconButton>
          </Tooltip>
        </Box>

        <Divider sx={{ my: 1 }} />

        {/* Zoom and Navigation Controls */}
        <Box sx={{ display: "flex", flexDirection: "column", gap: 1 }}>
          <Tooltip disableInteractive title="Zoom In">
            <Button size="small" onClick={handleZoomIn}>
              <ZoomIn fontSize="small" />
            </Button>
          </Tooltip>

          <Tooltip disableInteractive title="Zoom Out">
            <Button size="small" onClick={handleZoomOut}>
              <ZoomOut fontSize="small" />
            </Button>
          </Tooltip>

          <Divider sx={{ my: 0.5 }} />

          <Tooltip disableInteractive title="My Location">
            <Button size="small" onClick={handleLocateMe}>
              <MyLocation fontSize="small" />
            </Button>
          </Tooltip>

          <Tooltip disableInteractive title="Search Location">
            <Button size="small" onClick={handleOpenSearchDialog}>
              <Search fontSize="small" />
            </Button>
          </Tooltip>

          <Divider sx={{ my: 0.5 }} />

          {/* Street View Control */}
          <StreetViewControl map={map} />
        </Box>
      </Box>

      {/* Search Location Dialog */}
      <Dialog
        open={searchDialogOpen}
        onClose={handleCloseSearchDialog}
        fullWidth
        maxWidth="sm"
        TransitionProps={{
          onEntered: () => {
            // Focus input when dialog animation completes
            if (searchInputRef.current) {
              searchInputRef.current.focus();
            }
          }
        }}
      >
        <DialogTitle>
          Search Location
          <IconButton
            aria-label="close"
            onClick={handleCloseSearchDialog}
            sx={{
              position: 'absolute',
              right: 8,
              top: 8,
            }}
          >
            <Close />
          </IconButton>
        </DialogTitle>
        <DialogContent dividers>
          <TextField
            inputRef={searchInputRef}
            autoFocus
            margin="dense"
            id="location"
            label="Enter place, address or coordinates"
            type="text"
            fullWidth
            variant="outlined"
            value={searchQuery}
            onChange={handleSearchQueryChange}
            InputProps={{
              endAdornment: (
                <InputAdornment position="end">
                  {isSearching && <CircularProgress size={24} />}
                </InputAdornment>
              ),
            }}
            placeholder="Examples: New York, Eiffel Tower, 51.505,-0.09"
            onKeyPress={(e) => {
              if (e.key === 'Enter') {
                performSearch(searchQuery);
              }
            }}
          />

          {searchError && (
            <Typography color="error" variant="body2" sx={{ mt: 2 }}>
              {searchError}
            </Typography>
          )}

          {searchResults.length > 0 ? (
            <List sx={{ mt: 2 }}>
              {searchResults.map((result) => (
                <ListItem
                  button
                  key={result.place_id}
                  onClick={() => handleResultSelect(result)}
                  divider
                >
                  <ListItemIcon>
                    {getLocationIcon(result.type)}
                  </ListItemIcon>
                  <ListItemText
                    primary={result.display_name}
                    secondary={`${result.type || 'location'}`}
                  />
                </ListItem>
              ))}
            </List>
          ) : (
            !isSearching && searchQuery.trim() !== '' && (
              <Typography color="text.secondary" variant="body2" sx={{ mt: 2, textAlign: 'center' }}>
                No results found. Try another search term.
              </Typography>
            )
          )}
        </DialogContent>
      </Dialog>

      {/* Snackbar for copy confirmation */}
      <Snackbar
        open={snackbarOpen}
        autoHideDuration={3000}
        onClose={handleSnackbarClose}
        anchorOrigin={{ vertical: 'bottom', horizontal: 'center' }}
      >
        <Alert
          onClose={handleSnackbarClose}
          severity="success"
          sx={{ width: '100%' }}
        >
          Map URL copied to clipboard!
        </Alert>
      </Snackbar>

      <FireConfiguratorDialog />

    </>
  );
};

export default MapControls;