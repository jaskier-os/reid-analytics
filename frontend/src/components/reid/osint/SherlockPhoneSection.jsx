import React from 'react';
import {
  Box, Typography, Chip, Grid,
  Table, TableHead, TableBody, TableRow, TableCell,
  Divider
} from '@mui/material';
import {
  Phone, Email, Work, People,
  CheckCircle, Cancel, OpenInNew, Language
} from '@mui/icons-material';
import OsintSection from './OsintSection';

const BACKEND_URL = '';

const formatValue = (value) => {
  if (Array.isArray(value)) return value.map(v => typeof v === 'object' ? (v.value || JSON.stringify(v)) : v).join(', ');
  if (typeof value === 'object' && value !== null) return value.value || JSON.stringify(value);
  return value;
};

const Field = ({ label, value, mono }) => {
  const display = formatValue(value);
  if (!display) return null;
  return (
    <Box sx={{ py: 0.5 }}>
      <Typography variant="caption" color="text.secondary" sx={{ display: 'block', lineHeight: 1.2 }}>
        {label}
      </Typography>
      <Typography variant="body2" sx={{ fontFamily: mono ? 'monospace' : 'inherit', wordBreak: 'break-all' }}>
        {display}
      </Typography>
    </Box>
  );
};

const LinkRow = ({ url, onQuery }) => {
  if (!url) return null;
  const isTelegram = url.includes('t.me');
  const isVk = url.includes('vk.com');
  const isOk = url.includes('ok.ru');
  const extractId = () => {
    if (isTelegram) return url.replace(/^https?:\/\/(t\.me|telegram\.me)\//, '').replace(/\/$/, '');
    if (isVk) return url.replace(/^https?:\/\/(vk\.com|m\.vk\.com)\//, '').replace(/\/$/, '');
    if (isOk) return url.replace(/^https?:\/\/ok\.ru\//, '').replace(/\/$/, '');
    return null;
  };
  const queryId = extractId();
  return (
    <Typography
      component="div"
      onClick={queryId ? () => onQuery?.('username', queryId, url) : undefined}
      sx={{
        fontSize: '0.8rem',
        fontFamily: 'monospace',
        color: '#83a598',
        wordBreak: 'break-all',
        cursor: queryId ? 'pointer' : 'default',
        py: 0.25,
        '&:hover': queryId ? { color: '#fabd2f', textDecoration: 'underline' } : {}
      }}
    >
      <OpenInNew sx={{ fontSize: 11, mr: 0.5, verticalAlign: 'middle' }} />
      {url}
    </Typography>
  );
};

const SectionLabel = ({ icon, children }) => (
  <Typography variant="overline" color="text.secondary" sx={{ display: 'flex', alignItems: 'center', gap: 0.5, mb: 0.5, mt: 1.5, letterSpacing: 1.5, fontSize: '0.65rem' }}>
    {icon} {children}
  </Typography>
);

const SherlockPhoneSection = ({ data, onQuery }) => {
  if (!data) return null;

  const {
    phone, socialLinks, reportUrl, report,
    phoneOperator, phoneCountry, phonebookNames,
    fullName, dateOfBirth, emails,
    operator, region, names, usernames, emailAddresses, vk
  } = data;

  const summary = report?.summary;
  const relationships = report?.relationships;
  const jobs = report?.jobs;
  const socialProfiles = report?.socialProfiles;
  const records = report?.records;
  const localReportFile = report?.localFile;

  // Deduplicate
  const displayOperator = operator || phoneOperator;
  const displayRegion = region || phoneCountry;
  const displayNames = names || phonebookNames || [];
  const displayEmails = [...new Set([...(emailAddresses || []), ...(emails || [])])];

  // Collect all social links (from socialLinks + socialProfiles + vk), deduplicated by URL
  const allLinks = new Map();
  if (vk?.url) allLinks.set(vk.url, { name: vk.name, service: 'VK' });
  if (socialLinks) {
    Object.entries(socialLinks).forEach(([platform, url]) => {
      if (url && !allLinks.has(url)) allLinks.set(url, { service: platform });
    });
  }
  if (socialProfiles) {
    socialProfiles.forEach(p => {
      if (p.url && !allLinks.has(p.url)) allLinks.set(p.url, { name: p.name, service: p.service });
    });
  }

  // Deduplicate summary fields that duplicate top-level data
  const summaryItems = [];
  if (summary) {
    const skipValues = new Set([phone, ...(displayEmails.map(e => e.toUpperCase()))]);
    [
      { label: 'Identity', value: summary.identity },
      { label: 'Passport', value: summary.passport },
      { label: 'INN', value: summary.inn },
      { label: 'SNILS', value: summary.snils },
      { label: 'Driver License', value: summary.driverLicense },
      { label: 'Cars', value: summary.cars },
    ].forEach(item => {
      const display = formatValue(item.value);
      if (display && !skipValues.has(display)) summaryItems.push(item);
    });
  }

  const reportHref = localReportFile
    ? `${BACKEND_URL}/api/reid/osint-reports/${localReportFile}`
    : reportUrl;

  return (
    <OsintSection title="Phone Lookup" icon={<Phone fontSize="small" />} chipLabel={phone}>
      {/* Header: phone + carrier */}
      <Box sx={{ display: 'flex', flexWrap: 'wrap', alignItems: 'baseline', gap: 1, mb: 1.5 }}>
        <Typography
          variant="h6"
          onClick={() => onQuery?.('phone', phone)}
          sx={{ fontFamily: 'monospace', color: '#fabd2f', fontWeight: 700, cursor: 'pointer', '&:hover': { textDecoration: 'underline' } }}
        >
          {phone}
        </Typography>
        {displayOperator && (
          <Chip label={displayOperator} size="small" sx={{ backgroundColor: 'rgba(184, 187, 38, 0.15)', color: '#b8bb26', height: 20, fontSize: '0.7rem' }} />
        )}
        {displayRegion && (
          <Chip label={displayRegion} size="small" variant="outlined" sx={{ borderColor: 'rgba(255,255,255,0.15)', height: 20, fontSize: '0.7rem' }} />
        )}
      </Box>

      {/* Identity block */}
      {(fullName || dateOfBirth || displayNames.length > 0) && (
        <Box sx={{ mb: 1.5, p: 1.5, borderRadius: 1, border: '1px solid', borderColor: 'rgba(250, 189, 47, 0.15)', background: 'rgba(250, 189, 47, 0.03)' }}>
          {fullName && (
            <Typography variant="body1" sx={{ fontWeight: 700, color: '#fabd2f', mb: 0.5 }}>
              {fullName}
              {dateOfBirth && (
                <Typography component="span" variant="body2" sx={{ ml: 1, color: 'text.secondary', fontFamily: 'monospace' }}>{dateOfBirth}</Typography>
              )}
            </Typography>
          )}
          {displayNames.length > 0 && (
            <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 0.5 }}>
              <Typography variant="caption" color="text.secondary" sx={{ mr: 0.5, lineHeight: '24px' }}>Also known as:</Typography>
              {displayNames.map((name, i) => (
                <Chip key={i} label={name} size="small" sx={{ height: 22, fontSize: '0.75rem', backgroundColor: 'rgba(250, 189, 47, 0.1)', color: '#fabd2f' }} />
              ))}
            </Box>
          )}
        </Box>
      )}

      {/* Contacts grid: emails + usernames */}
      {(displayEmails.length > 0 || usernames?.length > 0) && (
        <Box sx={{ mb: 1.5, display: 'flex', flexWrap: 'wrap', gap: 0.5 }}>
          {displayEmails.map((email, i) => (
            <Chip key={`e${i}`} icon={<Email sx={{ fontSize: '0.8rem !important' }} />} label={email} size="small" sx={{ fontFamily: 'monospace', fontSize: '0.75rem', height: 24, backgroundColor: 'rgba(211, 134, 155, 0.1)', color: '#d3869b' }} />
          ))}
          {usernames?.map((u, i) => (
            <Chip
              key={`u${i}`}
              label={u}
              size="small"
              clickable
              onClick={() => onQuery?.('username', u)}
              sx={{ fontFamily: 'monospace', fontSize: '0.75rem', height: 24, backgroundColor: 'rgba(131, 165, 152, 0.1)', color: '#83a598', cursor: 'pointer', '&:hover': { outline: '1px solid #fabd2f', outlineOffset: 1 } }}
            />
          ))}
        </Box>
      )}

      {/* Links: social media, VK, Telegram, WhatsApp */}
      {allLinks.size > 0 && (
        <>
          <SectionLabel icon={<Language sx={{ fontSize: 12 }} />}>Links</SectionLabel>
          <Box sx={{ display: 'flex', flexDirection: 'column' }}>
            {[...allLinks.entries()].map(([url, meta]) => (
              <Box key={url} sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                {meta.name && (
                  <Typography variant="caption" sx={{ color: 'text.secondary', minWidth: 100 }}>{meta.name}</Typography>
                )}
                <LinkRow url={url} onQuery={onQuery} />
              </Box>
            ))}
          </Box>
        </>
      )}

      {/* Report summary (documents, IDs) */}
      {summaryItems.length > 0 && (
        <>
          <SectionLabel icon={null}>Documents</SectionLabel>
          <Grid container spacing={1}>
            {summaryItems.map((item, i) => (
              <Grid key={i} size={{ xs: 6, md: 4 }}>
                <Box sx={{ p: 1, borderRadius: 1, border: '1px solid', borderColor: 'rgba(250, 189, 47, 0.08)', background: 'rgba(40, 40, 40, 0.4)' }}>
                  <Field label={item.label} value={item.value} mono />
                </Box>
              </Grid>
            ))}
          </Grid>
        </>
      )}

      {/* Relationships */}
      {relationships?.length > 0 && (
        <>
          <SectionLabel icon={<People sx={{ fontSize: 12 }} />}>Relationships</SectionLabel>
          <Table size="small" sx={{ '& td, & th': { borderColor: 'rgba(250, 189, 47, 0.06)', py: 0.5, px: 1 } }}>
            <TableHead>
              <TableRow>
                <TableCell sx={{ color: 'text.secondary', fontWeight: 600, fontSize: '0.75rem' }}>Name</TableCell>
                <TableCell sx={{ color: 'text.secondary', fontWeight: 600, fontSize: '0.75rem' }}>DOB</TableCell>
                <TableCell sx={{ color: 'text.secondary', fontWeight: 600, fontSize: '0.75rem' }}>Relation</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {relationships.map((rel, i) => (
                <TableRow key={i}>
                  <TableCell>
                    {rel.fullName && rel.dateOfBirth ? (
                      <Typography
                        variant="body2"
                        onClick={() => onQuery?.('name', `${rel.fullName} ${rel.dateOfBirth}`)}
                        sx={{ cursor: 'pointer', fontSize: '0.8rem', '&:hover': { color: '#fabd2f', textDecoration: 'underline' } }}
                      >
                        {rel.fullName}
                      </Typography>
                    ) : (
                      <Typography variant="body2" sx={{ fontSize: '0.8rem' }}>{rel.fullName}</Typography>
                    )}
                  </TableCell>
                  <TableCell sx={{ fontFamily: 'monospace', fontSize: '0.75rem' }}>{rel.dateOfBirth}</TableCell>
                  <TableCell>
                    <Chip label={rel.relationship || '-'} size="small" variant="outlined" sx={{ borderColor: 'rgba(255,255,255,0.1)', fontSize: '0.65rem', height: 18 }} />
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </>
      )}

      {/* Employment */}
      {jobs?.length > 0 && (
        <>
          <SectionLabel icon={<Work sx={{ fontSize: 12 }} />}>Employment</SectionLabel>
          <Table size="small" sx={{ '& td, & th': { borderColor: 'rgba(250, 189, 47, 0.06)', py: 0.5, px: 1 } }}>
            <TableHead>
              <TableRow>
                <TableCell sx={{ color: 'text.secondary', fontWeight: 600, fontSize: '0.75rem' }}>Company</TableCell>
                <TableCell sx={{ color: 'text.secondary', fontWeight: 600, fontSize: '0.75rem' }}>Position</TableCell>
                <TableCell sx={{ color: 'text.secondary', fontWeight: 600, fontSize: '0.75rem' }} align="center">Verified</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {jobs.map((job, i) => (
                <TableRow key={i}>
                  <TableCell sx={{ fontSize: '0.8rem' }}>{job.company}</TableCell>
                  <TableCell sx={{ fontSize: '0.8rem' }}>{job.position}</TableCell>
                  <TableCell align="center">
                    {job.verified
                      ? <CheckCircle sx={{ fontSize: 14, color: '#b8bb26' }} />
                      : <Cancel sx={{ fontSize: 14, color: 'text.disabled' }} />
                    }
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </>
      )}

      {/* Database Records */}
      {records?.length > 0 && (
        <>
          <SectionLabel icon={null}>Database Records</SectionLabel>
          {records.map((record, i) => (
            <Box key={i} sx={{ mb: 0.5, p: 1, borderRadius: 1, border: '1px solid', borderColor: 'rgba(250, 189, 47, 0.06)', background: 'rgba(40, 40, 40, 0.3)' }}>
              <Typography variant="caption" sx={{ fontWeight: 600, color: '#d3869b', fontSize: '0.7rem' }}>
                {record.source}{record.year ? ` (${record.year})` : ''}
              </Typography>
              <Box sx={{ mt: 0.5, display: 'flex', flexWrap: 'wrap', gap: 0.5 }}>
                {Object.entries(record.fields || {}).map(([key, val]) => (
                  <Chip key={key} label={`${key}: ${val}`} size="small" variant="outlined" sx={{ fontSize: '0.65rem', height: 18, borderColor: 'rgba(255,255,255,0.08)', fontFamily: 'monospace' }} />
                ))}
              </Box>
            </Box>
          ))}
        </>
      )}

      {/* Report link */}
      {reportHref && (
        <Box sx={{ mt: 2, pt: 1, borderTop: '1px solid', borderColor: 'rgba(250, 189, 47, 0.06)', textAlign: 'right' }}>
          <Chip
            label="Full Report"
            size="small"
            component="a"
            href={reportHref}
            target="_blank"
            rel="noopener noreferrer"
            clickable
            icon={<OpenInNew sx={{ fontSize: '0.8rem !important' }} />}
            sx={{
              backgroundColor: 'rgba(250, 189, 47, 0.15)',
              color: '#fabd2f',
              '&:hover': { backgroundColor: 'rgba(250, 189, 47, 0.3)' }
            }}
          />
        </Box>
      )}
    </OsintSection>
  );
};

export default SherlockPhoneSection;
