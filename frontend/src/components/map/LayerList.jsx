import React, { useState, useEffect } from 'react';
import { 
  List, 
  ListItem, 
  ListItemText, 
  ListItemSecondaryAction, 
  IconButton, 
  ListItemIcon,
  Tooltip,
  Menu,
  MenuItem,
  Typography,
  TextField,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Button,
  Box,
  CircularProgress,
  Alert
} from '@mui/material';
import { 
  Visibility, 
  VisibilityOff, 
  MoreVert, 
  Delete, 
  Edit,
  ContentCopy,
  ArrowUpward,
  ArrowDownward,
  Layers,
  Undo,
  Redo,
  Add as AddIcon,
  Refresh
} from '@mui/icons-material';
import { useMap } from '../../context/MapContext';
import LayerItem from './LayerItem';
import { updateLayer } from '../../services/layerService';

const LayerList = () => {
  const { 
    layers, 
    setActiveLayerId, 
    activeLayerId, 
    toggleLayerVisibility, 
    removeLayer, 
    getLayerHistoryStates,
    undo,
    redo,
    addLayer,
    loading,
    error,
    fetchAllLayers
  } = useMap();
  
  const [menuAnchorEl, setMenuAnchorEl] = useState(null);
  const [selectedLayerId, setSelectedLayerId] = useState(null);
  const [renameDialogOpen, setRenameDialogOpen] = useState(false);
  const [newLayerName, setNewLayerName] = useState('');
  const [layerHistoryStates, setLayerHistoryStates] = useState({});
  const [createDialogOpen, setCreateDialogOpen] = useState(false);
  const [newLayerNameCreate, setNewLayerNameCreate] = useState('');
  const [isRenaming, setIsRenaming] = useState(false);
  const [renameError, setRenameError] = useState(null);
  
  // Update history states when layers change
  useEffect(() => {
    const newHistoryStates = {};
    layers.forEach(layer => {
      newHistoryStates[layer.id] = getLayerHistoryStates(layer.id);
    });
    setLayerHistoryStates(newHistoryStates);
  }, [layers, getLayerHistoryStates]);
  
  // Handle layer click - set as active
  const handleLayerClick = (layerId) => {
    setActiveLayerId(layerId);
  };
  
  // Handle layer visibility toggle
  const handleVisibilityToggle = (e, layerId) => {
    e.stopPropagation();
    toggleLayerVisibility(layerId);
  };
  
  // Handle opening the layer menu
  const handleMenuOpen = (e, layerId) => {
    e.stopPropagation();
    setSelectedLayerId(layerId);
    setMenuAnchorEl(e.currentTarget);
  };
  
  // Handle closing the layer menu
  const handleMenuClose = () => {
    setMenuAnchorEl(null);
  };
  
  // Handle layer deletion
  const handleDeleteLayer = () => {
    removeLayer(selectedLayerId);
    handleMenuClose();
  };
  
  // Handle opening the rename dialog
  const handleRenameClick = () => {
    const layer = layers.find(l => l.id === selectedLayerId);
    if (layer) {
      setNewLayerName(layer.name);
      setRenameDialogOpen(true);
    }
    handleMenuClose();
  };
  
  // Handle closing the rename dialog
  const handleRenameDialogClose = () => {
    setRenameDialogOpen(false);
    setRenameError(null);
  };
  
  // Handle submitting the rename
  const handleRenameSubmit = async () => {
    setIsRenaming(true);
    setRenameError(null);
    
    try {
      // Find the layer to update
      const layer = layers.find(l => l.id === selectedLayerId);
      if (layer) {
        // Update layer with new name
        const updatedLayer = { ...layer, name: newLayerName };
        
        // Call API to update the layer
        await updateLayer(selectedLayerId, updatedLayer);
        
        // Update local state - already handled by API integration
        // Close dialog
        setRenameDialogOpen(false);
      }
    } catch (err) {
      console.error('Error renaming layer:', err);
      setRenameError('Failed to rename layer. Please try again.');
    } finally {
      setIsRenaming(false);
    }
  };
  
  // Handle duplicating a layer
  const handleDuplicateLayer = async () => {
    const layer = layers.find(l => l.id === selectedLayerId);
    if (layer) {
      // Create a new layer with the same properties
      await addLayer(`${layer.name} (Copy)`);
    }
    handleMenuClose();
  };

  
  // Handle opening create dialog
  const handleCreateDialogOpen = () => {
    setNewLayerNameCreate('New Layer');
    setCreateDialogOpen(true);
  };
  
  // Handle closing create dialog
  const handleCreateDialogClose = () => {
    setCreateDialogOpen(false);
  };
  
  // Handle creating a new layer
  const handleCreateLayer = async () => {
    await addLayer(newLayerNameCreate);
    setCreateDialogOpen(false);
  };
  
  // Handle manual refresh
  const handleRefresh = () => {
    fetchAllLayers();
  };

  return (
    <>
      {/* Layer List Header */}
      <Box sx={{ display: 'flex', justifyContent: 'space-between', p: 1, alignItems: 'center' }}>
        <Typography variant="subtitle1">Layers</Typography>
        <Box>
          <Tooltip title="Refresh Layers">
            <IconButton size="small" onClick={handleRefresh}>
              <Refresh fontSize="small" />
            </IconButton>
          </Tooltip>
          <Tooltip title="Add New Layer">
            <IconButton size="small" onClick={handleCreateDialogOpen}>
              <AddIcon fontSize="small" />
            </IconButton>
          </Tooltip>
        </Box>
      </Box>
      
      {/* Error State */}
      {error && (
        <Alert severity="error" sx={{ m: 1 }}>
          {error}
        </Alert>
      )}
      
      {/* Loading State */}
      {loading && (
        <Box sx={{ display: 'flex', justifyContent: 'center', p: 2 }}>
          <CircularProgress size={24} />
        </Box>
      )}
      
      {/* Empty State */}
      {!loading && layers.length === 0 && (
        <Box 
          sx={{ 
            display: 'flex', 
            flexDirection: 'column', 
            alignItems: 'center', 
            justifyContent: 'center',
            p: 3,
            height: '200px',
            textAlign: 'center'
          }}
        >
          <Layers sx={{ fontSize: 40, color: 'text.secondary', mb: 2 }} />
          <Typography variant="body1" color="text.secondary">
            No layers yet. Create a new layer to start drawing on the map.
          </Typography>
          <Button 
            variant="contained" 
            startIcon={<AddIcon />}
            sx={{ mt: 2 }}
            onClick={handleCreateDialogOpen}
          >
            Create Layer
          </Button>
        </Box>
      )}

      {/* Layer List */}
      {!loading && layers.length > 0 && (
        <List disablePadding>
          {layers.map((layer) => (
            <LayerItem 
              key={layer.id}
              layer={layer}
              isActive={layer.id === activeLayerId}
              onLayerClick={() => handleLayerClick(layer.id)}
              onVisibilityToggle={(e) => handleVisibilityToggle(e, layer.id)}
              onMenuOpen={(e) => handleMenuOpen(e, layer.id)}
              historyState={layerHistoryStates[layer.id]}
            />
          ))}
        </List>
      )}

      {/* Layer Action Menu */}
      <Menu
        anchorEl={menuAnchorEl}
        open={Boolean(menuAnchorEl)}
        onClose={handleMenuClose}
      >
        <MenuItem onClick={handleRenameClick}>
          <ListItemIcon>
            <Edit fontSize="small" />
          </ListItemIcon>
          <ListItemText primary="Rename" />
        </MenuItem>
        <MenuItem onClick={handleDuplicateLayer}>
          <ListItemIcon>
            <ContentCopy fontSize="small" />
          </ListItemIcon>
          <ListItemText primary="Duplicate" />
        </MenuItem>
        <MenuItem onClick={handleDeleteLayer}>
          <ListItemIcon>
            <Delete fontSize="small" color="error" />
          </ListItemIcon>
          <ListItemText primary="Delete" primaryTypographyProps={{ color: 'error' }} />
        </MenuItem>
      </Menu>

      {/* Rename Dialog */}
      <Dialog open={renameDialogOpen} onClose={handleRenameDialogClose}>
        <DialogTitle>Rename Layer</DialogTitle>
        <DialogContent>
          {renameError && (
            <Alert severity="error" sx={{ mb: 2 }}>
              {renameError}
            </Alert>
          )}
          <TextField
            autoFocus
            margin="dense"
            label="Layer Name"
            type="text"
            fullWidth
            value={newLayerName}
            onChange={(e) => setNewLayerName(e.target.value)}
            disabled={isRenaming}
          />
        </DialogContent>
        <DialogActions>
          <Button onClick={handleRenameDialogClose} disabled={isRenaming}>Cancel</Button>
          <Button 
            onClick={handleRenameSubmit} 
            variant="contained" 
            disabled={isRenaming || !newLayerName.trim()}
          >
            {isRenaming ? <CircularProgress size={24} /> : 'Save'}
          </Button>
        </DialogActions>
      </Dialog>
      
      {/* Create Layer Dialog */}
      <Dialog open={createDialogOpen} onClose={handleCreateDialogClose}>
        <DialogTitle>Create New Layer</DialogTitle>
        <DialogContent>
          <TextField
            autoFocus
            margin="dense"
            label="Layer Name"
            type="text"
            fullWidth
            value={newLayerNameCreate}
            onChange={(e) => setNewLayerNameCreate(e.target.value)}
          />
        </DialogContent>
        <DialogActions>
          <Button onClick={handleCreateDialogClose}>Cancel</Button>
          <Button 
            onClick={handleCreateLayer} 
            variant="contained"
            disabled={!newLayerNameCreate.trim()}
          >
            Create
          </Button>
        </DialogActions>
      </Dialog>
    </>
  );
};

export default LayerList;