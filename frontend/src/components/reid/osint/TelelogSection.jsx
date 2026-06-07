import React from 'react';
import {
  Box, Typography, Chip, Grid, Link, LinearProgress
} from '@mui/material';
import {
  Chat, Forum, Reply, Image, Mic, Circle,
  AccessTime, History, Star, Campaign, OpenInNew
} from '@mui/icons-material';
import OsintSection from './OsintSection';

const StatItem = ({ icon, label, value, color }) => (
  <Box
    sx={{
      p: 1.5,
      borderRadius: 1,
      border: '1px solid',
      borderColor: 'rgba(250, 189, 47, 0.1)',
      background: 'rgba(40, 40, 40, 0.5)',
      display: 'flex',
      alignItems: 'center',
      gap: 1
    }}
  >
    <Box sx={{ color: color || 'text.secondary', display: 'flex' }}>{icon}</Box>
    <Box>
      <Typography variant="caption" color="text.secondary" sx={{ display: 'block', lineHeight: 1.2 }}>
        {label}
      </Typography>
      <Typography variant="body2" sx={{ fontWeight: 600, fontFamily: 'monospace' }}>
        {value}
      </Typography>
    </Box>
  </Box>
);

const queryableStyle = {
  cursor: 'pointer',
  '&:hover': { outline: '1px solid #fabd2f', outlineOffset: 1 }
};

const TelelogSection = ({ data, onQuery }) => {
  if (!data) return null;

  const {
    displayName, profileUrl, messageDiversity,
    dateFrom, dateTo, messageCount, chatCount,
    replyPercentage, mediaPercentage, circles, voice,
    telegramId, usernames, stickerPackUrl, stickerPackCount,
    favoriteChat, reputation, channel, nameHistory
  } = data;

  return (
    <OsintSection
      title="Telelog Profile"
      icon={<Forum fontSize="small" />}
      chipLabel={displayName}
    >
      {/* Profile Header */}
      <Box sx={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: 1, mb: 2 }}>
        {displayName && (
          <Typography variant="body1" sx={{ fontWeight: 700, color: '#fabd2f' }}>
            {displayName}
          </Typography>
        )}
        {telegramId && (
          <Chip
            label={`ID: ${telegramId}`}
            size="small"
            clickable
            onClick={() => onQuery?.('telegram_id', telegramId)}
            sx={{ fontFamily: 'monospace', backgroundColor: 'rgba(131, 165, 152, 0.2)', color: '#83a598', ...queryableStyle }}
          />
        )}
      </Box>

      {/* Profile URL */}
      {profileUrl && (
        <Box sx={{ mb: 2 }}>
          <Link
            href={profileUrl}
            target="_blank"
            rel="noopener noreferrer"
            sx={{
              fontSize: '0.8rem',
              fontFamily: 'monospace',
              color: '#83a598',
              textDecoration: 'none',
              '&:hover': { textDecoration: 'underline' }
            }}
          >
            <OpenInNew sx={{ fontSize: 12, mr: 0.5, verticalAlign: 'middle' }} />
            {profileUrl}
          </Link>
        </Box>
      )}

      {/* Usernames */}
      {usernames?.length > 0 && (
        <Box sx={{ mb: 2, display: 'flex', flexWrap: 'wrap', gap: 0.5 }}>
          {usernames.map((u, i) => {
            const clean = u.replace(/^@/, '');
            return (
              <Chip
                key={i}
                label={`@${clean}`}
                size="small"
                clickable
                onClick={() => onQuery?.('username', clean)}
                sx={{ fontFamily: 'monospace', backgroundColor: 'rgba(131, 165, 152, 0.15)', color: '#83a598', ...queryableStyle }}
              />
            );
          })}
        </Box>
      )}

      {/* Date Range */}
      {(dateFrom || dateTo) && (
        <Box sx={{ mb: 2, display: 'flex', alignItems: 'center', gap: 1 }}>
          <AccessTime sx={{ fontSize: 16, color: 'text.secondary' }} />
          <Typography variant="body2" color="text.secondary">
            {dateFrom && dateTo ? `${dateFrom} -- ${dateTo}` : dateFrom || dateTo}
          </Typography>
        </Box>
      )}

      {/* Stats Grid */}
      <Grid container spacing={1} sx={{ mb: 2 }}>
        {messageCount != null && (
          <Grid size={{ xs: 6, md: 4 }}>
            <StatItem icon={<Chat fontSize="small" />} label="Messages" value={messageCount.toLocaleString()} color="#fabd2f" />
          </Grid>
        )}
        {chatCount != null && (
          <Grid size={{ xs: 6, md: 4 }}>
            <StatItem icon={<Forum fontSize="small" />} label="Chats" value={chatCount.toLocaleString()} color="#83a598" />
          </Grid>
        )}
        {replyPercentage != null && (
          <Grid size={{ xs: 6, md: 4 }}>
            <StatItem icon={<Reply fontSize="small" />} label="Replies" value={`${replyPercentage}%`} color="#d3869b" />
          </Grid>
        )}
        {mediaPercentage != null && (
          <Grid size={{ xs: 6, md: 4 }}>
            <StatItem icon={<Image fontSize="small" />} label="Media" value={`${mediaPercentage}%`} color="#b8bb26" />
          </Grid>
        )}
        {voice != null && (
          <Grid size={{ xs: 6, md: 4 }}>
            <StatItem icon={<Mic fontSize="small" />} label="Voice" value={voice.toLocaleString()} color="#fe8019" />
          </Grid>
        )}
        {circles != null && (
          <Grid size={{ xs: 6, md: 4 }}>
            <StatItem icon={<Circle fontSize="small" />} label="Circles" value={circles} color="#8ec07c" />
          </Grid>
        )}
      </Grid>

      {/* Message Diversity */}
      {messageDiversity != null && (
        <Box sx={{ mb: 2 }}>
          <Box sx={{ display: 'flex', justifyContent: 'space-between', mb: 0.5 }}>
            <Typography variant="caption" color="text.secondary">Message Diversity</Typography>
            <Typography variant="caption" sx={{ fontFamily: 'monospace' }}>
              {(messageDiversity * 100).toFixed(0)}%
            </Typography>
          </Box>
          <LinearProgress
            variant="determinate"
            value={messageDiversity * 100}
            sx={{
              height: 6,
              borderRadius: 3,
              backgroundColor: 'rgba(250, 189, 47, 0.1)',
              '& .MuiLinearProgress-bar': {
                borderRadius: 3,
                backgroundColor: '#fabd2f'
              }
            }}
          />
        </Box>
      )}

      {/* Extra Info */}
      <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 1.5 }}>
        {favoriteChat && (
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
            <Star sx={{ fontSize: 14, color: '#fabd2f' }} />
            <Typography variant="caption" color="text.secondary">Favorite:</Typography>
            <Typography variant="caption">{favoriteChat}</Typography>
          </Box>
        )}
        {reputation && (
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
            <Typography variant="caption" color="text.secondary">Reputation:</Typography>
            <Typography variant="caption">{reputation}</Typography>
          </Box>
        )}
        {channel && (
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
            <Campaign sx={{ fontSize: 14, color: '#83a598' }} />
            {channel.url ? (
              <Link
                href={channel.url}
                target="_blank"
                rel="noopener noreferrer"
                sx={{ fontSize: '0.75rem', color: '#83a598', textDecoration: 'none', '&:hover': { textDecoration: 'underline' } }}
              >
                {channel.name || 'Channel'}
              </Link>
            ) : (
              <Typography variant="caption">{channel.name}</Typography>
            )}
          </Box>
        )}
        {stickerPackCount != null && (
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
            <Typography variant="caption" color="text.secondary">Stickers:</Typography>
            <Typography variant="caption">{stickerPackCount} pack{stickerPackCount !== 1 ? 's' : ''}</Typography>
          </Box>
        )}
      </Box>

      {/* Name History */}
      {nameHistory?.length > 0 && (
        <Box sx={{ mt: 2 }}>
          <Typography variant="caption" color="text.secondary" sx={{ mb: 1, display: 'flex', alignItems: 'center', gap: 0.5 }}>
            <History fontSize="inherit" /> Name History
          </Typography>
          <Box sx={{ pl: 1, borderLeft: '2px solid', borderColor: 'rgba(250, 189, 47, 0.2)' }}>
            {nameHistory.map((entry, i) => (
              <Box key={i} sx={{ py: 0.5, display: 'flex', alignItems: 'center', gap: 1 }}>
                <Typography variant="caption" sx={{ fontFamily: 'monospace', color: 'text.secondary', minWidth: 80 }}>
                  {entry.date}
                </Typography>
                <Typography variant="body2">
                  {entry.name}
                </Typography>
              </Box>
            ))}
          </Box>
        </Box>
      )}
    </OsintSection>
  );
};

export default TelelogSection;
