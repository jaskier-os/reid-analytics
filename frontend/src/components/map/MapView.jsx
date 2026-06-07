import React, { useState, useEffect, useRef, useCallback } from "react";
import { Box, Paper, Typography, Chip } from "@mui/material";
import {
  MapContainer,
  TileLayer,
  FeatureGroup,
  useMap as useLeafletMap,
  GeoJSON,
  Circle,
  WMSTileLayer, // Import WMSTileLayer
} from "react-leaflet";
import "leaflet/dist/leaflet.css";
import "leaflet-draw/dist/leaflet.draw.css";
import { useMap } from "../../context/MapContext";
import { useLeafletContext } from "../../context/LeafletContext";
import MapControls from "./MapControls";
import DrawingTools from "./DrawingPanel";
import ReidMapMarkers from "./ReidMapMarkers";
import RecentPeoplePanel from "./RecentPeoplePanel";
import SightingsPanel from "./SightingsPanel";
import { v4 as uuidv4 } from "uuid";

// Fix for Leaflet icons
import L from "leaflet";
import iconRetinaUrl from "leaflet/dist/images/marker-icon-2x.png";
import iconUrl from "leaflet/dist/images/marker-icon.png";
import shadowUrl from "leaflet/dist/images/marker-shadow.png";

delete L.Icon.Default.prototype._getIconUrl;

L.Icon.Default.mergeOptions({
  iconRetinaUrl,
  iconUrl,
  shadowUrl,
});

// Backend tile proxy
const BACKEND_URL = '';

// Tile layers for different map types (proxied through backend with MongoDB cache)
const TILE_LAYERS = {
  satellite: {
    url: `${BACKEND_URL}/api/tiles/map/google-satellite/{z}/{x}/{y}`,
    attribution: "Google Satellite",
    maxZoom: 20,
  },
  street: {
    url: `${BACKEND_URL}/api/tiles/map/osm/{z}/{x}/{y}`,
    attribution:
      '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors',
    maxZoom: 19,
  },
  terrain: {
    url: `${BACKEND_URL}/api/tiles/map/google-terrain/{z}/{x}/{y}`,
    attribution: "Google Terrain",
    maxZoom: 20,
  },
};

// NASA FIRMS WMS Configuration
const FIRMS_WMS_URL = `${BACKEND_URL}/api/tiles/fires/firms`;

// Parse URL parameters or return defaults
const parseMapParamsFromUrl = () => {
  try {
    const params = new URLSearchParams(window.location.search);

    // Check if we have all needed params
    if (params.has("lat") && params.has("lng") && params.has("zoom")) {
      const lat = parseFloat(params.get("lat"));
      const lng = parseFloat(params.get("lng"));
      const zoom = parseInt(params.get("zoom"), 10);

      // Validate values to make sure they're within reasonable range
      if (
        !isNaN(lat) &&
        !isNaN(lng) &&
        !isNaN(zoom) &&
        lat >= -90 &&
        lat <= 90 &&
        lng >= -180 &&
        lng <= 180 &&
        zoom >= 0 &&
        zoom <= 22
      ) {
        return {
          center: [lat, lng],
          zoom,
        };
      }
    }
  } catch (error) {
    console.error("Error parsing map parameters from URL:", error);
  }

  // Return null if params not found or invalid
  return null;
};

// Component to capture and set the Leaflet map instance
const LeafletMapSetter = () => {
  const map = useLeafletMap();
  const { setMap } = useLeafletContext();

  useEffect(() => {
    if (map) {
      setMap(map);
    }
  }, [map, setMap]);

  return null;
};

// Component to set up all the drawing event handlers
const DrawingEventHandler = () => {
  const map = useLeafletMap();
  const {
    addElementToLayer,
    activeLayerId,
    removeElementFromLayer,
    updateElementInLayer,
    drawingStyles,
  } = useMap();
  const { featureGroup } = useLeafletContext();

  const drawingStylesRef = useRef(drawingStyles);
  const activeLayerIdRef = useRef(activeLayerId);
  const addElementToLayerRef = useRef(addElementToLayer);
  const removeElementFromLayerRef = useRef(removeElementFromLayer);
  const updateElementInLayerRef = useRef(updateElementInLayer);

  useEffect(() => {
    drawingStylesRef.current = drawingStyles;
    activeLayerIdRef.current = activeLayerId;
    addElementToLayerRef.current = addElementToLayer;
    removeElementFromLayerRef.current = removeElementFromLayer;
    updateElementInLayerRef.current = updateElementInLayer;
  });

  useEffect(() => {
    if (!map || !featureGroup) return;

    // Handler for created drawings
    const handleCreated = (e) => {
      const { layerType, layer } = e;

      if (!activeLayerIdRef.current) return;

      // Generate a unique ID for this element
      const elementId = uuidv4();

      // Store the ID on the layer for reference
      layer._uniqueId = elementId;

      // Add the layer to the feature group for edit/delete operations
      featureGroup.addLayer(layer);

      // Convert drawing to GeoJSON
      const geoJSON = layer.toGeoJSON();

      // For circles, save the radius as a property
      if (layerType === "circle") {
        geoJSON.properties = geoJSON.properties || {};
        geoJSON.properties.radius = layer.getRadius();
      }

      // Capture style properties
      const style = {
        color: layer.options.color || drawingStylesRef.current.color,
        weight: layer.options.weight || drawingStylesRef.current.weight,
        opacity: layer.options.opacity || drawingStylesRef.current.opacity,
        fillColor: layer.options.fillColor || drawingStylesRef.current.fillColor,
        fillOpacity: layer.options.fillOpacity || drawingStylesRef.current.fillOpacity,
      };

      // Create drawing element
      const drawingElement = {
        id: elementId,
        type: layerType,
        geoJSON,
        style,
        leafletLayerId: layer._leaflet_id, // Store the Leaflet ID for reference
      };

      // Add to active layer
      addElementToLayerRef.current(drawingElement);
    };

    // Handler for edited drawings
    const handleEdited = (e) => {
      const layers = e.layers;

      layers.eachLayer((layer) => {
        const elementId = layer._uniqueId;

        if (!elementId || !activeLayerIdRef.current) return;

        // Convert updated drawing to GeoJSON
        const geoJSON = layer.toGeoJSON();

        // For circles, save the radius as a property
        if (layer instanceof L.Circle) {
          geoJSON.properties = geoJSON.properties || {};
          geoJSON.properties.radius = layer.getRadius();
        }

        // Update the element
        updateElementInLayerRef.current(activeLayerIdRef.current, elementId, {
          geoJSON,
          updatedAt: new Date().toISOString(),
        });
      });
    };

    // Handler for deleted drawings
    const handleDeleted = (e) => {
      const layers = e.layers;

      layers.eachLayer((layer) => {
        const elementId = layer._uniqueId;

        if (!elementId || !activeLayerIdRef.current) return;

        // Remove the element
        removeElementFromLayerRef.current(activeLayerIdRef.current, elementId);
      });
    };

    // Register event handlers
    map.on("draw:created", handleCreated);
    map.on("draw:edited", handleEdited);
    map.on("draw:deleted", handleDeleted);

    return () => {
      // Clean up event handlers
      map.off("draw:created", handleCreated);
      map.off("draw:edited", handleEdited);
      map.off("draw:deleted", handleDeleted);
    };
  }, [map, featureGroup]);

  return null;
};

// Component to handle the feature group reference
const FeatureGroupHandler = ({ children, layerId }) => {
  const featureGroupRef = useRef(null);
  const { setFeatureGroup } = useLeafletContext();

  useEffect(() => {
    if (featureGroupRef.current) {
      setFeatureGroup(featureGroupRef.current);
    }

    return () => {
      // Clear the feature group on unmount or layer change
      if (featureGroupRef.current) {
        featureGroupRef.current.clearLayers();
      }
    };
  }, [featureGroupRef, setFeatureGroup, layerId]);

  return <FeatureGroup ref={featureGroupRef}>{children}</FeatureGroup>;
};

// Component to render one layer
const LayerRenderer = ({ layer, drawingStyles, isActive }) => {
  // Don't render anything if layer is not visible
  if (!layer.visible) return null;

  return (
    <FeatureGroup>
      {layer.elements.map((element) => {
        // Special case for circles
        if (
          element.type === "circle" &&
          element.geoJSON.geometry.type === "Point" &&
          element.geoJSON.properties?.radius
        ) {
          const [lng, lat] = element.geoJSON.geometry.coordinates;
          const radius = element.geoJSON.properties.radius;

          return (
            <Circle
              key={element.id}
              center={[lat, lng]}
              radius={radius}
              pathOptions={element.style || drawingStyles}
            />
          );
        }

        // For all other shapes, use GeoJSON
        return (
          <GeoJSON
            key={element.id}
            data={element.geoJSON}
            style={() => element.style || drawingStyles}
          />
        );
      })}
    </FeatureGroup>
  );
};

// Component that sets initial map view from URL and then tracks changes
const MapViewManager = () => {
  const map = useLeafletMap();
  const { mapType, changeMapType } = useMap();
  const initialSetDone = useRef(false);
  const changeMapTypeRef = useRef(changeMapType);

  useEffect(() => {
    changeMapTypeRef.current = changeMapType;
  });

  // Debounce function to limit URL updates
  const debounce = (func, delay) => {
    let timeoutId;
    return (...args) => {
      if (timeoutId) {
        clearTimeout(timeoutId);
      }
      timeoutId = setTimeout(() => {
        func(...args);
      }, delay);
    };
  };

  // Set initial position from URL parameters when map is ready
  useEffect(() => {
    if (!map || initialSetDone.current) return;

    // Get params from URL
    const urlParams = parseMapParamsFromUrl();

    if (urlParams) {
      // Use flyTo for smooth transition to the location
      map.flyTo(urlParams.center, urlParams.zoom, { duration: 0.5 });
      initialSetDone.current = true;

      // If map type is also in URL, update that too
      const params = new URLSearchParams(window.location.search);
      if (params.has("type")) {
        const urlMapType = params.get("type");
        if (["satellite", "street", "terrain"].includes(urlMapType)) {
          changeMapTypeRef.current(urlMapType);
        }
      }
    } else {
      // If not in URL, try localStorage as fallback
      try {
        const savedMapView = localStorage.getItem("map_view_state");
        if (savedMapView) {
          const {
            center,
            zoom,
            mapType: storedMapType,
          } = JSON.parse(savedMapView);
          if (center && zoom) {
            map.flyTo(center, zoom, { duration: 0.5 });
            initialSetDone.current = true;
          }
          if (
            storedMapType &&
            ["satellite", "street", "terrain"].includes(storedMapType)
          ) {
            changeMapTypeRef.current(storedMapType);
          }
        }
      } catch (error) {
        console.error("Error loading map view state from localStorage:", error);
      }
    }
  }, [map]);

  // Update URL parameters and localStorage when map view changes
  useEffect(() => {
    if (!map) return;

    const updateMapState = () => {
      const center = map.getCenter();
      const zoom = map.getZoom();

      // Update URL parameters without reloading the page
      const params = new URLSearchParams(window.location.search);
      params.set("lat", center.lat.toFixed(6));
      params.set("lng", center.lng.toFixed(6));
      params.set("zoom", zoom.toString());
      params.set("type", mapType); // Add map type to URL

      // Update URL without reloading
      const newUrl = `${window.location.pathname}?${params.toString()}`;
      window.history.replaceState({ path: newUrl }, "", newUrl);

      // Save to localStorage as backup
      try {
        localStorage.setItem(
          "map_view_state",
          JSON.stringify({
            center: [center.lat, center.lng],
            zoom,
            mapType,
          })
        );
      } catch (error) {
        console.error("Error saving map view state to localStorage:", error);
      }
    };

    // Debounce the update function to avoid too many URL changes
    const debouncedUpdateMapState = debounce(updateMapState, 200);

    // Register event listeners
    map.on("moveend", debouncedUpdateMapState);
    map.on("zoomend", debouncedUpdateMapState);

    return () => {
      map.off("moveend", debouncedUpdateMapState);
      map.off("zoomend", debouncedUpdateMapState);
    };
  }, [map, mapType]);

  return null;
};

const MapView = () => {
  const {
    layers,
    activeLayerId,
    mapType,
    drawingStyles,
    showFires,
    fireConfig,
  } = useMap();
  const { map } = useLeafletContext(); // map instance from LeafletContext

  // Get active layer
  const activeLayer = layers.find((layer) => layer.id === activeLayerId);

  // Initialize map view state - Default to Moscow
  const [mapCenter, setMapCenter] = useState([55.738322, 37.618561]);
  const [mapZoom, setMapZoom] = useState(10);

  // Remove default Leaflet attribution if it exists, to prevent duplicates or unwanted text
  useEffect(() => {
    const attributionControl = document.querySelector(
      ".leaflet-control-attribution"
    );
    if (attributionControl) {
      // Optionally, you could hide it or clear its contents if you want to keep the control box
      // attributionControl.style.display = 'none';
      // For complete removal:
      // attributionControl.remove();
    }
  }, []);

  const getTimeParameter = useCallback(() => {
    // For custom date range
    if (fireConfig && fireConfig.time) {
      return fireConfig.time;
    }

    // For fixed periods (24h, 48h, etc.), generate time range from now
    const endDate = new Date();
    let startDate = new Date();

    if (
      fireConfig &&
      fireConfig.rawConfig &&
      fireConfig.rawConfig.activeFireTimeWindow
    ) {
      const timeWindow = fireConfig.rawConfig.activeFireTimeWindow;
      if (timeWindow === "24h") {
        startDate.setDate(startDate.getDate() - 1);
      } else if (timeWindow === "48h") {
        startDate.setDate(startDate.getDate() - 2);
      } else if (timeWindow === "72h") {
        startDate.setDate(startDate.getDate() - 3);
      } else if (timeWindow === "7d") {
        startDate.setDate(startDate.getDate() - 7);
      }
    } else {
      // Default to 24h
      startDate.setDate(startDate.getDate() - 1);
    }

    // Format as YYYY-MM-DD
    const formatDate = (date) => {
      return date.toISOString().split("T")[0];
    };

    return `${formatDate(startDate)}/${formatDate(endDate)}`;
  }, [fireConfig]);

  return (
    <Box sx={{ position: "relative", width: "100%", height: "100%" }}>
      <MapContainer
        center={mapCenter}
        zoom={mapZoom}
        style={{ width: "100%", height: "100%" }}
        attributionControl={false} // Disable default attribution control here
      >
        {/* Capture map instance for our context */}
        <LeafletMapSetter />

        {/* Manage map view based on URL and track changes */}
        <MapViewManager />

        {/* Set up event handlers */}
        <DrawingEventHandler />

        {/* Base Map Layer */}
        <TileLayer
          key={mapType}
          url={TILE_LAYERS[mapType].url}
          attribution={TILE_LAYERS[mapType].attribution}
          maxZoom={TILE_LAYERS[mapType].maxZoom}
        />

        {/* FIRMS Active Fire Layer */}
        {showFires && fireConfig && fireConfig.layerName && (
          <WMSTileLayer
            key={`firms-${showFires}-${fireConfig.layerName}-${fireConfig._toggleKey || "default"}`}
            url={FIRMS_WMS_URL}
            layers={fireConfig.layerName}
            time={getTimeParameter()}
            format="image/png"
            transparent={true}
            zIndex={10}
            version="1.1.1"
            crs={L.CRS.EPSG4326}

            tileSize={256}
            noWrap={false}
            updateWhenIdle={true}
            updateWhenZooming={false}
            keepBuffer={200}
          />
        )}

        {/* Non-active visible layers */}
        {layers
          .filter((layer) => layer.visible && layer.id !== activeLayerId)
          .map((layer) => (
            <LayerRenderer
              key={layer.id}
              layer={layer}
              drawingStyles={drawingStyles}
              isActive={false}
            />
          ))}

        {/* Active layer - needs to be in a FeatureGroupHandler for drawing tools */}
        {activeLayer && activeLayer.visible && (
          <FeatureGroupHandler layerId={activeLayer.id}>
            {activeLayer.elements.map((element) => {
              // Special case for circles
              if (
                element.type === "circle" &&
                element.geoJSON.geometry.type === "Point" &&
                element.geoJSON.properties?.radius
              ) {
                const [lng, lat] = element.geoJSON.geometry.coordinates;
                const radius = element.geoJSON.properties.radius;

                return (
                  <Circle
                    key={element.id}
                    center={[lat, lng]}
                    radius={radius}
                    pathOptions={element.style || drawingStyles}
                  />
                );
              }

              // For all other shapes, use GeoJSON
              return (
                <GeoJSON
                  key={element.id}
                  data={element.geoJSON}
                  style={() => element.style || drawingStyles}
                />
              );
            })}
          </FeatureGroupHandler>
        )}

        {/* ReID Markers */}
        <ReidMapMarkers />

        {/* Map Controls */}
        <Paper
          elevation={3}
          sx={{
            position: "absolute",
            top: 10,
            left: 11,
            zIndex: 1000, // Ensure controls are above layers like FIRMS
            borderRadius: 1,
          }}
        >
          <MapControlsWrapper />
        </Paper>
      </MapContainer>

      {/* Drawing Tools Panel */}
      {activeLayerId && (
        <Paper
          elevation={3}
          sx={{
            position: "absolute",
            top: 16,
            right: 10,
            zIndex: 1000,
            borderRadius: 1,
          }}
        >
          <DrawingTools />
        </Paper>
      )}

      {/* ReID Overlay Panels */}
      <RecentPeoplePanel />
      <SightingsPanel />
    </Box>
  );
};

// Wrapper component to access the Leaflet map instance for controls
const MapControlsWrapper = () => {
  const map = useLeafletMap(); // This gets the map instance from the MapContainer
  return <MapControls map={map} />;
};

export default MapView;
