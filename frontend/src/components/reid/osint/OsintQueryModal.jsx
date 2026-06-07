import React, { useState } from 'react';
import {
  Dialog, DialogTitle, DialogContent, DialogActions,
  Button, Typography, Box, CircularProgress, Alert,
  ToggleButtonGroup, ToggleButton
} from '@mui/material';
import { Policy, OpenInNew } from '@mui/icons-material';
import reidService from '../../../services/reidService';

// Determine sherlock searchType from the data type
const SEARCH_TYPE_MAP = {
  phone: 'phone',
  name: 'name',
  username: 'username',
  telegram_id: 'telegram_id',
  vk: 'username'
};

const OsintQueryModal = ({ open, onClose, personId, dataType, dataValue, linkUrl, onComplete, botUsername }) => {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [service, setService] = useState('sherlock');

  const isVkLink = linkUrl && (linkUrl.includes('vk.com') || linkUrl.includes('ok.ru'));
  const isTelegramType = (dataType === 'username' || dataType === 'telegram_id') && !isVkLink;

  const handleRun = async () => {
    setLoading(true);
    setError(null);
    try {
      const params = { query: dataValue };
      if (service === 'sherlock') {
        params.service = 'sherlock';
        params.searchType = SEARCH_TYPE_MAP[dataType] || 'username';
        if (botUsername) {
          params.options = { botUsername };
        }
      } else {
        params.service = 'telelog';
      }
      await reidService.searchPersonInfo(personId, params);
      onComplete?.();
      onClose();
    } catch (err) {
      setError(err.response?.data?.error || err.message || 'OSINT lookup failed');
    } finally {
      setLoading(false);
    }
  };

  const handleOpenLink = () => {
    window.open(linkUrl, '_blank', 'noopener,noreferrer');
  };

  return (
    <Dialog
      open={open}
      onClose={loading ? undefined : onClose}
      PaperProps={{
        sx: {
          background: 'rgba(40, 40, 40, 0.98)',
          border: '1px solid',
          borderColor: 'rgba(250, 189, 47, 0.3)',
          borderRadius: 3,
          minWidth: 380
        }
      }}
    >
      <DialogTitle sx={{ display: 'flex', alignItems: 'center', gap: 1, pb: 1 }}>
        <Policy sx={{ color: '#fabd2f' }} />
        <Typography variant="subtitle1" sx={{ fontWeight: 700 }}>
          OSINT Lookup
        </Typography>
      </DialogTitle>

      <DialogContent>
        <Typography variant="body2" color="text.secondary" sx={{ mb: 1.5 }}>
          Run analysis on:
        </Typography>
        <Box
          sx={{
            p: 1.5,
            borderRadius: 1,
            border: '1px solid',
            borderColor: 'rgba(250, 189, 47, 0.2)',
            background: 'rgba(250, 189, 47, 0.05)',
            mb: 2
          }}
        >
          <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mb: 0.25 }}>
            {dataType}
          </Typography>
          <Typography variant="body2" sx={{ fontFamily: 'monospace', fontWeight: 600, color: '#fabd2f', wordBreak: 'break-all' }}>
            {dataValue}
          </Typography>
        </Box>

        {isTelegramType && (
          <Box sx={{ mb: 2 }}>
            <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mb: 0.5 }}>
              Service
            </Typography>
            <ToggleButtonGroup
              value={service}
              exclusive
              onChange={(e, v) => { if (v) setService(v); }}
              size="small"
              fullWidth
            >
              <ToggleButton
                value="sherlock"
                sx={{
                  color: 'text.secondary',
                  '&.Mui-selected': {
                    color: '#fabd2f',
                    backgroundColor: 'rgba(250, 189, 47, 0.15)',
                    '&:hover': { backgroundColor: 'rgba(250, 189, 47, 0.25)' }
                  }
                }}
              >
                Sherlock
              </ToggleButton>
              <ToggleButton
                value="telelog"
                sx={{
                  color: 'text.secondary',
                  '&.Mui-selected': {
                    color: '#83a598',
                    backgroundColor: 'rgba(131, 165, 152, 0.15)',
                    '&:hover': { backgroundColor: 'rgba(131, 165, 152, 0.25)' }
                  }
                }}
              >
                Telelog
              </ToggleButton>
            </ToggleButtonGroup>
          </Box>
        )}

        {error && (
          <Alert severity="error" sx={{ mt: 1 }}>
            {error}
          </Alert>
        )}
      </DialogContent>

      <DialogActions sx={{ px: 3, pb: 2 }}>
        <Button
          onClick={onClose}
          disabled={loading}
          sx={{ color: 'text.secondary' }}
        >
          Cancel
        </Button>
        {linkUrl && (
          <Button
            onClick={handleOpenLink}
            disabled={loading}
            startIcon={<OpenInNew sx={{ fontSize: 16 }} />}
            sx={{
              color: '#83a598',
              borderColor: 'rgba(131, 165, 152, 0.4)',
              '&:hover': { borderColor: '#83a598', backgroundColor: 'rgba(131, 165, 152, 0.1)' }
            }}
            variant="outlined"
          >
            Open Link
          </Button>
        )}
        <Button
          onClick={handleRun}
          disabled={loading}
          variant="contained"
          sx={{
            backgroundColor: '#fabd2f',
            color: '#282828',
            fontWeight: 700,
            '&:hover': { backgroundColor: '#d79921' }
          }}
        >
          {loading ? <CircularProgress size={20} sx={{ color: '#282828' }} /> : 'Query Sherlock'}
        </Button>
      </DialogActions>
    </Dialog>
  );
};

export default OsintQueryModal;
