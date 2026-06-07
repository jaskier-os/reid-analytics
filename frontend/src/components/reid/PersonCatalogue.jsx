import React, { useEffect, useRef, useCallback, useState } from 'react';
import {
  Box,
  Grid,
  Typography,
  CircularProgress,
  Alert,
  IconButton,
  Divider,
  TextField,
  InputAdornment,
  Button,
  Paper,
  Tooltip,
  Badge,
  Chip
} from '@mui/material';
import {
  Refresh,
  Search,
  CameraAlt,
  Close,
  CloudUpload,
  VisibilityOff
} from '@mui/icons-material';
import { useReid } from '../../context/ReidContext';
import PersonCard from './PersonCard';

const PersonCatalogue = ({ onPersonClick }) => {
  const {
    persons,
    pinnedPersons,
    loading,
    error,
    hasMore,
    loadPersons,
    refreshPersons,
    searchByPhoto,
    showHidden,
    setShowHidden
  } = useReid();

  const observerTarget = useRef(null);
  const loadedInitially = useRef(false);
  const fileInputRef = useRef(null);

  const [searchMode, setSearchMode] = useState(false);
  const [searchResults, setSearchResults] = useState(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [uploadingImage, setUploadingImage] = useState(false);
  const [previewImage, setPreviewImage] = useState(null);

  useEffect(() => {
    if (!loadedInitially.current && persons.length === 0 && !loading) {
      loadPersons(true);
      loadedInitially.current = true;
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [persons.length, loading]);

  const handleObserver = useCallback((entries) => {
    const target = entries[0];
    if (target.isIntersecting && hasMore && !loading && !searchMode) {
      loadPersons();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [hasMore, loading, searchMode]);

  useEffect(() => {
    const observer = new IntersectionObserver(handleObserver, {
      root: null,
      rootMargin: '20px',
      threshold: 0.1
    });

    if (observerTarget.current) {
      observer.observe(observerTarget.current);
    }

    return () => {
      if (observerTarget.current) {
        observer.unobserve(observerTarget.current);
      }
    };
  }, [handleObserver]);

  const handleImageUpload = async (event) => {
    const file = event.target.files?.[0];
    if (!file) return;

    setUploadingImage(true);
    setSearchMode(true);

    const reader = new FileReader();
    reader.onload = (e) => {
      setPreviewImage(e.target.result);
    };
    reader.readAsDataURL(file);

    try {
      const results = await searchByPhoto(file, 0.6, 20);
      // Response format from backend: { matches: [...] } or { persons: [...] }
      setSearchResults(results.matches || results.persons || []);
    } catch (err) {
      console.error('Error searching by photo:', err);
      setSearchResults([]);
    } finally {
      setUploadingImage(false);
    }
  };

  const handleClearSearch = () => {
    setSearchMode(false);
    setSearchResults(null);
    setPreviewImage(null);
    setSearchQuery('');
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  const pinnedPersonsList = persons.filter(p => pinnedPersons.includes(p.id));
  const unpinnedPersonsList = persons.filter(p => !pinnedPersons.includes(p.id));

  const displayList = searchMode && searchResults ? searchResults : unpinnedPersonsList;

  return (
    <Box
      sx={{
        height: '100%',
        display: 'flex',
        flexDirection: 'column',
        overflow: 'hidden'
      }}
    >
      <Paper
        elevation={0}
        sx={{
          p: 2,
          m: 2,
          borderRadius: 2,
          background: 'rgba(60, 56, 54, 0.7)',
          backdropFilter: 'blur(20px)',
          border: '1px solid',
          borderColor: 'rgba(250, 189, 47, 0.1)'
        }}
      >
        <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 2 }}>
          <Box>
            <Typography
              variant="h5"
              sx={{
                fontWeight: 700,
                color: '#fabd2f',
                letterSpacing: '-0.02em'
              }}
            >
              Person Catalogue
            </Typography>
            <Typography variant="caption" color="text.secondary">
              {searchMode ? `Found ${searchResults?.length || 0} matches` : `${persons.length} persons tracked`}
            </Typography>
          </Box>

          <Tooltip title="Refresh">
            <IconButton
              onClick={refreshPersons}
              disabled={loading}
              sx={{
                color: '#fabd2f',
                transition: 'all 0.2s ease',
                '&:hover': {
                  background: 'rgba(250, 189, 47, 0.1)'
                }
              }}
            >
              <Refresh />
            </IconButton>
          </Tooltip>
        </Box>

        <Box sx={{ display: 'flex', gap: 1, alignItems: 'center', mb: 1.5 }}>
          <Chip
            icon={<VisibilityOff sx={{ fontSize: 16 }} />}
            label="Show Hidden"
            size="small"
            clickable
            onClick={() => setShowHidden(!showHidden)}
            sx={{
              backgroundColor: showHidden ? 'rgba(251, 73, 52, 0.2)' : 'transparent',
              color: showHidden ? '#fb4934' : 'text.secondary',
              border: '1px solid',
              borderColor: showHidden ? 'rgba(251, 73, 52, 0.4)' : 'rgba(250, 189, 47, 0.2)',
              fontWeight: showHidden ? 600 : 400,
              transition: 'all 0.2s',
              '&:hover': {
                backgroundColor: showHidden ? 'rgba(251, 73, 52, 0.3)' : 'rgba(250, 189, 47, 0.1)'
              }
            }}
          />
        </Box>

        <Box sx={{ display: 'flex', gap: 2, alignItems: 'center' }}>
          <TextField
            fullWidth
            size="small"
            placeholder="Search by ID or filter persons..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            InputProps={{
              startAdornment: (
                <InputAdornment position="start">
                  <Search />
                </InputAdornment>
              ),
              endAdornment: searchMode && (
                <InputAdornment position="end">
                  <IconButton size="small" onClick={handleClearSearch}>
                    <Close />
                  </IconButton>
                </InputAdornment>
              ),
              sx: {
                borderRadius: 2
              }
            }}
          />

          <input
            ref={fileInputRef}
            type="file"
            accept="image/*"
            style={{ display: 'none' }}
            onChange={handleImageUpload}
          />

          <Tooltip title="Search by photo">
            <Button
              variant="outlined"
              onClick={() => fileInputRef.current?.click()}
              disabled={uploadingImage}
              startIcon={uploadingImage ? <CircularProgress size={16} /> : <CameraAlt />}
              sx={{
                minWidth: 140,
                borderWidth: 2,
                borderColor: '#d3869b',
                color: '#d3869b',
                '&:hover': {
                  borderWidth: 2,
                  borderColor: '#b16286',
                  background: 'rgba(177, 98, 134, 0.1)'
                }
              }}
            >
              Photo Search
            </Button>
          </Tooltip>
        </Box>

        {previewImage && (
          <Paper
            sx={{
              mt: 2,
              p: 2,
              borderRadius: 2,
              display: 'flex',
              alignItems: 'center',
              gap: 2,
              border: '1px solid',
              borderColor: 'rgba(250, 189, 47, 0.2)'
            }}
          >
            <img
              src={previewImage}
              alt="Search preview"
              style={{
                width: 60,
                height: 60,
                objectFit: 'cover',
                borderRadius: 8
              }}
            />
            <Box sx={{ flexGrow: 1 }}>
              <Typography variant="body2" fontWeight={600}>
                Photo Search Active
              </Typography>
              <Typography variant="caption" color="text.secondary">
                Showing similar persons
              </Typography>
            </Box>
            <IconButton onClick={handleClearSearch} size="small">
              <Close />
            </IconButton>
          </Paper>
        )}
      </Paper>

      {error && (
        <Alert severity="error" sx={{ m: 2 }}>
          {error}
        </Alert>
      )}

      <Box
        sx={{
          flexGrow: 1,
          overflow: 'auto',
          px: 2,
          pb: 2
        }}
      >
        {pinnedPersonsList.length > 0 && !searchMode && (
          <Box sx={{ mb: 3, mt: 4 }}>
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 2 }}>
              <Badge badgeContent={pinnedPersonsList.length} color="primary">
                <Typography variant="h6" sx={{ fontWeight: 600 }}>
                  Pinned Persons
                </Typography>
              </Badge>
            </Box>

            <Grid container spacing={2}>
              {pinnedPersonsList.map((person) => (
                <Grid item xs={12} sm={6} md={4} lg={3} key={person.id}>
                  <PersonCard
                    person={person}
                    onClick={() => onPersonClick(person)}
                  />
                </Grid>
              ))}
            </Grid>
            <Divider sx={{ mt: 3, mb: 2 }} />
          </Box>
        )}

        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 2 }}>
          <Typography variant="h6" sx={{ fontWeight: 600 }}>
            {searchMode ? 'Search Results' : 'All Persons'}
          </Typography>
          {searchMode && searchResults && (
            <Typography variant="caption" color="text.secondary">
              ({searchResults.length} matches)
            </Typography>
          )}
        </Box>

        {displayList.length === 0 && !loading && (
          <Paper
            sx={{
              p: 6,
              textAlign: 'center',
              borderRadius: 2,
              border: '1px solid',
              borderColor: 'rgba(250, 189, 47, 0.1)'
            }}
          >
            <CloudUpload sx={{ fontSize: 64, color: 'text.secondary', mb: 2 }} />
            <Typography variant="h6" color="text.secondary" gutterBottom>
              {searchMode ? 'No matches found' : 'No persons found'}
            </Typography>
            <Typography variant="body2" color="text.secondary">
              {searchMode
                ? 'Try uploading a different image'
                : 'Start tracking persons to see them here'}
            </Typography>
          </Paper>
        )}

        <Grid container spacing={2}>
          {displayList
            .filter(person =>
              !searchQuery ||
              person.id.toLowerCase().includes(searchQuery.toLowerCase())
            )
            .map((person) => (
              <Grid item xs={12} sm={6} md={4} lg={3} key={person.id}>
                <PersonCard
                  person={person}
                  onClick={() => onPersonClick(person)}
                  similarity={person.similarity}
                />
              </Grid>
            ))}
        </Grid>

        {loading && (
          <Box sx={{ display: 'flex', justifyContent: 'center', py: 4 }}>
            <CircularProgress />
          </Box>
        )}

        <div ref={observerTarget} style={{ height: '20px' }} />

        {!hasMore && persons.length > 0 && !searchMode && (
          <Typography
            variant="body2"
            color="text.secondary"
            sx={{ textAlign: 'center', py: 2 }}
          >
            No more persons to load
          </Typography>
        )}
      </Box>
    </Box>
  );
};

export default PersonCatalogue;
