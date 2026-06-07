const dateTimeOptions = {
  year: 'numeric',
  month: '2-digit',
  day: '2-digit',
  hour: '2-digit',
  minute: '2-digit',
  second: '2-digit',
  hour12: false,
  hourCycle: 'h23'
};

const dateOptions = {
  year: 'numeric',
  month: '2-digit',
  day: '2-digit'
};

export const formatDateTime = (dateStr) =>
  new Date(dateStr).toLocaleString([], dateTimeOptions);

export const formatDate = (dateStr) =>
  new Date(dateStr).toLocaleDateString([], dateOptions);

const timeOnlyOptions = {
  hour: '2-digit',
  minute: '2-digit',
  second: '2-digit',
  hour12: false,
  hourCycle: 'h23'
};

export const formatTime = (dateStr) =>
  new Date(dateStr).toLocaleTimeString([], timeOnlyOptions);
