import React from 'react';
import { Box, Typography, Chip, Link } from '@mui/material';
import { Telegram, AccessTime, History, OpenInNew } from '@mui/icons-material';
import OsintSection from './OsintSection';

const queryableStyle = {
  cursor: 'pointer',
  '&:hover': { outline: '1px solid #fabd2f', outlineOffset: 1 }
};

const SherlockTelegramSection = ({ telegramIdData, usernameData, onQuery }) => {
  const data = telegramIdData || usernameData;
  if (!data) return null;

  const { telegramId, username, phone, nameHistory, firstSeenDate, lastSeenDate } = data;

  // Merge name histories from both sources if available
  const allNameHistory = [
    ...(telegramIdData?.nameHistory || []),
    ...(usernameData?.nameHistory || [])
  ].filter((entry, i, arr) =>
    arr.findIndex(e => e.date === entry.date && e.name === entry.name) === i
  );

  const cleanUsername = username?.replace(/^@/, '');
  const telegramUrl = cleanUsername ? `https://t.me/${cleanUsername}` : null;

  return (
    <OsintSection
      title="Telegram Lookup"
      icon={<Telegram fontSize="small" />}
      chipLabel={cleanUsername ? `@${cleanUsername}` : telegramId}
    >
      {/* Profile Info */}
      <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 1, mb: 2, alignItems: 'center' }}>
        {telegramId && (
          <Chip
            label={`ID: ${telegramId}`}
            size="small"
            clickable
            onClick={() => onQuery?.('telegram_id', telegramId)}
            sx={{ fontFamily: 'monospace', backgroundColor: 'rgba(250, 189, 47, 0.2)', color: '#fabd2f', ...queryableStyle }}
          />
        )}
        {cleanUsername && (
          <Chip
            label={`@${cleanUsername}`}
            size="small"
            clickable
            onClick={() => onQuery?.('username', cleanUsername)}
            sx={{ fontFamily: 'monospace', backgroundColor: 'rgba(131, 165, 152, 0.2)', color: '#83a598', ...queryableStyle }}
          />
        )}
        {phone && (
          <Chip
            label={phone}
            size="small"
            clickable
            onClick={() => onQuery?.('phone', phone)}
            sx={{ fontFamily: 'monospace', backgroundColor: 'rgba(184, 187, 38, 0.2)', color: '#b8bb26', ...queryableStyle }}
          />
        )}
      </Box>

      {/* Telegram profile link */}
      {telegramUrl && (
        <Box sx={{ mb: 2 }}>
          <Link
            href={telegramUrl}
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
            {telegramUrl}
          </Link>
        </Box>
      )}

      {/* Activity Period */}
      {(firstSeenDate || lastSeenDate) && (
        <Box sx={{ mb: 2, display: 'flex', alignItems: 'center', gap: 1 }}>
          <AccessTime sx={{ fontSize: 16, color: 'text.secondary' }} />
          <Typography variant="body2" color="text.secondary">
            {firstSeenDate && lastSeenDate
              ? `${firstSeenDate} -- ${lastSeenDate}`
              : firstSeenDate
                ? `First seen: ${firstSeenDate}`
                : `Last seen: ${lastSeenDate}`
            }
          </Typography>
        </Box>
      )}

      {/* Name History */}
      {allNameHistory.length > 0 && (
        <Box>
          <Typography variant="caption" color="text.secondary" sx={{ mb: 1, display: 'flex', alignItems: 'center', gap: 0.5 }}>
            <History fontSize="inherit" /> Name History
          </Typography>
          <Box sx={{ pl: 1, borderLeft: '2px solid', borderColor: 'rgba(250, 189, 47, 0.2)' }}>
            {allNameHistory.map((entry, i) => (
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

export default SherlockTelegramSection;
