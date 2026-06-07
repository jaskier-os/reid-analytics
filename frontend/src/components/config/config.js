/**
 * Application configuration
 *
 * This file handles environment variables and application constants.
 * For local development, values come from the .env file.
 * For production, these should be set in the server/hosting environment.
 */

// API URLs
export const AUTH_API_URL = window.__env.authServerUrl + "/api";
export const MEDIA_API_URL = window.__env.storageServerUrl + "/api";
export const YJS_WEBSOCKET_URL = `ws://${window.location.hostname}:3401`;
export const TLDR_SYNC_URL = `ws://${window.location.hostname}:3402`;
export const YJS_PERSISTENCE = "memory";
export const AWARENESS_UPDATE_INTERVAL = 2000;
export const MAX_UNDO_STACK_SIZE = 100;
// Permissions
export const REID_ANALYTICS_PERMISSIONS = {
  view: "REID_ANALYTICS:VIEW",
  create: "REID_ANALYTICS:CREATE",
  edit: "REID_ANALYTICS:EDIT",
  delete: "REID_ANALYTICS:DELETE",
  admin: "REID_ANALYTICS:ADMIN",
};

// User roles
export const USER_ROLES = {
  SUPERADMIN: "superadmin",
  ADMIN: "admin",
  EDITOR: "editor",
  VIEWER: "viewer",
};

// Local storage keys
export const STORAGE_KEYS = {
  TOKEN: "token",
};

export default {
  AUTH_API_URL,
  MEDIA_API_URL,
  REID_ANALYTICS_PERMISSIONS,
  USER_ROLES,
  STORAGE_KEYS,
};
