import React from 'react';
import { Box, Chip, Typography, AvatarGroup, Avatar, Tooltip } from '@mui/material';
import { 
  CloudOff, 
  CloudQueue, 
  CloudDone, 
  CloudSync, 
  Error
} from '@mui/icons-material';

/**
 * Component to display real-time collaboration status and connected users
 * @param {Object} props
 * @param {string} props.status - Connection status: "connected", "connecting", "error", "disconnected"
 * @param {Array} props.collaborators - Array of connected users
 * @param {boolean} props.compact - Whether to show compact version
 * @param {Function} props.onUserClick - Callback function when user avatar/chip is clicked
 */
const CollaborationStatus = ({ 
  status, 
  collaborators = [], 
  compact = false,
  onUserClick 
}) => {
  // Get status icon and color
  const getStatusInfo = () => {
    switch (status) {
      case 'connected':
        return {
          icon: <CloudDone />,
          color: 'success.main',
          text: 'Connected'
        };
      case 'connecting':
        return {
          icon: <CloudSync />,
          color: 'info.main',
          text: 'Connecting...'
        };
      case 'error':
        return {
          icon: <Error />,
          color: 'error.main',
          text: 'Connection error'
        };
      case 'disconnected':
      default:
        return {
          icon: <CloudOff />,
          color: 'text.secondary',
          text: 'Offline'
        };
    }
  };
  
  const statusInfo = getStatusInfo();
  
  // Handle user click
  const handleUserClick = (user) => {
    if (onUserClick && user) {
      onUserClick(user);
    }
  };
  
  // Compact version for use in headers
  if (compact) {
    return (
      <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
        <Tooltip title={statusInfo.text}>
          <Box sx={{ color: statusInfo.color }}>
            {statusInfo.icon}
          </Box>
        </Tooltip>
        
        {collaborators.length > 0 && (
          <AvatarGroup 
            max={3}
            sx={{ 
              '& .MuiAvatar-root': { 
                width: 24, 
                height: 24, 
                fontSize: '0.75rem' 
              } 
            }}
          >
            {collaborators.map(user => (
              <Tooltip key={user.id} title={user.name || user.id}>
                <Avatar 
                  sx={{ 
                    bgcolor: user.color || 'primary.main',
                    width: 24,
                    height: 24,
                    cursor: onUserClick ? 'pointer' : 'default'
                  }}
                  onClick={() => handleUserClick(user)}
                >
                  {(user.name || user.id)?.charAt(0).toUpperCase() || 'U'}
                </Avatar>
              </Tooltip>
            ))}
          </AvatarGroup>
        )}
      </Box>
    );
  }
  
  // Full version for standalone display
  return (
    <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1 }}>
      <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
        <Box sx={{ color: statusInfo.color }}>
          {statusInfo.icon}
        </Box>
        <Typography variant="body2">{statusInfo.text}</Typography>
      </Box>
      
      {collaborators.length > 0 && (
        <Box>
          <Typography variant="caption" color="text.secondary" sx={{ mb: 0.5, display: 'block' }}>
            {collaborators.length} {collaborators.length === 1 ? 'user' : 'users'} connected
          </Typography>
          
          <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 0.5 }}>
            {collaborators.map(user => (
              <Chip
                key={user.id}
                size="small"
                label={user.name || user.id}
                avatar={
                  <Avatar 
                    sx={{ bgcolor: user.color || 'primary.main' }}
                  >
                    {(user.name || user.id)?.charAt(0).toUpperCase() || 'U'}
                  </Avatar>
                }
                onClick={() => handleUserClick(user)}
                sx={{ 
                  cursor: onUserClick ? 'pointer' : 'default',
                  '&:hover': onUserClick ? { 
                    boxShadow: '0 0 0 1px rgba(0,0,0,0.1)', 
                    bgcolor: 'rgba(0,0,0,0.04)' 
                  } : {}
                }}
              />
            ))}
          </Box>
        </Box>
      )}
    </Box>
  );
};

export default CollaborationStatus;