import { io } from 'socket.io-client';

const BACKEND_URL = window.__env?.reidAnalyticsServerUrl || '';

let socket = null;

export const getSocket = () => {
  if (!socket) {
    socket = io(BACKEND_URL, {
      transports: ['websocket', 'polling'],
      reconnectionAttempts: 5,
      reconnectionDelay: 2000
    });
  }
  return socket;
};
