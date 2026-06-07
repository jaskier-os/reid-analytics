const socketio = require('socket.io');
const reidService = require('./reidService');

let io;
const activeUsers = new Map();

// personId -> { lastSightingAt: string|null, totalSightings: number }
const personWatchState = new Map();
// Known person IDs for person-created detection
const globalPersonIds = new Set();

let pollInterval = null;

function getRoomSize(roomName) {
  const room = io.sockets.adapter.rooms.get(roomName);
  return room ? room.size : 0;
}

function pruneEmptyWatchedPersons() {
  for (const personId of personWatchState.keys()) {
    if (getRoomSize(`person-${personId}`) === 0) {
      personWatchState.delete(personId);
    }
  }
}

function startPolling() {
  if (pollInterval) return;
  pollInterval = setInterval(async () => {
    if (activeUsers.size === 0) return;

    pruneEmptyWatchedPersons();

    // Poll for new sightings for each watched person
    for (const [personId, state] of personWatchState) {
      if (getRoomSize(`person-${personId}`) === 0) {
        personWatchState.delete(personId);
        continue;
      }
      try {
        const sightingsData = await reidService.getPersonSightings(personId, 10, 0);
        const sightings = sightingsData.sightings || [];

        const newSightings = state.lastSightingAt
          ? sightings.filter(s => new Date(s.detected_at) > new Date(state.lastSightingAt))
          : [];

        if (newSightings.length > 0) {
          newSightings.forEach(sighting => {
            io.to(`person-${personId}`).emit('person-sighting', { personId, sighting });
          });
          state.lastSightingAt = sightings[0].detected_at;
        }

        // Always check person metadata for changes (sightings count, last_seen_at, is_active)
        try {
          const personData = await reidService.getPerson(personId);
          const changed = personData.total_sightings !== state.totalSightings
            || personData.last_seen_at !== state.lastSeenAt
            || personData.is_active !== state.isActive;
          if (changed) {
            io.to(`person-${personId}`).emit('person-updated', { person: personData });
            state.totalSightings = personData.total_sightings;
            state.lastSeenAt = personData.last_seen_at;
            state.isActive = personData.is_active;
          }
        } catch (err) {
          console.error(`Failed to fetch person ${personId} metadata during poll:`, err.message);
        }
      } catch (err) {
        console.error(`Polling sightings error for person ${personId}:`, err.message);
      }
    }

    // Poll for new persons
    try {
      const personsData = await reidService.getPersons(10, 0);
      const persons = personsData.persons || [];

      if (globalPersonIds.size === 0) {
        persons.forEach(p => globalPersonIds.add(p.id));
      } else {
        const newPersons = persons.filter(p => !globalPersonIds.has(p.id));
        newPersons.forEach(person => {
          io.emit('person-created', { person });
          globalPersonIds.add(person.id);
        });
      }
    } catch (err) {
      console.error('Polling persons error:', err.message);
    }
  }, 5000);
}

exports.initialize = (server) => {
  io = socketio(server, {
    cors: {
      origin: '*',
      methods: ['GET', 'POST'],
      credentials: true
    }
  });

  io.on('connection', (socket) => {
    console.log(`Client connected: ${socket.id}`);

    activeUsers.set(socket.id, {
      socketId: socket.id,
      connectedAt: new Date()
    });

    startPolling();

    // =====================
    // Map Layer Socket Events
    // =====================

    socket.on('join-layer', ({ layerId }) => {
      socket.join(`layer-${layerId}`);
      console.log(`Client ${socket.id} joined layer ${layerId}`);
      socket.to(`layer-${layerId}`).emit('user-joined-layer', {
        layerId,
        socketId: socket.id
      });
    });

    socket.on('leave-layer', ({ layerId }) => {
      socket.leave(`layer-${layerId}`);
      console.log(`Client ${socket.id} left layer ${layerId}`);
      socket.to(`layer-${layerId}`).emit('user-left-layer', {
        layerId,
        socketId: socket.id
      });
    });

    socket.on('layer-update', ({ layerId, updates }) => {
      socket.to(`layer-${layerId}`).emit('layer-update', {
        layerId,
        updates,
        socketId: socket.id
      });
    });

    socket.on('element-added', ({ layerId, element }) => {
      socket.to(`layer-${layerId}`).emit('element-added', {
        layerId,
        element,
        socketId: socket.id
      });
    });

    socket.on('element-removed', ({ layerId, elementId }) => {
      socket.to(`layer-${layerId}`).emit('element-removed', {
        layerId,
        elementId,
        socketId: socket.id
      });
    });

    socket.on('element-updated', ({ layerId, elementId, updates }) => {
      socket.to(`layer-${layerId}`).emit('element-updated', {
        layerId,
        elementId,
        updates,
        socketId: socket.id
      });
    });

    socket.on('layer-cleared', ({ layerId }) => {
      socket.to(`layer-${layerId}`).emit('layer-cleared', {
        layerId,
        socketId: socket.id
      });
    });

    // =====================
    // ReID Real-Time Events
    // =====================

    socket.on('watch-person', async ({ personId }) => {
      socket.join(`person-${personId}`);
      console.log(`Client ${socket.id} watching person ${personId}`);

      if (!personWatchState.has(personId)) {
        try {
          const [sightingsData, personData] = await Promise.all([
            reidService.getPersonSightings(personId, 1, 0),
            reidService.getPerson(personId)
          ]);
          const latestSighting = (sightingsData.sightings || [])[0];
          personWatchState.set(personId, {
            lastSightingAt: latestSighting?.detected_at || null,
            totalSightings: personData.total_sightings || 0,
            lastSeenAt: personData.last_seen_at || null,
            isActive: personData.is_active
          });
        } catch (err) {
          console.error(`Failed to initialize watch state for person ${personId}:`, err.message);
          personWatchState.set(personId, { lastSightingAt: null, totalSightings: 0, lastSeenAt: null, isActive: undefined });
        }
      }
    });

    socket.on('unwatch-person', ({ personId }) => {
      socket.leave(`person-${personId}`);
      console.log(`Client ${socket.id} unwatching person ${personId}`);
      if (getRoomSize(`person-${personId}`) === 0) {
        personWatchState.delete(personId);
      }
    });

    // =====================
    // General Socket Events
    // =====================

    socket.on('cursor-position', ({ roomType, roomId, position }) => {
      const roomName = `${roomType}-${roomId}`;
      socket.to(roomName).emit('cursor-position', {
        socketId: socket.id,
        position
      });
    });

    socket.on('disconnect', () => {
      console.log(`Client disconnected: ${socket.id}`);
      activeUsers.delete(socket.id);
      io.emit('user-offline', { socketId: socket.id });
      pruneEmptyWatchedPersons();

      if (activeUsers.size === 0 && pollInterval) {
        clearInterval(pollInterval);
        pollInterval = null;
      }
    });
  });
};

exports.getIO = () => {
  if (!io) {
    throw new Error('Socket.IO not initialized');
  }
  return io;
};

exports.emitToAll = (event, data) => {
  if (!io) return;
  io.emit(event, data);
};

exports.emitToRoom = (room, event, data) => {
  if (!io) return;
  io.to(room).emit(event, data);
};

exports.emitToUser = (userId, event, data) => {
  if (!io) return;
  const userInfo = activeUsers.get(userId.toString());
  if (userInfo) {
    io.to(userInfo.socketId).emit(event, data);
  }
};

exports.getActiveUsers = () => {
  return Array.from(activeUsers.values());
};
