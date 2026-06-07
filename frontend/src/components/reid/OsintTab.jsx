import React, { useState, useCallback } from 'react';
import { Box, Typography, Chip, Divider, Button, Grid, CircularProgress, TextField } from '@mui/material';
import { Policy, Phone, AlternateEmail, Badge, Fingerprint, PhotoCamera } from '@mui/icons-material';
import reidService from '../../services/reidService';
import SherlockPhoneSection from './osint/SherlockPhoneSection';
import SherlockTelegramSection from './osint/SherlockTelegramSection';
import SherlockPhotoSection from './osint/SherlockPhotoSection';
import SherlockNameSection from './osint/SherlockNameSection';
import TelelogSection from './osint/TelelogSection';
import OsintSection from './osint/OsintSection';
import OsintQueryModal from './osint/OsintQueryModal';

const KNOWN_SOURCES = new Set([
  'sherlock_phone', 'sherlock_telegram_id', 'sherlock_username',
  'sherlock_photo', 'sherlock_name', 'telelog'
]);

const SOURCE_LABELS = {
  sherlock_phone: 'Phone',
  sherlock_telegram_id: 'Telegram ID',
  sherlock_username: 'Username',
  sherlock_photo: 'Photo',
  sherlock_name: 'Name',
  telelog: 'Telelog'
};

// Extract all key identifiers across all sources for the summary panel
const extractIdentifiers = (info) => {
  const ids = { names: new Set(), phones: new Set(), emails: new Set(), telegramIds: new Set(), usernames: new Set() };

  for (const [, source] of Object.entries(info)) {
    if (!source || typeof source !== 'object') continue;

    if (source.names) source.names.forEach(n => ids.names.add(n));
    if (source.fullName) ids.names.add(source.fullName);
    if (source.displayName) ids.names.add(source.displayName);
    if (source.persons) source.persons.forEach(p => {
      if (p.fullName) ids.names.add(p.fullName);
      if (p.firstName) ids.names.add(p.firstName);
    });

    if (source.phone) ids.phones.add(source.phone);
    if (source.persons) source.persons.forEach(p => { if (p.phone) ids.phones.add(p.phone); });

    if (source.emailAddresses) source.emailAddresses.forEach(e => ids.emails.add(e));

    if (source.telegramId) ids.telegramIds.add(source.telegramId);
    if (source.username) ids.usernames.add(source.username.replace(/^@/, ''));
    if (source.usernames) source.usernames.forEach(u => ids.usernames.add(u.replace(/^@/, '')));
  }

  return {
    names: [...ids.names],
    phones: [...ids.phones],
    emails: [...ids.emails],
    telegramIds: [...ids.telegramIds],
    usernames: [...ids.usernames]
  };
};

const QueryableChip = ({ onClick, ...props }) => (
  <Chip
    {...props}
    clickable
    onClick={onClick}
    sx={{
      ...props.sx,
      cursor: 'pointer',
      '&:hover': {
        ...(props.sx?.['&:hover'] || {}),
        outline: '1px solid #fabd2f',
        outlineOffset: 1
      }
    }}
  />
);

const OsintTab = ({ informationFound, personId, snapshots, onDataUpdated }) => {
  const [queryModal, setQueryModal] = useState(null);
  const [showSnapshotPicker, setShowSnapshotPicker] = useState(false);
  const [photoSearchLoading, setPhotoSearchLoading] = useState(false);
  const [botTag, setBotTag] = useState(() => localStorage.getItem('sherlockBotTag') || '');

  const openQuery = useCallback((dataType, dataValue, linkUrl) => {
    setQueryModal({ dataType, dataValue, linkUrl });
  }, []);

  if (!informationFound || typeof informationFound !== 'object' || Object.keys(informationFound).length === 0) {
    return (
      <Box sx={{ display: 'flex', flexDirection: 'column', alignItems: 'center', py: 6 }}>
        <Policy sx={{ fontSize: 48, color: 'text.secondary', mb: 1 }} />
        <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
          No OSINT data available
        </Typography>
        <TextField
          label="Sherlock bot"
          placeholder="@username_bot"
          size="small"
          value={botTag}
          onChange={(e) => {
            const v = e.target.value;
            setBotTag(v);
            if (v.trim()) {
              localStorage.setItem('sherlockBotTag', v.trim());
            } else {
              localStorage.removeItem('sherlockBotTag');
            }
          }}
          sx={{
            mb: 2,
            width: 250,
            '& .MuiOutlinedInput-root': {
              color: '#ebdbb2',
              '& fieldset': { borderColor: 'rgba(250, 189, 47, 0.3)' },
              '&:hover fieldset': { borderColor: 'rgba(250, 189, 47, 0.5)' },
              '&.Mui-focused fieldset': { borderColor: '#fabd2f' }
            },
            '& .MuiInputLabel-root': { color: 'text.secondary' },
            '& .MuiInputLabel-root.Mui-focused': { color: '#fabd2f' }
          }}
        />
        {!showSnapshotPicker ? (
          <Button
            variant="outlined"
            startIcon={<PhotoCamera />}
            onClick={() => setShowSnapshotPicker(true)}
            disabled={photoSearchLoading}
            sx={{
              color: '#fabd2f',
              borderColor: 'rgba(250, 189, 47, 0.3)',
              '&:hover': { borderColor: '#fabd2f', backgroundColor: 'rgba(250, 189, 47, 0.05)' }
            }}
          >
            Start Face Analysis
          </Button>
        ) : (
          <Box>
            <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mb: 1 }}>
              Select a snapshot for photo search:
            </Typography>
            {snapshots?.length > 0 ? (
              <Grid container spacing={1} sx={{ justifyContent: 'center' }}>
                {snapshots.filter(s => s.snapshot_path).map((sighting, i) => (
                  <Grid key={i} size={{ xs: 3, sm: 2 }}>
                    <Box
                      onClick={async () => {
                        setPhotoSearchLoading(true);
                        try {
                          await reidService.searchPersonInfo(personId, {
                            service: 'sherlock',
                            searchType: 'photo',
                            query: personId,
                            options: { snapshotUrl: sighting.snapshot_path, ...(botTag.trim() && { botUsername: botTag.trim() }) }
                          });
                          onDataUpdated?.();
                          setShowSnapshotPicker(false);
                        } catch (err) {
                          console.error('Photo search failed:', err);
                        } finally {
                          setPhotoSearchLoading(false);
                        }
                      }}
                      sx={{
                        aspectRatio: '3/4',
                        borderRadius: 1,
                        overflow: 'hidden',
                        border: '1px solid',
                        borderColor: 'rgba(255,255,255,0.1)',
                        cursor: photoSearchLoading ? 'wait' : 'pointer',
                        opacity: photoSearchLoading ? 0.5 : 1,
                        '&:hover': { borderColor: '#fabd2f' }
                      }}
                    >
                      <Box
                        component="img"
                        src={sighting.snapshot_path}
                        sx={{ width: '100%', height: '100%', objectFit: 'cover' }}
                      />
                    </Box>
                  </Grid>
                ))}
              </Grid>
            ) : (
              <Typography variant="body2" color="text.secondary">
                No snapshots available
              </Typography>
            )}
            <Box sx={{ mt: 1, display: 'flex', gap: 1, justifyContent: 'center' }}>
              <Button
                size="small"
                onClick={() => setShowSnapshotPicker(false)}
                sx={{ color: 'text.secondary' }}
              >
                Cancel
              </Button>
              {photoSearchLoading && <CircularProgress size={20} sx={{ color: '#fabd2f' }} />}
            </Box>
          </Box>
        )}
      </Box>
    );
  }

  // Filter out sources with empty/null/no-data values
  const sources = Object.keys(informationFound).filter(key => {
    const val = informationFound[key];
    if (!val || typeof val !== 'object') return false;
    if (key === 'sherlock_photo' && (!val.persons || val.persons.length === 0)) return false;
    return Object.keys(val).length > 0;
  });
  const unknownSources = sources.filter(s => !KNOWN_SOURCES.has(s));
  const ids = extractIdentifiers(informationFound);
  const hasIdentifiers = ids.names.length || ids.phones.length || ids.emails.length || ids.telegramIds.length || ids.usernames.length;

  return (
    <Box>
      {/* Identity Summary - consolidated identifiers, all queryable */}
      {hasIdentifiers && (
        <Box
          sx={{
            mb: 2,
            p: 2,
            borderRadius: 2,
            border: '1px solid',
            borderColor: 'rgba(250, 189, 47, 0.2)',
            background: 'rgba(250, 189, 47, 0.03)'
          }}
        >
          {ids.names.length > 0 && (
            <Box sx={{ display: 'flex', alignItems: 'flex-start', gap: 1, mb: ids.phones.length || ids.emails.length || ids.telegramIds.length || ids.usernames.length ? 1 : 0 }}>
              <Badge sx={{ fontSize: 16, color: '#fabd2f', mt: 0.3 }} />
              <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 0.5 }}>
                {ids.names.map((name, i) => (
                  <Typography key={i} variant="body2" sx={{ fontWeight: 700, color: '#fabd2f' }}>
                    {name}{i < ids.names.length - 1 ? ',' : ''}
                  </Typography>
                ))}
              </Box>
            </Box>
          )}

          <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 1 }}>
            {ids.phones.map((phone, i) => (
              <QueryableChip
                key={`p${i}`}
                icon={<Phone sx={{ fontSize: '0.85rem !important' }} />}
                label={phone}
                size="small"
                onClick={() => openQuery('phone', phone)}
                sx={{ fontFamily: 'monospace', backgroundColor: 'rgba(184, 187, 38, 0.15)', color: '#b8bb26', height: 24 }}
              />
            ))}
            {ids.telegramIds.map((id, i) => (
              <QueryableChip
                key={`t${i}`}
                icon={<Fingerprint sx={{ fontSize: '0.85rem !important' }} />}
                label={`TG: ${id}`}
                size="small"
                onClick={() => openQuery('telegram_id', id)}
                sx={{ fontFamily: 'monospace', backgroundColor: 'rgba(131, 165, 152, 0.15)', color: '#83a598', height: 24 }}
              />
            ))}
            {ids.usernames.map((u, i) => (
              <QueryableChip
                key={`u${i}`}
                icon={<AlternateEmail sx={{ fontSize: '0.85rem !important' }} />}
                label={u}
                size="small"
                onClick={() => openQuery('username', u)}
                sx={{ fontFamily: 'monospace', backgroundColor: 'rgba(131, 165, 152, 0.15)', color: '#83a598', height: 24 }}
              />
            ))}
            {ids.emails.map((email, i) => (
              <Chip
                key={`e${i}`}
                label={email}
                size="small"
                sx={{ fontFamily: 'monospace', backgroundColor: 'rgba(211, 134, 155, 0.15)', color: '#d3869b', height: 24 }}
              />
            ))}
          </Box>
        </Box>
      )}

      <Divider sx={{ mb: 2, borderColor: 'rgba(250, 189, 47, 0.08)' }} />

      {/* 1. Photo matches */}
      <SherlockPhotoSection data={informationFound.sherlock_photo} onQuery={openQuery} />

      {/* 2. Phone lookup */}
      <SherlockPhoneSection data={informationFound.sherlock_phone} onQuery={openQuery} />

      {/* 3. Telegram lookup */}
      {(informationFound.sherlock_telegram_id || informationFound.sherlock_username) && (
        <SherlockTelegramSection
          telegramIdData={informationFound.sherlock_telegram_id}
          usernameData={informationFound.sherlock_username}
          onQuery={openQuery}
        />
      )}

      {/* 4. Telelog profile */}
      <TelelogSection data={informationFound.telelog} onQuery={openQuery} />

      {/* 5. Name lookup */}
      <SherlockNameSection data={informationFound.sherlock_name} />

      {/* Unknown sources */}
      {unknownSources.map(source => (
        <OsintSection key={source} title={source} defaultExpanded={false}>
          <Box
            component="pre"
            sx={{
              fontFamily: 'monospace',
              fontSize: '0.75rem',
              color: 'text.secondary',
              whiteSpace: 'pre-wrap',
              wordBreak: 'break-all',
              m: 0,
              p: 1,
              borderRadius: 1,
              background: 'rgba(40, 40, 40, 0.5)',
              maxHeight: 300,
              overflow: 'auto'
            }}
          >
            {JSON.stringify(informationFound[source], null, 2)}
          </Box>
        </OsintSection>
      ))}

      {/* Bot tag + Re-run controls */}
      <Divider sx={{ my: 2, borderColor: 'rgba(250, 189, 47, 0.08)' }} />
      {!showSnapshotPicker ? (
        <Box sx={{ display: 'flex', justifyContent: 'flex-end', alignItems: 'center', gap: 1.5 }}>
          <TextField
            label="Sherlock bot"
            placeholder="@username_bot"
            size="small"
            value={botTag}
            onChange={(e) => {
              const v = e.target.value;
              setBotTag(v);
              if (v.trim()) {
                localStorage.setItem('sherlockBotTag', v.trim());
              } else {
                localStorage.removeItem('sherlockBotTag');
              }
            }}
            sx={{
              width: 180,
              '& .MuiOutlinedInput-root': {
                color: '#ebdbb2',
                fontSize: '0.85rem',
                '& fieldset': { borderColor: 'rgba(250, 189, 47, 0.2)' },
                '&:hover fieldset': { borderColor: 'rgba(250, 189, 47, 0.4)' },
                '&.Mui-focused fieldset': { borderColor: '#fabd2f' }
              },
              '& .MuiInputLabel-root': { color: 'text.secondary', fontSize: '0.85rem' },
              '& .MuiInputLabel-root.Mui-focused': { color: '#fabd2f' }
            }}
          />
          <Button
            variant="outlined"
            size="small"
            startIcon={<PhotoCamera sx={{ fontSize: 16 }} />}
            onClick={() => setShowSnapshotPicker(true)}
            disabled={photoSearchLoading}
            sx={{
              color: '#fabd2f',
              borderColor: 'rgba(250, 189, 47, 0.3)',
              whiteSpace: 'nowrap',
              '&:hover': { borderColor: '#fabd2f', backgroundColor: 'rgba(250, 189, 47, 0.05)' }
            }}
          >
            Re-run
          </Button>
        </Box>
      ) : (
        <Box>
          <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mb: 1 }}>
            Select a snapshot for photo search:
          </Typography>
          {snapshots?.length > 0 ? (
            <Grid container spacing={1}>
              {snapshots.filter(s => s.snapshot_path).map((sighting, i) => (
                <Grid key={i} size={{ xs: 3, sm: 2 }}>
                  <Box
                    onClick={async () => {
                      setPhotoSearchLoading(true);
                      try {
                        await reidService.searchPersonInfo(personId, {
                          service: 'sherlock',
                          searchType: 'photo',
                          query: personId,
                          options: { snapshotUrl: sighting.snapshot_path }
                        });
                        onDataUpdated?.();
                        setShowSnapshotPicker(false);
                      } catch (err) {
                        console.error('Photo search failed:', err);
                      } finally {
                        setPhotoSearchLoading(false);
                      }
                    }}
                    sx={{
                      aspectRatio: '3/4',
                      borderRadius: 1,
                      overflow: 'hidden',
                      border: '1px solid',
                      borderColor: 'rgba(255,255,255,0.1)',
                      cursor: photoSearchLoading ? 'wait' : 'pointer',
                      opacity: photoSearchLoading ? 0.5 : 1,
                      '&:hover': { borderColor: '#fabd2f' }
                    }}
                  >
                    <Box
                      component="img"
                      src={sighting.snapshot_path}
                      sx={{ width: '100%', height: '100%', objectFit: 'cover' }}
                    />
                  </Box>
                </Grid>
              ))}
            </Grid>
          ) : (
            <Typography variant="body2" color="text.secondary">
              No snapshots available
            </Typography>
          )}
          <Box sx={{ mt: 1, display: 'flex', gap: 1 }}>
            <Button
              size="small"
              onClick={() => setShowSnapshotPicker(false)}
              sx={{ color: 'text.secondary' }}
            >
              Cancel
            </Button>
            {photoSearchLoading && <CircularProgress size={20} sx={{ color: '#fabd2f' }} />}
          </Box>
        </Box>
      )}

      {/* OSINT Query Modal */}
      {queryModal && (
        <OsintQueryModal
          open
          onClose={() => setQueryModal(null)}
          personId={personId}
          dataType={queryModal.dataType}
          dataValue={queryModal.dataValue}
          linkUrl={queryModal.linkUrl}
          onComplete={onDataUpdated}
          botUsername={botTag.trim() || null}
        />
      )}
    </Box>
  );
};

export default OsintTab;
