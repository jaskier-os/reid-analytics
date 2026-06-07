import React, { useState, useEffect, useRef } from "react";
import {
  Paper,
  Box,
  ToggleButtonGroup,
  ToggleButton,
  Divider,
  IconButton,
  Tooltip,
  Popover,
  Slider,
  Typography,
  Badge,
  CircularProgress,
  Snackbar,
  Alert
} from "@mui/material";
import {
  Create as Pencil,
  PanTool as Move,
  Timeline as Line,
  RadioButtonUnchecked as Circle,
  Square,
  Hexagon as Polygon,
  FormatColorFill as Fill,
  Undo,
  Redo,
  Delete,
} from "@mui/icons-material";
import L from "leaflet";
import "leaflet-draw";
import { useMap } from "../../context/MapContext";
import { useLeafletContext } from "../../context/LeafletContext";

// Color options for drawings
const COLOR_OPTIONS = [
  "#FF0000", // Red
  "#FFA500", // Orange
  "#FFFF00", // Yellow
  "#008000", // Green
  "#0000FF", // Blue
  "#4B0082", // Indigo
  "#800080", // Purple
  "#FFC0CB", // Pink
  "#000000", // Black
  "#FFFFFF", // White
];

const DrawingTools = () => {
  const [tool, setTool] = useState("move"); // Default to 'move' tool
  const [color, setColor] = useState("#FF0000");
  const [lineWidth, setLineWidth] = useState(6);
  const [colorAnchorEl, setColorAnchorEl] = useState(null);
  const [lineWidthAnchorEl, setLineWidthAnchorEl] = useState(null);
  const [isPencilActive, setIsPencilActive] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  const [error, setError] = useState(null);

  const currentDrawHandler = useRef(null);
  const currentPolyline = useRef(null);
  const previousTool = useRef("move");
  const handleUndoRef = useRef(null);
  const handleRedoRef = useRef(null);
  const handleToolChangeRef = useRef(null);

  // Get map context data
  const {
    clearActiveLayer,
    setDrawingStyles,
    addElementToLayer,
    activeDrawingTool,
    setActiveDrawingTool,
    undo,
    redo,
    activeLayerId,
    getLayerHistoryStates,
  } = useMap();

  // Get current layer's history states for UI display
  const [canUndo, setCanUndo] = useState(false);
  const [canRedo, setCanRedo] = useState(false);

  // Update history states whenever the active layer changes
  useEffect(() => {
    if (activeLayerId) {
      const historyStates = getLayerHistoryStates(activeLayerId);
      setCanUndo(historyStates.canUndo);
      setCanRedo(historyStates.canRedo);
    } else {
      setCanUndo(false);
      setCanRedo(false);
    }
  }, [activeLayerId, getLayerHistoryStates]);

  // Get the leaflet map instance from our custom context
  const { map, featureGroup } = useLeafletContext();

  useEffect(() => {
    if (activeDrawingTool && tool !== activeDrawingTool) {
      setTool(activeDrawingTool);

      // If tool is a drawing tool, set up the appropriate handler
      if (activeDrawingTool !== "move" && map && featureGroup) {
        handleToolChange(null, activeDrawingTool);
      }
    }
  }, [activeDrawingTool, map, featureGroup]);

  // Update the drawing styles whenever color or line width changes
  useEffect(() => {
    const styles = {
      color: color,
      weight: lineWidth,
      opacity: 1,
      fillColor: color,
      fillOpacity: 0.3,
    };

    setDrawingStyles(styles);

    // Update any active drawing handler with new styles
    if (
      currentDrawHandler.current &&
      typeof currentDrawHandler.current.setOptions === "function"
    ) {
      try {
        currentDrawHandler.current.setOptions({
          shapeOptions: styles,
        });
      } catch (error) {
        console.error("Error updating draw handler options:", error);
      }
    }
  }, [color, lineWidth, setDrawingStyles]);

  // Enable/disable map dragging based on selected tool
  useEffect(() => {
    if (!map) return;

    if (tool === "move") {
      // Enable map dragging when move tool is selected
      map.dragging.enable();
    } else {
      // Disable map dragging when any drawing tool is selected
      map.dragging.disable();
    }

    // Update active drawing tool in context
    setActiveDrawingTool(tool);

    // Clean up on unmount or tool change
    return () => {
      if (map && !map.dragging.enabled()) {
        map.dragging.enable();
      }
    };
  }, [tool, map, setActiveDrawingTool]);

  // Handle middle mouse button for temp switching to move tool
  useEffect(() => {
    if (!map) return;

    let isMiddleMouseDown = false;
    let originalDragState = false;

    // When the middle mouse button is pressed
    const handleMouseDown = (e) => {
      // Middle mouse button (button 1)
      if (e.button === 1) {
        e.preventDefault();
        e.stopPropagation();

        isMiddleMouseDown = true;

        // Store original drag state and enable dragging
        originalDragState = map.dragging.enabled();

        // Change cursor to indicate panning
        document.body.style.cursor = "grabbing";

        // Enable map dragging without triggering tool change
        if (!map.dragging.enabled()) {
          map.dragging.enable();
        }

        // Important: Don't artificially trigger mouse events as it can cause teleporting
      }
    };

    // When any mouse button is released
    const handleMouseUp = (e) => {
      // Check if middle mouse was down and now being released
      if (isMiddleMouseDown && e.button === 1) {
        e.preventDefault();
        e.stopPropagation();

        // Restore original dragging state
        if (!originalDragState && tool !== "move") {
          map.dragging.disable();
        }

        isMiddleMouseDown = false;
        document.body.style.cursor = "";
      }
    };

    // Handle mouse movement while middle button is pressed
    const handleMouseMove = (e) => {
      if (isMiddleMouseDown) {
        // If middle mouse is down, prevent other events from interfering
        e.stopPropagation();
      }
    };

    // Prevent browser's default behavior for middle click
    const preventDefaultMiddleClick = (e) => {
      if (e.button === 1) {
        e.preventDefault();
        return false;
      }
    };

    // Add event listeners
    document.addEventListener("mousedown", handleMouseDown, { passive: false });
    document.addEventListener("mouseup", handleMouseUp, { passive: false });
    document.addEventListener("mousemove", handleMouseMove, { passive: false });
    document.addEventListener("auxclick", preventDefaultMiddleClick, {
      passive: false,
    });

    if (map.getContainer()) {
      map
        .getContainer()
        .addEventListener("mousedown", preventDefaultMiddleClick, {
          passive: false,
        });
    }

    return () => {
      // Clean up all event listeners
      document.removeEventListener("mousedown", handleMouseDown);
      document.removeEventListener("mouseup", handleMouseUp);
      document.removeEventListener("mousemove", handleMouseMove);
      document.removeEventListener("auxclick", preventDefaultMiddleClick);

      if (map.getContainer()) {
        map
          .getContainer()
          .removeEventListener("mousedown", preventDefaultMiddleClick);
      }

      document.body.style.cursor = "";
    };
  }, [map, tool]);

  // Disable any active drawing modes
  const disableAllDrawingModes = () => {
    if (!map) return;

    // Disable current drawing handler if exists
    if (currentDrawHandler.current) {
      try {
        currentDrawHandler.current.disable();
      } catch (error) {
        console.error("Error disabling draw handler:", error);
      }
      currentDrawHandler.current = null;
    }

    // Disable pencil mode if active
    if (isPencilActive) {
      disablePencilMode();
    }
  };
  
  // Set up pencil drawing mode
  const enablePencilMode = () => {
    if (!map) return;

    setIsPencilActive(true);

    // Define event handlers for pencil drawing
    const handleMouseDown = (e) => {
      // Only respond to left mouse button (button code 0)
      if (e.originalEvent.button !== 0) return;

      // Create a new polyline on mouse down with current color and lineWidth
      // This ensures it uses the most up-to-date values
      currentPolyline.current = L.polyline([e.latlng], {
        color: color, // This will be the current color value
        weight: lineWidth, // This will be the current lineWidth value
        opacity: 1,
      }).addTo(map);

      // Add mousemove listener
      map.on("mousemove", handleMouseMove);
    };
    const handleMouseMove = (e) => {
      // Add points to the polyline as mouse moves
      if (currentPolyline.current) {
        currentPolyline.current.addLatLng(e.latlng);
      }
    };
    const handleMouseUp = async (e) => {
      // Only respond to left mouse button (button code 0)
      if (e.originalEvent.button !== 0) return;

      // Complete the polyline on mouse up
      if (currentPolyline.current) {
        // Remove mousemove handler
        map.off("mousemove", handleMouseMove);

        // Get the GeoJSON of the drawn polyline
        const geoJSON = currentPolyline.current.toGeoJSON();

        // Create a drawing element
        const drawingElement = {
          type: "polyline",
          geoJSON,
          style: {
            color: color,
            weight: lineWidth,
            opacity: 1,
          },
        };

        // Set loading state
        setIsLoading(true);
        setError(null);

        try {
          // Add to active layer
          await addElementToLayer(drawingElement);
          

        } catch (err) {
          console.error("Error adding drawing element:", err);
          setError("Failed to save your drawing. Please try again.");
        } finally {
          setIsLoading(false);
        }

        // Remove the temporary polyline from map
        map.removeLayer(currentPolyline.current);
        currentPolyline.current = null;
        
        // Update history state after adding an element
        if (activeLayerId) {
          const historyStates = getLayerHistoryStates(activeLayerId);
          setCanUndo(historyStates.canUndo);
          setCanRedo(historyStates.canRedo);
        }
      }
    };

    // Add event listeners to map
    map.on("mousedown", handleMouseDown);
    map.on("mouseup", handleMouseUp);

    // Store handlers for cleanup
    map._pencilHandlers = {
      mouseDown: handleMouseDown,
      mouseMove: handleMouseMove,
      mouseUp: handleMouseUp,
    };
  };
  useEffect(() => {
    // If pencil is active, recreate it with the new lineWidth
    if (isPencilActive && tool === "pencil") {
      disablePencilMode();
      enablePencilMode();
    }
  }, [lineWidth]);

  // Disable pencil drawing mode
  const disablePencilMode = () => {
    if (!map) return;

    setIsPencilActive(false);

    // Remove any active polyline
    if (currentPolyline.current) {
      map.removeLayer(currentPolyline.current);
      currentPolyline.current = null;
    }

    // Remove event listeners
    if (map._pencilHandlers) {
      map.off("mousedown", map._pencilHandlers.mouseDown);
      map.off("mousemove", map._pencilHandlers.mouseMove);
      map.off("mouseup", map._pencilHandlers.mouseUp);
      delete map._pencilHandlers;
    }
  };

  // Handle drawing tool selection
  const handleToolChange = (event, newTool) => {
    // If no tool selected, default to move
    if (!newTool) {
      newTool = "move";
    }

    // Disable all current drawing modes first
    disableAllDrawingModes();

    // If no map or feature group, just update the tool state
    if (!map || !featureGroup) {
      setTool(newTool);
      return;
    }

    // Set the selected tool
    setTool(newTool);

    // If move tool is selected, ensure map dragging is enabled and return
    if (newTool === "move") {
      map.dragging.enable();
      return;
    }

    // Otherwise, disable map dragging for drawing tools
    map.dragging.disable();

    // Set drawing styles
    const drawOptions = {
      shapeOptions: {
        color: color,
        weight: lineWidth,
        opacity: 1,
        fillColor: color,
        fillOpacity: 0.3,
      },
    };

    // Enable the selected drawing tool
    switch (newTool) {
      case "pencil":
        enablePencilMode();
        break;

      case "line":
        currentDrawHandler.current = new L.Draw.Polyline(map, drawOptions);
        currentDrawHandler.current.enable();
        break;

      case "circle":
        currentDrawHandler.current = new L.Draw.Circle(map, drawOptions);
        currentDrawHandler.current.enable();
        break;

      case "rectangle":
        currentDrawHandler.current = new L.Draw.Rectangle(map, drawOptions);
        currentDrawHandler.current.enable();
        break;

      case "polygon":
        currentDrawHandler.current = new L.Draw.Polygon(map, drawOptions);
        currentDrawHandler.current.enable();
        break;

      default:
        break;
    }
  };

  // Handle color picker open
  const handleColorClick = (event) => {
    setColorAnchorEl(event.currentTarget);
  };

  // Handle color picker close
  const handleColorClose = () => {
    setColorAnchorEl(null);
  };

  // Handle color selection
  const handleColorSelect = (selectedColor) => {
    setColor(selectedColor);
    handleColorClose();
  };

  // Handle line width slider open
  const handleLineWidthClick = (event) => {
    setLineWidthAnchorEl(event.currentTarget);
  };

  // Handle line width slider close
  const handleLineWidthClose = () => {
    setLineWidthAnchorEl(null);
  };

  // Handle line width change
  const handleLineWidthChange = (event, newValue) => {
    setLineWidth(newValue);
  };

  // Handle undo with history update
  const handleUndo = async () => {
    try {
      setIsLoading(true);
      await undo();

      // Update history state after undo
      if (activeLayerId) {
        const historyStates = getLayerHistoryStates(activeLayerId);
        setCanUndo(historyStates.canUndo);
        setCanRedo(historyStates.canRedo);
      }
    } catch (err) {
      console.error("Error performing undo:", err);
      setError("Failed to undo. Please try again.");
    } finally {
      setIsLoading(false);
    }
  };

  // Handle redo with history update
  const handleRedo = async () => {
    try {
      setIsLoading(true);
      await redo();

      // Update history state after redo
      if (activeLayerId) {
        const historyStates = getLayerHistoryStates(activeLayerId);
        setCanUndo(historyStates.canUndo);
        setCanRedo(historyStates.canRedo);
      }
    } catch (err) {
      console.error("Error performing redo:", err);
      setError("Failed to redo. Please try again.");
    } finally {
      setIsLoading(false);
    }
  };

  // Update refs when handlers change
  useEffect(() => {
    handleUndoRef.current = handleUndo;
    handleRedoRef.current = handleRedo;
    handleToolChangeRef.current = handleToolChange;
  });

  // Handle clear layer with history update
  const handleClearLayer = async () => {
    if (!activeLayerId) return;
    
    try {
      setIsDeleting(true);
      setError(null);
      
      // Clear active layer via API
      await clearActiveLayer();
      
      // Clear local drawing modes
      disableAllDrawingModes();
      setTool("move");
      
      
      // Update history state after clearing
      if (activeLayerId) {
        const historyStates = getLayerHistoryStates(activeLayerId);
        setCanUndo(historyStates.canUndo);
        setCanRedo(historyStates.canRedo);
      }
    } catch (err) {
      console.error("Error clearing layer:", err);
      setError("Failed to clear the layer. Please try again.");
    } finally {
      setIsDeleting(false);
    }
  };

  // Handle closing the error notification
  const handleErrorClose = () => {
    setError(null);
  };

  // Setup global keyboard shortcuts
  useEffect(() => {
    const handleKeyDown = (e) => {
      // Only handle keyboard shortcuts if not in input fields
      if (e.target.tagName === "INPUT" || e.target.tagName === "TEXTAREA") {
        return;
      }

      // Check for Ctrl+Z (Undo)
      if (e.ctrlKey && e.key === "z") {
        e.preventDefault();
        if (handleUndoRef.current) handleUndoRef.current();
        return;
      }

      // Check for Ctrl+Y (Redo)
      if (e.ctrlKey && e.key === "y") {
        e.preventDefault();
        if (handleRedoRef.current) handleRedoRef.current();
        return;
      }

      // Map key codes to tools
      switch (e.key) {
        case "1":
          if (handleToolChangeRef.current) handleToolChangeRef.current(null, "move");
          break;
        case "2":
          if (handleToolChangeRef.current) handleToolChangeRef.current(null, "pencil");
          break;
        case "3":
          if (handleToolChangeRef.current) handleToolChangeRef.current(null, "line");
          break;
        case "4":
          if (handleToolChangeRef.current) handleToolChangeRef.current(null, "circle");
          break;
        case "5":
          if (handleToolChangeRef.current) handleToolChangeRef.current(null, "polygon");
          break;
        default:
          break;
      }
    };

    // Add keyboard shortcut listeners
    window.addEventListener("keydown", handleKeyDown);

    // Cleanup
    return () => {
      window.removeEventListener("keydown", handleKeyDown);
    };
  }, []);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      disableAllDrawingModes();
      if (map && !map.dragging.enabled()) {
        map.dragging.enable();
      }
      // Reset any cursors
      document.body.style.cursor = "";
    };
  }, [map]);

  // Color picker status
  const colorPickerOpen = Boolean(colorAnchorEl);
  const colorPickerId = colorPickerOpen ? "color-popover" : undefined;

  // Line width slider status
  const lineWidthOpen = Boolean(lineWidthAnchorEl);
  const lineWidthId = lineWidthOpen ? "line-width-popover" : undefined;

  return (
    <>
      <Paper
        elevation={3}
        sx={{
          display: 'flex',
          flexDirection: 'column',
          gap: 1,
          position: 'relative',
          alignItems: "center"
        }}
      >
        {isLoading && (
          <CircularProgress 
            size={24} 
            sx={{ 
              position: 'absolute',
              top: '50%',
              left: '50%',
              marginTop: '-12px',
              marginLeft: '-12px',
              zIndex: 1
            }} 
          />
        )}
        <Box sx={{ 
          opacity: isLoading ? 0.5 : 1,
          pointerEvents: isLoading ? 'none' : 'auto',
          display: 'flex',
          width: "100%",
          flexDirection: 'column',
          alignItems: "center"
        }}>
          {/* Drawing Tools */}
          <ToggleButtonGroup
            value={tool}
            exclusive
            onChange={handleToolChange}
            aria-label="drawing tool"
            size="small"
            orientation="vertical"
            sx={{width: "100%",}}
          >
            <ToggleButton value="move" aria-label="move">
              <Tooltip title="Move & Select (1)" placement="right">
                <Move fontSize="small" />
              </Tooltip>
            </ToggleButton>
            <ToggleButton
              value="pencil"
              aria-label="pencil"
              color={isPencilActive ? "primary" : "default"}
            >
              <Tooltip title="Pencil (Freehand Drawing) (2)" placement="right">
                <Pencil fontSize="small" />
              </Tooltip>
            </ToggleButton>
            <ToggleButton value="line" aria-label="line">
              <Tooltip title="Line (3)" placement="right">
                <Line fontSize="small" />
              </Tooltip>
            </ToggleButton>
            <ToggleButton value="circle" aria-label="circle">
              <Tooltip title="Circle (4)" placement="right">
                <Circle fontSize="small" />
              </Tooltip>
            </ToggleButton>
            <ToggleButton value="polygon" aria-label="polygon">
              <Tooltip title="Polygon (5)" placement="right">
                <Polygon fontSize="small" />
              </Tooltip>
            </ToggleButton>
          </ToggleButtonGroup>

          <Divider />

          {/* Styling and Utility Tools */}
          <Box
            sx={{
              display: "flex",
              flexDirection: "column",
              gap: 0.5,
              alignItems: "center",
            }}
          >
            <Tooltip title="Fill Color" placement="right">
              <IconButton
                size="small"
                onClick={handleColorClick}
                sx={{
                  border: `2px solid ${color}`,
                  padding: 0.5,
                  backgroundColor: color,
                  "&:hover": {
                    backgroundColor: color,
                    opacity: 0.8,
                  },
                }}
              >
                <Fill
                  fontSize="small"
                  sx={{ color: color === "#FFFFFF" ? "#000000" : "#FFFFFF" }}
                />
              </IconButton>
            </Tooltip>

            <Tooltip title="Line Width" placement="right">
              <IconButton size="small" onClick={handleLineWidthClick}>
                <Box
                  sx={{
                    height: `${lineWidth}px`,
                    width: "16px",
                    backgroundColor: "black",
                    borderRadius: "1px",
                    my: "8px",
                  }}
                />
              </IconButton>
            </Tooltip>
          </Box>

          <Divider />

          {/* History and Actions */}
          <Box
            sx={{
              display: "flex",
              flexDirection: "column",
              gap: 0.5,
              alignItems: "center",
            }}
          >
            <Tooltip title="Undo (Ctrl+Z)" placement="right">
              <span>
                <IconButton
                  size="small"
                  onClick={handleUndo}
                  disabled={!canUndo || isLoading}
                >
                  <Undo fontSize="small" />
                </IconButton>
              </span>
            </Tooltip>

            <Tooltip title="Redo (Ctrl+Y)" placement="right">
              <span>
                <IconButton
                  size="small"
                  onClick={handleRedo}
                  disabled={!canRedo || isLoading}
                >
                  <Redo fontSize="small" />
                </IconButton>
              </span>
            </Tooltip>

            <Divider sx={{ my: 0.5 }} />

            <Tooltip title="Clear Layer" placement="right">
              <span>
                <IconButton
                  size="small"
                  onClick={handleClearLayer}
                  disabled={!activeLayerId || isDeleting}
                  color="error"
                >
                  {isDeleting ? (
                    <CircularProgress size={16} />
                  ) : (
                    <Delete fontSize="small" />
                  )}
                </IconButton>
              </span>
            </Tooltip>
          </Box>

          {/* Keyboard shortcuts help */}
          <Box sx={{ mt: 1, px: 1 }}>
            <Typography variant="caption" color="text.secondary">
              Shortcuts:
            </Typography>
            <Typography variant="caption" display="block" color="text.secondary">
              1-5: Tools
            </Typography>
            <Typography variant="caption" display="block" color="text.secondary">
              Ctrl+Z: Undo
            </Typography>
            <Typography variant="caption" display="block" color="text.secondary">
              Ctrl+Y: Redo
            </Typography>
          </Box>
        </Box>
      </Paper>

      {/* Color Picker Popover */}
      <Popover
        id={colorPickerId}
        open={colorPickerOpen}
        anchorEl={colorAnchorEl}
        onClose={handleColorClose}
        anchorOrigin={{
          vertical: "center",
          horizontal: "right",
        }}
        transformOrigin={{
          vertical: "center",
          horizontal: "left",
        }}
      >
        <Box
          sx={{
            display: "grid",
            gridTemplateColumns: "repeat(5, 1fr)",
            gap: 0.5,
            p: 1,
          }}
        >
          {COLOR_OPTIONS.map((colorOption) => (
            <Box
              key={colorOption}
              onClick={() => handleColorSelect(colorOption)}
              sx={{
                width: 24,
                height: 24,
                backgroundColor: colorOption,
                border: "1px solid #ccc",
                borderRadius: "4px",
                cursor: "pointer",
                "&:hover": {
                  opacity: 0.8,
                },
                outline: colorOption === color ? `2px solid #000` : "none",
              }}
            />
          ))}
        </Box>
      </Popover>

      {/* Line Width Popover */}
      <Popover
        id={lineWidthId}
        open={lineWidthOpen}
        anchorEl={lineWidthAnchorEl}
        onClose={handleLineWidthClose}
        anchorOrigin={{
          vertical: "center",
          horizontal: "right",
        }}
        transformOrigin={{
          vertical: "center",
          horizontal: "left",
        }}
        PaperProps={{
          sx: {
            overflow: "visible", // This ensures content isn't cut off
            p: 2, // Add padding to the paper component
            width: 200, // Set a fixed width
            "& .MuiSlider-markLabel": {
              fontSize: "0.8rem", // Make mark labels smaller if needed
            },
          },
        }}
      >
        <Box
          sx={{
            width: "100%",
            px: 1, // Add horizontal padding inside the box
            pb: 1, // Add bottom padding
          }}
        >
          <Typography id="line-width-slider" gutterBottom variant="body2">
            Line Width: {lineWidth}px
          </Typography>
          <Slider
            value={lineWidth}
            onChange={handleLineWidthChange}
            aria-labelledby="line-width-slider"
            min={1}
            max={12}
            step={1}
            marks
            valueLabelDisplay="auto"
          />
        </Box>
      </Popover>
      
      {/* Error Notification */}
      <Snackbar
        open={!!error}
        autoHideDuration={6000}
        onClose={handleErrorClose}
        anchorOrigin={{ vertical: "bottom", horizontal: "right" }}
      >
        <Alert onClose={handleErrorClose} severity="error" sx={{ width: '100%' }}>
          {error}
        </Alert>
      </Snackbar>

    </>
  );
};

export default DrawingTools;