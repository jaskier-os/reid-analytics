import React from 'react';
import { 
  ListItem, 
  ListItemButton,
  ListItemIcon,
  ListItemText, 
  IconButton, 
  Tooltip,
  Badge,
} from '@mui/material';
import { 
  Visibility, 
  VisibilityOff, 
  MoreVert, 
  Circle
} from '@mui/icons-material';

const LayerItem = ({ 
  layer, 
  isActive, 
  onLayerClick, 
  onVisibilityToggle, 
  onMenuOpen,
  historyState 
}) => {
  // If historyState is provided, we can show undo/redo availability
  const { canUndo, canRedo } = historyState || { canUndo: false, canRedo: false };
  
  return (
    <ListItem 
      disablePadding 
      secondaryAction={
        <>
          <Tooltip title={layer.visible ? "Hide Layer" : "Show Layer"}>
            <IconButton 
              edge="end" 
              onClick={onVisibilityToggle}
              size="small"
            >
              {layer.visible ? <Visibility /> : <VisibilityOff />}
            </IconButton>
          </Tooltip>
          <Tooltip title="Layer Options">
            <IconButton 
              edge="end" 
              onClick={onMenuOpen}
              size="small"
            >
              <MoreVert />
            </IconButton>
          </Tooltip>
        </>
      }
      sx={{ 
        pr: 8, // Space for the action buttons
        opacity: layer.visible ? 1 : 0.5
      }}
    >
      <ListItemButton 
        selected={isActive}
        onClick={onLayerClick}
        dense
      >
        <ListItemIcon sx={{ minWidth: 32 }}>
          <Badge
            color="primary"
            variant="dot"
            invisible={!isActive || (!canUndo && !canRedo)}
            sx={{
              '& .MuiBadge-badge': {
                right: 3,
                top: 3,
              },
            }}
          >
            <Circle sx={{ 
              fontSize: 12, 
              color: isActive ? 'primary.main' : 'text.secondary' 
            }} />
          </Badge>
        </ListItemIcon>
        <ListItemText 
          primary={layer.name} 
          secondary={`${layer.elements.length} elements${!layer.visible ? ' (hidden)' : ''}`}
          primaryTypographyProps={{
            variant: 'body2',
            fontWeight: isActive ? 'bold' : 'regular',
          }}
          secondaryTypographyProps={{
            variant: 'caption',
          }}
        />
      </ListItemButton>
    </ListItem>
  );
};

export default LayerItem;