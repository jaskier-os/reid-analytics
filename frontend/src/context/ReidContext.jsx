import React, { createContext, useContext, useState, useCallback, useRef, useEffect } from 'react';
import reidService from '../services/reidService';
import { getSocket } from '../services/socketService';

const ReidContext = createContext();

export const useReid = () => {
  const context = useContext(ReidContext);
  if (!context) {
    throw new Error('useReid must be used within ReidProvider');
  }
  return context;
};

export const ReidProvider = ({ children }) => {
  const [persons, setPersons] = useState([]);
  const [pinnedPersons, setPinnedPersons] = useState([]);
  const [selectedPerson, setSelectedPerson] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [hasMore, setHasMore] = useState(true);
  const [offset, setOffset] = useState(0);
  const [showHidden, setShowHiddenState] = useState(false);

  const loadingRef = useRef(false);
  const offsetRef = useRef(0);
  const errorCountRef = useRef(0);
  const lastErrorTimeRef = useRef(0);
  const showHiddenRef = useRef(false);

  const loadPersons = useCallback(async (reset = false) => {
    if (loadingRef.current) return;

    // Prevent flooding on repeated errors
    const now = Date.now();
    if (errorCountRef.current > 0 && now - lastErrorTimeRef.current < 5000) {
      console.warn('Too many errors, throttling requests');
      return;
    }

    try {
      loadingRef.current = true;
      setLoading(true);
      setError(null);

      const currentOffset = reset ? 0 : offsetRef.current;
      const isActive = showHiddenRef.current ? undefined : true;
      const response = await reidService.getPersons(20, currentOffset, isActive);

      // Response format: { persons: [...], count, limit, offset }
      if (response && Array.isArray(response.persons)) {
        const newPersons = response.persons;

        if (reset) {
          setPersons(newPersons);
          offsetRef.current = 20;
          setOffset(20);
        } else {
          setPersons(prev => [...prev, ...newPersons]);
          offsetRef.current += 20;
          setOffset(prev => prev + 20);
        }

        if (newPersons.length < 20) {
          setHasMore(false);
        }

        // Reset error count on success
        errorCountRef.current = 0;
      } else {
        console.error('Invalid response:', response);
        throw new Error('Invalid response format: expected { persons: [...] }');
      }
    } catch (err) {
      console.error('Error loading persons:', err);
      setError(typeof err === 'string' ? err : (err.message || 'Failed to load persons'));
      errorCountRef.current++;
      lastErrorTimeRef.current = Date.now();
    } finally {
      loadingRef.current = false;
      setLoading(false);
    }
  }, []);

  const refreshPersons = useCallback(async () => {
    offsetRef.current = 0;
    setOffset(0);
    setHasMore(true);
    await loadPersons(true);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const togglePin = useCallback((personId) => {
    setPinnedPersons(prev => {
      if (prev.includes(personId)) {
        return prev.filter(id => id !== personId);
      } else {
        return [...prev, personId];
      }
    });
  }, []);

  const isPinned = useCallback((personId) => {
    return pinnedPersons.includes(personId);
  }, [pinnedPersons]);

  const selectPerson = useCallback((person) => {
    setSelectedPerson(person);
  }, []);

  const setShowHidden = useCallback((val) => {
    showHiddenRef.current = val;
    setShowHiddenState(val);
    offsetRef.current = 0;
    setOffset(0);
    setHasMore(true);
    loadPersons(true);
  }, [loadPersons]);

  const hidePerson = useCallback(async (personId) => {
    try {
      await reidService.hidePerson(personId);
      setPersons(prev => prev.filter(p => p.id !== personId));
      if (selectedPerson?.id === personId) {
        setSelectedPerson(null);
      }
    } catch (err) {
      console.error('Error hiding person:', err);
      setError(err.message || 'Failed to hide person');
    }
  }, [selectedPerson]);

  const unhidePerson = useCallback(async (personId) => {
    try {
      await reidService.unhidePerson(personId);
      setPersons(prev => prev.map(p =>
        p.id === personId ? { ...p, is_active: true } : p
      ));
    } catch (err) {
      console.error('Error unhiding person:', err);
      setError(err.message || 'Failed to unhide person');
    }
  }, []);

  const deletePerson = useCallback(async (personId) => {
    try {
      await reidService.deletePerson(personId);
      setPersons(prev => prev.filter(p => p.id !== personId));
      if (selectedPerson?.id === personId) {
        setSelectedPerson(null);
      }
    } catch (err) {
      console.error('Error deleting person:', err);
      setError(err.message || 'Failed to delete person');
    }
  }, [selectedPerson]);

  useEffect(() => {
    const socket = getSocket();

    const onPersonCreated = ({ person }) => {
      setPersons(prev => {
        if (prev.some(p => p.id === person.id)) return prev;
        return [person, ...prev];
      });
    };

    const onPersonUpdated = ({ person }) => {
      setPersons(prev => prev.map(p => p.id === person.id ? { ...p, ...person } : p));
    };

    const onPersonDeleted = ({ personId }) => {
      setPersons(prev => prev.filter(p => p.id !== personId));
      setSelectedPerson(prev => prev?.id === personId ? null : prev);
    };

    socket.on('person-created', onPersonCreated);
    socket.on('person-updated', onPersonUpdated);
    socket.on('person-deleted', onPersonDeleted);

    return () => {
      socket.off('person-created', onPersonCreated);
      socket.off('person-updated', onPersonUpdated);
      socket.off('person-deleted', onPersonDeleted);
    };
  }, []);

  const searchByPhoto = useCallback(async (imageFile, threshold = 0.7, limit = 10) => {
    try {
      setLoading(true);
      setError(null);
      const response = await reidService.searchByPhoto(imageFile, threshold, limit);
      return response;
    } catch (err) {
      console.error('Error searching by photo:', err);
      setError(err.message || 'Failed to search by photo');
      throw err;
    } finally {
      setLoading(false);
    }
  }, []);

  const value = {
    persons,
    pinnedPersons,
    selectedPerson,
    loading,
    error,
    hasMore,
    showHidden,
    loadPersons,
    refreshPersons,
    togglePin,
    isPinned,
    selectPerson,
    searchByPhoto,
    setShowHidden,
    hidePerson,
    unhidePerson,
    deletePerson
  };

  return (
    <ReidContext.Provider value={value}>
      {children}
    </ReidContext.Provider>
  );
};

export default ReidContext;
