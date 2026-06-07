import React, {
  createContext,
  useContext,
  useState,
  useCallback,
  useRef,
  useEffect,
  useMemo,
} from "react";
import { v4 as uuidv4 } from "uuid";
import {
  getAllLayers,
  getLayerById,
  createLayer as apiCreateLayer,
  updateLayer as apiUpdateLayer,
  deleteLayer as apiDeleteLayer,
  addElementToLayer as apiAddElementToLayer,
  removeElementFromLayer as apiRemoveElementFromLayer,
  clearLayerElements as apiClearLayerElements,
  shareLayer as apiShareLayer,
} from "../services/layerService";

const MapContext = createContext();

export function useMap() {
  return useContext(MapContext);
}

// localStorage keys
const LAYER_VISIBILITY_KEY = "map_layer_visibility";

export function MapProvider({ children }) {
  const [layers, setLayers] = useState([]);
  const [activeLayerId, setActiveLayerId] = useState(null);
  const activeLayerIdRef = useRef(null);

  const [mapType, setMapType] = useState("satellite"); // 'satellite', 'street', 'terrain'
  const [drawingStyles, setDrawingStyles] = useState({
    color: "#FF0000",
    weight: 8,
    opacity: 1,
    fillColor: "#FF0000",
    fillOpacity: 0.3,
  });
  const [activeDrawingTool, setActiveDrawingTool] = useState("move");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  // Per-layer history tracking
  const [layerHistories, setLayerHistories] = useState({}); // { layerId: { historyStack: [], futureStack: [] } }
  const isPerformingHistoryAction = useRef(false);

  const user = useMemo(() => ({ id: 'local-user', name: 'User' }), []);
  const isAuthenticated = useMemo(() => true, []);

  // Polling for layer updates
  const pollingInterval = useRef(null);
  const POLLING_INTERVAL_MS = 3500;

  // Update the ref when activeLayerId changes
  useEffect(() => {
    activeLayerIdRef.current = activeLayerId;
  }, [activeLayerId]);

  const initialRawFireConfig = {
    category: "activeFires",
    sensor: "VIIRS",
    viirsPlatform: "all", // 'all', 'snpp', 'noaa20', 'noaa21'
    modisPlatform: "combined", // 'combined', 'aqua', 'terra'
    activeFireTimeWindow: "24h", // '24h', '48h', '72h', '7d'
    wmsStartDate: "", // For custom date range
    wmsEndDate: "", // For custom date range
    preset: "recent", // 'recent', 'mid', 'old'
  };

  const [showFires, setShowFires] = useState(false);
  const [fireConfig, setFireConfig] = useState({
    layerName: "fires_viirs_24", // Corrected to use a valid layer name
    time: null,
    rawConfig: initialRawFireConfig,
  });
  const [isFireConfigDialogOpen, setFireConfigDialogOpen] = useState(false);

  const toggleShowFires = () => {
    setShowFires((prev) => {
      if (!prev) {
        // Only update toggle key when turning on, not continuously
        setFireConfig((current) => ({
          ...current,
          _toggleKey: Date.now(),
        }));
      }
      return !prev;
    });
  };

  const openFireConfigDialog = () => setFireConfigDialogOpen(true);
  const closeFireConfigDialog = () => setFireConfigDialogOpen(false);

  const applyFireConfig = (newRawConfig) => {
    const { category, sensor, viirsPlatform, modisPlatform, activeFireTimeWindow, preset } = newRawConfig;
    let newLayerName = '';
    let newTimeParam = null;

    // Handle preset selection (overrides other settings)
    if (preset === 'recent') {
      // Set to 24h for all sensors
      newRawConfig.activeFireTimeWindow = '24h';
    } else if (preset === 'mid') {
      // Set to 48h for all sensors
      newRawConfig.activeFireTimeWindow = '48h';
    } else if (preset === 'old') {
      // Set to 7d for all sensors
      newRawConfig.activeFireTimeWindow = '7d';
    }

    const formatTimeSuffix = (timeWindow) => {
      const tw = String(timeWindow).toLowerCase();
      if (tw === '24h') return '_24';
      if (tw === '48h') return '_48';
      if (tw === '72h') return '_72';
      if (tw === '7d') return '_7';
      return '_24'; // Default
    };

    if (category === 'activeFires') {
      const timeSuffix = formatTimeSuffix(newRawConfig.activeFireTimeWindow);

      if (sensor === 'VIIRS') {
        if (viirsPlatform === 'all') {
          newLayerName = `fires_viirs${timeSuffix}`;
        } else if (viirsPlatform === 'snpp') {
          newLayerName = `fires_viirs_snpp${timeSuffix}`;
        } else if (viirsPlatform === 'noaa20') {
          newLayerName = `fires_viirs_noaa20${timeSuffix}`;
        } else if (viirsPlatform === 'noaa21') {
          newLayerName = `fires_viirs_noaa21${timeSuffix}`;
        }
      } else if (sensor === 'MODIS') {
        if (modisPlatform === 'combined') {
          newLayerName = `fires_modis${timeSuffix}`;
        } else if (modisPlatform === 'aqua') {
          newLayerName = `fires_aqua${timeSuffix}`;
        } else if (modisPlatform === 'terra') {
          newLayerName = `fires_terra${timeSuffix}`;
        }
      } else if (sensor === 'Landsat') {
        newLayerName = `fires_landsat${timeSuffix}`;
      }
    } else if (category === 'wmsTime') {
      // Custom time range using layers that support TIME parameter
      const { wmsStartDate, wmsEndDate } = newRawConfig;

      if (sensor === 'VIIRS') {
        if (viirsPlatform === 'all') {
          newLayerName = 'fires_viirs';
        } else if (viirsPlatform === 'snpp') {
          newLayerName = 'fires_viirs_snpp';
        } else if (viirsPlatform === 'noaa20') {
          newLayerName = 'fires_viirs_noaa20';
        } else if (viirsPlatform === 'noaa21') {
          newLayerName = 'fires_viirs_noaa21';
        }
      } else if (sensor === 'MODIS') {
        if (modisPlatform === 'combined') {
          newLayerName = 'fires_modis';
        } else if (modisPlatform === 'aqua') {
          newLayerName = 'fires_aqua';
        } else if (modisPlatform === 'terra') {
          newLayerName = 'fires_terra';
        }
      } else if (sensor === 'Landsat') {
        // There's no custom date range layer for Landsat in the list
        // Defaulting to 24h as fallback
        newLayerName = 'fires_landsat_24';
      }

      // Format the time parameter correctly for WMS TIME
      if (wmsStartDate) {
        // Format is already YYYY-MM-DD from the date picker
        newTimeParam = wmsStartDate;

        if (wmsEndDate) {
          newTimeParam += `/${wmsEndDate}`;  // WMS range format: startdate/enddate
        }
      }
    }

    setFireConfig({
      layerName: newLayerName,
      time: newTimeParam,
      rawConfig: newRawConfig,
      _toggleKey: Date.now(),
    });

    if (newLayerName && !showFires) {
      setShowFires(true);
    }
    closeFireConfigDialog();
  };

  // Fetch all layers from API
  const fetchAllLayers = useCallback(async () => {
    // setLoading(true);
    setError(null);

    try {
      const response = await getAllLayers();

      // Check for correct response structure from backend
      if (response && response.success && Array.isArray(response.data)) {
        setLayers(response.data);

        // Use ref to avoid dependency on activeLayerId
        if (!activeLayerIdRef.current && response.data.length > 0) {
          setActiveLayerId(response.data[0].id);
        }
      } else {
        console.error("Unexpected response format:", response);
        setError("Invalid response format from server");
      }
    } catch (err) {
      console.error("Error fetching layers:", err);
      setError("Failed to fetch layers. Please try again.");
    } finally {
      // setLoading(false);
    }
  }, []);

  // Fetch layers from server when authenticated
  useEffect(() => {
    if (user && isAuthenticated) {
      fetchAllLayers();
    }
  }, [user, isAuthenticated, fetchAllLayers]);

  // Set up polling for layer updates
  useEffect(() => {
    if (user) {
      // Start polling
      pollingInterval.current = setInterval(
        fetchAllLayers,
        POLLING_INTERVAL_MS
      );

      // Clean up on unmount
      return () => {
        if (pollingInterval.current) {
          clearInterval(pollingInterval.current);
        }
      };
    }
  }, [user, fetchAllLayers]);

  // Fetch a single layer by ID (useful for refreshing after changes)
  const fetchLayerById = async (layerId) => {
    if (!layerId) return null;

    try {
      const response = await getLayerById(layerId);

      if (response && response.success && response.data) {
        // Update this layer in the layers array
        setLayers((prevLayers) =>
          prevLayers.map((layer) =>
            layer.id === layerId ? response.data : layer
          )
        );
        return response.data;
      }
    } catch (err) {
      console.error(`Error fetching layer ${layerId}:`, err);
    }

    return null;
  };

  // Load saved visibility preferences from localStorage on initial load
  useEffect(() => {
    try {
      const savedVisibility = localStorage.getItem(LAYER_VISIBILITY_KEY);
      if (savedVisibility) {
        const visibilityMap = JSON.parse(savedVisibility);

        // Apply saved visibility settings to layers
        setLayers((prevLayers) =>
          prevLayers.map((layer) => ({
            ...layer,
            visible:
              visibilityMap[layer.id] !== undefined
                ? visibilityMap[layer.id]
                : layer.visible,
          }))
        );
      }
    } catch (error) {
      console.error("Error loading layer visibility from localStorage:", error);
    }
  }, []);

  // Save layer visibility to localStorage whenever it changes
  const saveLayerVisibilityToLocalStorage = useCallback((updatedLayers) => {
    try {
      const visibilityMap = {};
      updatedLayers.forEach((layer) => {
        visibilityMap[layer.id] = layer.visible;
      });
      localStorage.setItem(LAYER_VISIBILITY_KEY, JSON.stringify(visibilityMap));
    } catch (error) {
      console.error("Error saving layer visibility to localStorage:", error);
    }
  }, []);


  // Get history stacks for active layer
  const getActiveLayerHistory = useCallback(() => {
    if (!activeLayerId) return { historyStack: [], futureStack: [] };

    // Initialize history for this layer if it doesn't exist
    if (!layerHistories[activeLayerId]) {
      setLayerHistories((prev) => ({
        ...prev,
        [activeLayerId]: { historyStack: [], futureStack: [] },
      }));
      return { historyStack: [], futureStack: [] };
    }

    return layerHistories[activeLayerId];
  }, [activeLayerId, layerHistories]);

  // Computed values for active layer history
  const activeLayerHistory = getActiveLayerHistory();
  const historyStack = activeLayerHistory.historyStack || [];
  const futureStack = activeLayerHistory.futureStack || [];

  // Record action to history for specific layer
  const recordAction = useCallback((layerId, actionType, data) => {
    // Don't record if we're in the middle of an undo/redo
    if (isPerformingHistoryAction.current) return;

    const action = {
      type: actionType,
      data,
      timestamp: Date.now(),
    };

    setLayerHistories((prev) => {
      // Get or initialize history for this layer
      const layerHistory = prev[layerId] || {
        historyStack: [],
        futureStack: [],
      };

      return {
        ...prev,
        [layerId]: {
          historyStack: [...layerHistory.historyStack, action],
          futureStack: [], // Clear future stack for this layer when a new action is performed
        },
      };
    });
  }, []);

  // Undo the last action on the active layer
  const undo = useCallback(() => {
    if (
      !activeLayerId ||
      !layerHistories[activeLayerId] ||
      layerHistories[activeLayerId].historyStack.length === 0
    ) {
      return;
    }

    isPerformingHistoryAction.current = true;

    // Get the last action from history
    const layerHistory = layerHistories[activeLayerId];
    const lastAction =
      layerHistory.historyStack[layerHistory.historyStack.length - 1];

    // Move the action to future stack
    setLayerHistories((prev) => ({
      ...prev,
      [activeLayerId]: {
        historyStack: layerHistory.historyStack.slice(0, -1),
        futureStack: [...layerHistory.futureStack, lastAction],
      },
    }));

    // Restore the state before this action
    switch (lastAction.type) {
      case "ADD_ELEMENT":
        // Remove the added element
        setLayers((prevLayers) => {
          const updatedLayers = prevLayers.map((layer) =>
            layer.id === lastAction.data.layerId
              ? {
                  ...layer,
                  elements: layer.elements.filter(
                    (el) => el.id !== lastAction.data.element.id
                  ),
                }
              : layer
          );

          const updatedLayer = updatedLayers.find(
            (l) => l.id === lastAction.data.layerId
          );
          if (updatedLayer) {
            // Update layer in the backend
            apiUpdateLayer(lastAction.data.layerId, updatedLayer)
              .then((response) => {
                if (!response.success) {
                  console.error("API error during undo:", response.error);
                  setError(
                    "Failed to undo action: " +
                      (response.error || "Unknown error")
                  );
                }
              })
              .catch((err) => {
                console.error("Error updating layer after undo:", err);
                setError("Failed to undo action. Please try again.");
              });
          }

          return updatedLayers;
        });
        break;

      case "REMOVE_ELEMENT":
        // Restore the removed element
        setLayers((prevLayers) => {
          const updatedLayers = prevLayers.map((layer) =>
            layer.id === lastAction.data.layerId
              ? {
                  ...layer,
                  elements: [...layer.elements, lastAction.data.element],
                }
              : layer
          );

          const updatedLayer = updatedLayers.find(
            (l) => l.id === lastAction.data.layerId
          );
          if (updatedLayer) {
            // Update layer in the backend
            apiUpdateLayer(lastAction.data.layerId, updatedLayer)
              .then((response) => {
                if (!response.success) {
                  console.error("API error during undo:", response.error);
                  setError(
                    "Failed to undo action: " +
                      (response.error || "Unknown error")
                  );
                }
              })
              .catch((err) => {
                console.error("Error updating layer after undo:", err);
                setError("Failed to undo action. Please try again.");
              });
          }

          return updatedLayers;
        });
        break;

      case "CLEAR_LAYER":
        // Restore all the cleared elements
        setLayers((prevLayers) => {
          const updatedLayers = prevLayers.map((layer) =>
            layer.id === lastAction.data.layerId
              ? {
                  ...layer,
                  elements: lastAction.data.elements,
                }
              : layer
          );

          const updatedLayer = updatedLayers.find(
            (l) => l.id === lastAction.data.layerId
          );
          if (updatedLayer) {
            // Update layer in the backend
            apiUpdateLayer(lastAction.data.layerId, updatedLayer)
              .then((response) => {
                if (!response.success) {
                  console.error("API error during undo:", response.error);
                  setError(
                    "Failed to undo action: " +
                      (response.error || "Unknown error")
                  );
                }
              })
              .catch((err) => {
                console.error("Error updating layer after undo:", err);
                setError("Failed to undo action. Please try again.");
              });
          }

          return updatedLayers;
        });
        break;

      case "UPDATE_ELEMENT":
        // Restore the previous state of the element
        setLayers((prevLayers) => {
          const updatedLayers = prevLayers.map((layer) =>
            layer.id === lastAction.data.layerId
              ? {
                  ...layer,
                  elements: layer.elements.map((el) =>
                    el.id === lastAction.data.elementId
                      ? lastAction.data.previousElement
                      : el
                  ),
                }
              : layer
          );

          const updatedLayer = updatedLayers.find(
            (l) => l.id === lastAction.data.layerId
          );
          if (updatedLayer) {
            // Update layer in the backend
            apiUpdateLayer(lastAction.data.layerId, updatedLayer)
              .then((response) => {
                if (!response.success) {
                  console.error("API error during undo:", response.error);
                  setError(
                    "Failed to undo action: " +
                      (response.error || "Unknown error")
                  );
                }
              })
              .catch((err) => {
                console.error("Error updating layer after undo:", err);
                setError("Failed to undo action. Please try again.");
              });
          }

          return updatedLayers;
        });
        break;

      default:
        break;
    }

    isPerformingHistoryAction.current = false;
  }, [activeLayerId, layerHistories]);

  // Redo the last undone action on the active layer
  const redo = useCallback(() => {
    if (
      !activeLayerId ||
      !layerHistories[activeLayerId] ||
      layerHistories[activeLayerId].futureStack.length === 0
    ) {
      return;
    }

    isPerformingHistoryAction.current = true;

    // Get the last action from future
    const layerHistory = layerHistories[activeLayerId];
    const nextAction =
      layerHistory.futureStack[layerHistory.futureStack.length - 1];

    // Move the action back to history stack
    setLayerHistories((prev) => ({
      ...prev,
      [activeLayerId]: {
        historyStack: [...layerHistory.historyStack, nextAction],
        futureStack: layerHistory.futureStack.slice(0, -1),
      },
    }));

    // Apply the action again
    switch (nextAction.type) {
      case "ADD_ELEMENT":
        // Add the element again
        setLayers((prevLayers) => {
          const updatedLayers = prevLayers.map((layer) =>
            layer.id === nextAction.data.layerId
              ? {
                  ...layer,
                  elements: [...layer.elements, nextAction.data.element],
                }
              : layer
          );

          const updatedLayer = updatedLayers.find(
            (l) => l.id === nextAction.data.layerId
          );
          if (updatedLayer) {
            // Update layer in the backend
            apiUpdateLayer(nextAction.data.layerId, updatedLayer)
              .then((response) => {
                if (!response.success) {
                  console.error("API error during redo:", response.error);
                  setError(
                    "Failed to redo action: " +
                      (response.error || "Unknown error")
                  );
                }
              })
              .catch((err) => {
                console.error("Error updating layer after redo:", err);
                setError("Failed to redo action. Please try again.");
              });
          }

          return updatedLayers;
        });
        break;

      case "REMOVE_ELEMENT":
        // Remove the element again
        setLayers((prevLayers) => {
          const updatedLayers = prevLayers.map((layer) =>
            layer.id === nextAction.data.layerId
              ? {
                  ...layer,
                  elements: layer.elements.filter(
                    (el) => el.id !== nextAction.data.element.id
                  ),
                }
              : layer
          );

          const updatedLayer = updatedLayers.find(
            (l) => l.id === nextAction.data.layerId
          );
          if (updatedLayer) {
            // Update layer in the backend
            apiUpdateLayer(nextAction.data.layerId, updatedLayer)
              .then((response) => {
                if (!response.success) {
                  console.error("API error during redo:", response.error);
                  setError(
                    "Failed to redo action: " +
                      (response.error || "Unknown error")
                  );
                }
              })
              .catch((err) => {
                console.error("Error updating layer after redo:", err);
                setError("Failed to redo action. Please try again.");
              });
          }

          return updatedLayers;
        });
        break;

      case "CLEAR_LAYER":
        // Clear the layer again
        setLayers((prevLayers) => {
          const updatedLayers = prevLayers.map((layer) =>
            layer.id === nextAction.data.layerId
              ? { ...layer, elements: [] }
              : layer
          );

          const updatedLayer = updatedLayers.find(
            (l) => l.id === nextAction.data.layerId
          );
          if (updatedLayer) {
            // Update layer in the backend
            apiUpdateLayer(nextAction.data.layerId, updatedLayer)
              .then((response) => {
                if (!response.success) {
                  console.error("API error during redo:", response.error);
                  setError(
                    "Failed to redo action: " +
                      (response.error || "Unknown error")
                  );
                }
              })
              .catch((err) => {
                console.error("Error updating layer after redo:", err);
                setError("Failed to redo action. Please try again.");
              });
          }

          return updatedLayers;
        });
        break;

      case "UPDATE_ELEMENT":
        // Apply the update again
        setLayers((prevLayers) => {
          const updatedLayers = prevLayers.map((layer) =>
            layer.id === nextAction.data.layerId
              ? {
                  ...layer,
                  elements: layer.elements.map((el) =>
                    el.id === nextAction.data.elementId
                      ? nextAction.data.updatedElement
                      : el
                  ),
                }
              : layer
          );

          const updatedLayer = updatedLayers.find(
            (l) => l.id === nextAction.data.layerId
          );
          if (updatedLayer) {
            // Update layer in the backend
            apiUpdateLayer(nextAction.data.layerId, updatedLayer)
              .then((response) => {
                if (!response.success) {
                  console.error("API error during redo:", response.error);
                  setError(
                    "Failed to redo action: " +
                      (response.error || "Unknown error")
                  );
                }
              })
              .catch((err) => {
                console.error("Error updating layer after redo:", err);
                setError("Failed to redo action. Please try again.");
              });
          }

          return updatedLayers;
        });
        break;

      default:
        break;
    }

    isPerformingHistoryAction.current = false;
  }, [activeLayerId, layerHistories]);

  // Add a new layer
  const addLayer = useCallback(
    async (name) => {
      if (!user) return null;

      const newLayerId = uuidv4();
      const newLayer = {
        id: newLayerId,
        name: name || `Layer ${layers.length + 1}`,
        visible: true,
        elements: [],
        createdAt: new Date().toISOString(),
        createdBy: user.id,
      };

      // Update local state first for responsive UI
      setLayers((prevLayers) => {
        const updatedLayers = [...prevLayers, newLayer];
        // Save updated visibility to localStorage
        saveLayerVisibilityToLocalStorage(updatedLayers);
        return updatedLayers;
      });

      setActiveLayerId(newLayerId);

      // Initialize history for this new layer
      setLayerHistories((prev) => ({
        ...prev,
        [newLayerId]: { historyStack: [], futureStack: [] },
      }));

      // Create layer in the backend
      try {
        const response = await apiCreateLayer(newLayer);

        if (!response.success) {
          console.error("API error creating layer:", response.error);
          setError(
            "Failed to create layer: " + (response.error || "Unknown error")
          );

          // Rollback if API creation failed
          setLayers((prevLayers) =>
            prevLayers.filter((layer) => layer.id !== newLayerId)
          );
          setActiveLayerId((prevActiveLayerId) => {
            // Changed prevLayers to prevActiveLayerId for clarity
            const remainingLayers = layers.filter(
              // Use 'layers' directly, or fetch from a reliable source if it might be stale
              (layer) => layer.id !== newLayerId
            );
            return remainingLayers.length > 0 ? remainingLayers[0].id : null;
          });

          return null;
        }
      } catch (err) {
        console.error("Error creating layer:", err);
        setError("Failed to create layer. Please try again.");

        // Rollback if API creation failed
        setLayers((prevLayers) =>
          prevLayers.filter((layer) => layer.id !== newLayerId)
        );
        setActiveLayerId((prevActiveLayerId) => {
          // Changed prevLayers to prevActiveLayerId
          const remainingLayers = layers.filter(
            // Use 'layers' directly
            (layer) => layer.id !== newLayerId
          );
          return remainingLayers.length > 0 ? remainingLayers[0].id : null;
        });

        return null;
      }

      return newLayerId;
    },
    [
      user,
      layers,
      saveLayerVisibilityToLocalStorage,
    ]
  );

  // Remove a layer by id
  const removeLayer = useCallback(
    async (layerId) => {
      if (!user) return;

      // Save current layers for potential rollback
      const currentLayers = [...layers];
      const currentActiveLayerId = activeLayerId;

      // Update local state first for responsive UI
      setLayers((prevLayers) => {
        const updatedLayers = prevLayers.filter(
          (layer) => layer.id !== layerId
        );
        // Save updated visibility to localStorage
        saveLayerVisibilityToLocalStorage(updatedLayers);
        return updatedLayers;
      });

      // Remove history for this layer
      setLayerHistories((prev) => {
        const newHistories = { ...prev };
        delete newHistories[layerId];
        return newHistories;
      });

      // If we removed the active layer, set a new active layer
      if (activeLayerId === layerId) {
        const newActiveLayers = layers.filter((layer) => layer.id !== layerId); // Get the updated list
        setActiveLayerId(
          newActiveLayers.length > 0 ? newActiveLayers[0].id : null
        );
      }

      // Delete layer from the backend
      try {
        const response = await apiDeleteLayer(layerId);

        if (!response.success) {
          console.error("API error deleting layer:", response.error);
          setError(
            "Failed to delete layer: " + (response.error || "Unknown error")
          );

          // Rollback on failure
          setLayers(currentLayers);
          setActiveLayerId(currentActiveLayerId);
        }
      } catch (err) {
        console.error("Error deleting layer:", err);
        setError("Failed to delete layer. Please try again.");

        // Rollback on failure
        setLayers(currentLayers);
        setActiveLayerId(currentActiveLayerId);
      }
    },
    [
      user,
      layers,
      activeLayerId,
      saveLayerVisibilityToLocalStorage,
    ]
  );

  // Toggle layer visibility
  const toggleLayerVisibility = useCallback(
    async (layerId) => {
      // Find the layer to toggle
      const layerToToggle = layers.find((layer) => layer.id === layerId);
      if (!layerToToggle) return;

      // Save current state for potential rollback
      const currentVisibility = layerToToggle.visible;

      // Create updated layer with toggled visibility
      const updatedLayer = {
        ...layerToToggle,
        visible: !layerToToggle.visible,
      };

      // Update local state first for responsive UI
      setLayers((prevLayers) => {
        const updatedLayers = prevLayers.map((layer) => {
          if (layer.id === layerId) {
            return updatedLayer;
          }
          return layer;
        });

        // Save updated visibility to localStorage
        saveLayerVisibilityToLocalStorage(updatedLayers);

        return updatedLayers;
      });

      // Update layer in the backend
      try {
        const response = await apiUpdateLayer(layerId, updatedLayer);

        if (!response.success) {
          console.error("API error updating layer visibility:", response.error);
          setError(
            "Failed to update layer visibility: " +
              (response.error || "Unknown error")
          );

          // Rollback on failure
          setLayers((prevLayers) =>
            prevLayers.map((layer) =>
              layer.id === layerId
                ? { ...layer, visible: currentVisibility }
                : layer
            )
          );
        }
      } catch (err) {
        console.error("Error updating layer visibility:", err);
        setError("Failed to update layer visibility. Please try again.");

        // Rollback on failure
        setLayers((prevLayers) =>
          prevLayers.map((layer) =>
            layer.id === layerId
              ? { ...layer, visible: currentVisibility }
              : layer
          )
        );
      }
    },
    [layers, saveLayerVisibilityToLocalStorage]
  );

  // Add element to active layer
  const addElementToLayer = useCallback(
    async (element) => {
      if (!activeLayerId) return;

      // Create a complete element with ID if not present
      const completeElement = {
        ...element,
        id: element.id || uuidv4(),
        createdBy: user?.id || "anonymous",
        createdAt: new Date().toISOString(),
      };

      // Find current layer for later API call
      const currentLayer = layers.find((layer) => layer.id === activeLayerId);
      if (!currentLayer) return;

      // Save current state for potential rollback
      const currentElements = [...currentLayer.elements];

      // Update local state first for responsive UI
      setLayers((prevLayers) => {
        const updatedLayers = prevLayers.map((layer) => {
          if (layer.id === activeLayerId) {
            const updatedLayerData = {
              // Renamed for clarity
              ...layer,
              elements: [...layer.elements, completeElement],
            };

            return updatedLayerData;
          }
          return layer;
        });

        return updatedLayers;
      });

      // Record this action in history
      recordAction(activeLayerId, "ADD_ELEMENT", {
        layerId: activeLayerId,
        element: completeElement,
      });

      // Add element to the backend
      try {
        const response = await apiAddElementToLayer(
          activeLayerId,
          completeElement
        );

        if (!response.success) {
          console.error("API error adding element:", response.error);
          setError(
            "Failed to add element: " + (response.error || "Unknown error")
          );

          // Rollback on failure
          setLayers((prevLayers) =>
            prevLayers.map((layer) =>
              layer.id === activeLayerId
                ? { ...layer, elements: currentElements }
                : layer
            )
          );
        }
      } catch (err) {
        console.error("Error adding element to layer:", err);
        setError("Failed to add element. Please try again.");

        // Rollback on failure
        setLayers((prevLayers) =>
          prevLayers.map((layer) =>
            layer.id === activeLayerId
              ? { ...layer, elements: currentElements }
              : layer
          )
        );
      }
    },
    [activeLayerId, user, layers, recordAction]
  );

  // Remove element from a layer
  const removeElementFromLayer = useCallback(
    async (layerId, elementId) => {
      // Find the element first for history purposes
      const layer = layers.find((l) => l.id === layerId);
      if (!layer) return;

      const elementToRemove = layer.elements.find((el) => el.id === elementId);
      if (!elementToRemove) return;

      // Save current state for potential rollback
      const currentElements = [...layer.elements];

      // Update local state first
      setLayers((prevLayers) => {
        const updatedLayers = prevLayers.map((l) => {
          // Renamed 'layer' to 'l' to avoid conflict
          if (l.id === layerId) {
            const updatedLayerData = {
              // Renamed for clarity
              ...l,
              elements: l.elements.filter((el) => el.id !== elementId),
            };

            return updatedLayerData;
          }
          return l;
        });

        return updatedLayers;
      });

      // Record this action in history
      recordAction(layerId, "REMOVE_ELEMENT", {
        layerId,
        element: elementToRemove,
      });

      // Remove element from the backend
      try {
        const response = await apiRemoveElementFromLayer(layerId, elementId);

        if (!response.success) {
          console.error("API error removing element:", response.error);
          setError(
            "Failed to remove element: " + (response.error || "Unknown error")
          );

          // Rollback on failure
          setLayers((prevLayers) =>
            prevLayers.map(
              (
                l // Renamed 'layer' to 'l'
              ) => (l.id === layerId ? { ...l, elements: currentElements } : l)
            )
          );
        }
      } catch (err) {
        console.error(
          `Error removing element ${elementId} from layer ${layerId}:`,
          err
        );
        setError("Failed to remove element. Please try again.");

        // Rollback on failure
        setLayers((prevLayers) =>
          prevLayers.map(
            (
              l // Renamed 'layer' to 'l'
            ) => (l.id === layerId ? { ...l, elements: currentElements } : l)
          )
        );
      }
    },
    [layers, recordAction]
  );

  // Update an element in a layer
  const updateElementInLayer = useCallback(
    async (layerId, elementId, updatedProperties) => {
      // Find the element first to store its previous state in history
      const layer = layers.find((l) => l.id === layerId);
      if (!layer) return;

      const previousElement = layer.elements.find((el) => el.id === elementId);
      if (!previousElement) return;

      // Save current state for potential rollback
      const currentElements = [...layer.elements];

      // Create the updated element
      const updatedElement = {
        ...previousElement,
        ...updatedProperties,
        updatedAt: new Date().toISOString(),
        updatedBy: user?.id || "anonymous",
      };

      // Update local state
      setLayers((prevLayers) => {
        const updatedLayers = prevLayers.map((l) => {
          // Renamed 'layer' to 'l'
          if (l.id === layerId) {
            const updatedLayerData = {
              // Renamed for clarity
              ...l,
              elements: l.elements.map((el) =>
                el.id === elementId ? updatedElement : el
              ),
            };

            return updatedLayerData;
          }
          return l;
        });

        return updatedLayers;
      });

      // Record this action in history
      recordAction(layerId, "UPDATE_ELEMENT", {
        layerId,
        elementId,
        previousElement,
        updatedElement,
      });

      // Update the layer in the backend (since there's no direct API to update a single element)
      try {
        const layerToUpdate = layers.find((l) => l.id === layerId); // Use a different variable name
        if (layerToUpdate) {
          // Create a copy with the updated element
          const layerWithUpdatedElement = {
            ...layerToUpdate,
            elements: layerToUpdate.elements.map(
              (
                el // Use layerToUpdate here
              ) => (el.id === elementId ? updatedElement : el)
            ),
          };

          const response = await apiUpdateLayer(
            layerId,
            layerWithUpdatedElement
          );

          if (!response.success) {
            console.error("API error updating element:", response.error);
            setError(
              "Failed to update element: " + (response.error || "Unknown error")
            );

            // Rollback on failure
            setLayers((prevLayers) =>
              prevLayers.map(
                (
                  l // Renamed 'layer' to 'l'
                ) =>
                  l.id === layerId ? { ...l, elements: currentElements } : l
              )
            );
          }
        }
      } catch (err) {
        console.error(
          `Error updating element ${elementId} in layer ${layerId}:`,
          err
        );
        setError("Failed to update element. Please try again.");

        // Rollback on failure
        setLayers((prevLayers) =>
          prevLayers.map(
            (
              l // Renamed 'layer' to 'l'
            ) => (l.id === layerId ? { ...l, elements: currentElements } : l)
          )
        );
      }
    },
    [layers, user, recordAction]
  );

  // Clear all elements from active layer
  const clearActiveLayer = useCallback(async () => {
    if (!activeLayerId) return;

    // Find the layer to store its elements in history
    const layer = layers.find((l) => l.id === activeLayerId);
    if (!layer) return;

    const elementsToRestore = [...layer.elements]; // Renamed for clarity

    // Update local state
    setLayers((prevLayers) => {
      const updatedLayers = prevLayers.map((l) => {
        // Renamed 'layer' to 'l'
        if (l.id === activeLayerId) {
          const updatedLayerData = { ...l, elements: [] }; // Renamed for clarity

          return updatedLayerData;
        }
        return l;
      });

      return updatedLayers;
    });

    // Record this action in history
    recordAction(activeLayerId, "CLEAR_LAYER", {
      layerId: activeLayerId,
      elements: elementsToRestore, // Use renamed variable
    });

    // Clear elements in the backend
    try {
      const response = await apiClearLayerElements(activeLayerId);

      if (!response.success) {
        console.error("API error clearing layer:", response.error);
        setError(
          "Failed to clear layer: " + (response.error || "Unknown error")
        );

        // Rollback on failure
        setLayers((prevLayers) =>
          prevLayers.map(
            (
              l // Renamed 'layer' to 'l'
            ) =>
              l.id === activeLayerId ? { ...l, elements: elementsToRestore } : l // Use renamed variable
          )
        );
      }
    } catch (err) {
      console.error(
        `Error clearing elements from layer ${activeLayerId}:`,
        err
      );
      setError("Failed to clear layer. Please try again.");

      // Rollback on failure
      setLayers((prevLayers) =>
        prevLayers.map(
          (
            l // Renamed 'layer' to 'l'
          ) =>
            l.id === activeLayerId ? { ...l, elements: elementsToRestore } : l // Use renamed variable
        )
      );
    }
  }, [activeLayerId, layers, recordAction]);

  // Share a layer with another user
  const shareLayer = useCallback(
    async (layerId, userId, permission) => {
      if (!user || !layerId || !userId || !permission) return false;

      try {
        const shareData = { userId, permission };
        const response = await apiShareLayer(layerId, shareData);

        if (!response.success) {
          console.error("API error sharing layer:", response.error);
          setError(
            "Failed to share layer: " + (response.error || "Unknown error")
          );
          return false;
        }

        // Update the layer in our local state
        setLayers((prevLayers) =>
          prevLayers.map((layer) =>
            layer.id === layerId ? response.data : layer
          )
        );

        return true;
      } catch (err) {
        console.error(
          `Error sharing layer ${layerId} with user ${userId}:`,
          err
        );
        setError("Failed to share layer. Please try again.");
        return false;
      }
    },
    [user]
  );

  // Change map type
  const changeMapType = useCallback((type) => {
    if (["satellite", "street", "terrain"].includes(type)) {
      setMapType(type);
    }
  }, []);

  // Get history states for a specific layer (for UI display)
  const getLayerHistoryStates = useCallback(
    (layerId) => {
      const history = layerHistories[layerId] || {
        historyStack: [],
        futureStack: [],
      };
      return {
        canUndo: history.historyStack.length > 0,
        canRedo: history.futureStack.length > 0,
      };
    },
    [layerHistories]
  );

  const value = {
    layers,
    activeLayerId,
    mapType,
    drawingStyles,
    setDrawingStyles,
    activeDrawingTool,
    setActiveDrawingTool,
    setActiveLayerId,
    addLayer,
    removeLayer,
    toggleLayerVisibility,
    addElementToLayer,
    removeElementFromLayer,
    updateElementInLayer,
    clearActiveLayer,
    shareLayer,
    changeMapType,
    loading,
    error,
    setError,
    // History functions
    undo,
    redo,
    historyStack,
    futureStack,
    getLayerHistoryStates,
    // Fetch functions
    fetchAllLayers,
    fetchLayerById,

    // FIRMS
    showFires,
    toggleShowFires,
    fireConfig,
    applyFireConfig,
    openFireConfigDialog,
    closeFireConfigDialog,
    isFireConfigDialogOpen,
    initialRawFireConfig,
  };

  return <MapContext.Provider value={value}>{children}</MapContext.Provider>;
}
