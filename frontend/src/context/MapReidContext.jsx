import React, { createContext, useContext, useState, useCallback, useRef, useEffect } from 'react';
import reidService from '../services/reidService';
import { getSocket } from '../services/socketService';
import { mapSighting } from '../utils/reidMapUtils';

const MapReidContext = createContext();

export const useMapReid = () => {
  const context = useContext(MapReidContext);
  if (!context) {
    throw new Error('useMapReid must be used within MapReidProvider');
  }
  return context;
};

const PERSONS_PAGE_SIZE = 50;
const SIGHTINGS_PAGE_SIZE = 50;

export const MapReidProvider = ({ children }) => {
  const [persons, setPersons] = useState([]);
  const [personsLoading, setPersonsLoading] = useState(false);
  const [personsHasMore, setPersonsHasMore] = useState(true);
  const [personSightings, setPersonSightings] = useState({});
  const [sightingsLoadingFor, setSightingsLoadingFor] = useState(new Set());

  const [selectedPersonId, setSelectedPersonId] = useState(null);
  const [selectedSightings, setSelectedSightings] = useState([]);
  const [selectedSightingsLoading, setSelectedSightingsLoading] = useState(false);
  const [selectedSightingsHasMore, setSelectedSightingsHasMore] = useState(true);

  const [sortBy, setSortBy] = useState('date-desc');
  const [hoveredSightingId, setHoveredSightingId] = useState(null);
  const [focusedSighting, setFocusedSighting] = useState(null);
  const [showTrajectory, setShowTrajectory] = useState(true);

  const personsOffsetRef = useRef(0);
  const personsLoadingRef = useRef(false);
  const selectedOffsetRef = useRef(0);
  const selectedLoadingRef = useRef(false);

  const fetchSightingsForPersons = useCallback(async (personIds) => {
    if (personIds.length === 0) return;

    setSightingsLoadingFor(prev => {
      const next = new Set(prev);
      personIds.forEach(id => next.add(id));
      return next;
    });

    const batchSize = 10;
    for (let i = 0; i < personIds.length; i += batchSize) {
      const batch = personIds.slice(i, i + batchSize);
      const results = await Promise.allSettled(
        batch.map(pid => reidService.getPersonSightings(pid, 50, 0))
      );

      const newSightings = {};
      batch.forEach((pid, idx) => {
        if (results[idx].status === 'fulfilled') {
          newSightings[pid] = (results[idx].value.sightings || []).map(mapSighting);
        } else {
          newSightings[pid] = [];
        }
      });

      setPersonSightings(prev => ({ ...prev, ...newSightings }));
    }

    setSightingsLoadingFor(prev => {
      const next = new Set(prev);
      personIds.forEach(id => next.delete(id));
      return next;
    });
  }, []);

  const loadPersons = useCallback(async (reset = false) => {
    if (personsLoadingRef.current) return;
    personsLoadingRef.current = true;
    setPersonsLoading(true);

    try {
      const currentOffset = reset ? 0 : personsOffsetRef.current;
      const response = await reidService.getPersons(PERSONS_PAGE_SIZE, currentOffset, true);
      const newPersons = response.persons || [];

      if (reset) {
        setPersons(newPersons);
        personsOffsetRef.current = newPersons.length;
        setPersonSightings({});
      } else {
        setPersons(prev => [...prev, ...newPersons]);
        personsOffsetRef.current += newPersons.length;
      }

      setPersonsHasMore(newPersons.length >= PERSONS_PAGE_SIZE);

      const newIds = newPersons.map(p => p.id);
      fetchSightingsForPersons(newIds);
    } catch (err) {
      console.error('MapReid: Error loading persons:', err);
    } finally {
      personsLoadingRef.current = false;
      setPersonsLoading(false);
    }
  }, [fetchSightingsForPersons]);

  const selectPerson = useCallback(async (personId) => {
    if (selectedPersonId === personId) return;
    setSelectedPersonId(personId);
    setSelectedSightings([]);
    setSelectedSightingsHasMore(true);
    selectedOffsetRef.current = 0;
    setFocusedSighting(null);
    setHoveredSightingId(null);

    selectedLoadingRef.current = true;
    setSelectedSightingsLoading(true);
    try {
      const response = await reidService.getPersonSightings(personId, SIGHTINGS_PAGE_SIZE, 0);
      const items = (response.sightings || []).map(mapSighting);
      setSelectedSightings(items);
      setSelectedSightingsHasMore(items.length >= SIGHTINGS_PAGE_SIZE);
      selectedOffsetRef.current = items.length;
    } catch (err) {
      console.error('MapReid: Error loading selected sightings:', err);
    } finally {
      selectedLoadingRef.current = false;
      setSelectedSightingsLoading(false);
    }
  }, [selectedPersonId]);

  const deselectPerson = useCallback(() => {
    setSelectedPersonId(null);
    setSelectedSightings([]);
    setSelectedSightingsHasMore(true);
    selectedOffsetRef.current = 0;
    setFocusedSighting(null);
    setHoveredSightingId(null);
  }, []);

  const loadMoreSelectedSightings = useCallback(async () => {
    if (selectedLoadingRef.current || !selectedSightingsHasMore || !selectedPersonId) return;
    selectedLoadingRef.current = true;
    setSelectedSightingsLoading(true);

    try {
      const response = await reidService.getPersonSightings(
        selectedPersonId, SIGHTINGS_PAGE_SIZE, selectedOffsetRef.current
      );
      const items = (response.sightings || []).map(mapSighting);
      setSelectedSightings(prev => [...prev, ...items]);
      setSelectedSightingsHasMore(items.length >= SIGHTINGS_PAGE_SIZE);
      selectedOffsetRef.current += items.length;
    } catch (err) {
      console.error('MapReid: Error loading more sightings:', err);
    } finally {
      selectedLoadingRef.current = false;
      setSelectedSightingsLoading(false);
    }
  }, [selectedSightingsHasMore, selectedPersonId]);

  // Socket listeners
  useEffect(() => {
    const socket = getSocket();

    const onPersonCreated = ({ person }) => {
      setPersons(prev => {
        if (prev.some(p => p.id === person.id)) return prev;
        return [person, ...prev];
      });
      fetchSightingsForPersons([person.id]);
    };

    const onPersonSighting = ({ personId, sighting }) => {
      const mapped = mapSighting(sighting);
      setPersonSightings(prev => {
        const existing = prev[personId] || [];
        return { ...prev, [personId]: [mapped, ...existing] };
      });
      if (personId === selectedPersonId) {
        setSelectedSightings(prev => [mapped, ...prev]);
      }
    };

    const onPersonUpdated = ({ person }) => {
      setPersons(prev => prev.map(p => p.id === person.id ? { ...p, ...person } : p));
    };

    const onPersonDeleted = ({ personId }) => {
      setPersons(prev => prev.filter(p => p.id !== personId));
      setPersonSightings(prev => {
        const next = { ...prev };
        delete next[personId];
        return next;
      });
      if (personId === selectedPersonId) {
        deselectPerson();
      }
    };

    socket.on('person-created', onPersonCreated);
    socket.on('person-sighting', onPersonSighting);
    socket.on('person-updated', onPersonUpdated);
    socket.on('person-deleted', onPersonDeleted);

    return () => {
      socket.off('person-created', onPersonCreated);
      socket.off('person-sighting', onPersonSighting);
      socket.off('person-updated', onPersonUpdated);
      socket.off('person-deleted', onPersonDeleted);
    };
  }, [selectedPersonId, deselectPerson, fetchSightingsForPersons]);

  // Initial load
  useEffect(() => {
    loadPersons(true);
  }, [loadPersons]);

  const value = {
    persons,
    personsLoading,
    personsHasMore,
    personSightings,
    sightingsLoadingFor,
    selectedPersonId,
    selectedSightings,
    selectedSightingsLoading,
    selectedSightingsHasMore,
    sortBy,
    hoveredSightingId,
    focusedSighting,
    showTrajectory,
    loadPersons,
    selectPerson,
    deselectPerson,
    loadMoreSelectedSightings,
    setSortBy,
    setHoveredSightingId,
    setFocusedSighting,
    setShowTrajectory
  };

  return (
    <MapReidContext.Provider value={value}>
      {children}
    </MapReidContext.Provider>
  );
};
