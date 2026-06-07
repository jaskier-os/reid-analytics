import React, {
  createContext,
  useContext,
  useState,
  useCallback,
  useEffect,
  useRef,
} from "react";
import L from "leaflet";
import { useMap } from "./MapContext";

const LeafletContext = createContext();

export function useLeafletContext() {
  return useContext(LeafletContext);
}

export function LeafletProvider({ children }) {
  const [map, setMap] = useState(null);
  const [featureGroup, setFeatureGroup] = useState(null);
  const [drawControl, setDrawControl] = useState(null);


  const value = {
    map,
    setMap,
    featureGroup,
    setFeatureGroup,
    drawControl,
    setDrawControl,
  };

  return (
    <LeafletContext.Provider value={value}>{children}</LeafletContext.Provider>
  );
}