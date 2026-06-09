const express = require('express');
const cors = require('cors');
const morgan = require('morgan');
const cookieParser = require('cookie-parser');
const helmet = require('helmet');
const http = require('http');
const { execSync } = require('child_process');
const { connectDB } = require('./config/db');
const errorHandler = require('./middleware/error');
const socketService = require('./services/socketService');
const telegramService = require('./services/telegramService');
const unfurlRoutes = require("./routes/unfurlRoutes");

// Load environment variables (.env.prod by default, override with DOTENV_PATH)
require('dotenv').config({ path: process.env.DOTENV_PATH || '.env.prod' });
process.env.PORT = process.env.PORT || 3400;
process.env.AUTO_SAVE_INTERVAL_LAYERS = process.env.AUTO_SAVE_INTERVAL_LAYERS || 300000;

// Import route files
const layerRoutes = require('./routes/layerRoutes');
const permissionRoutes = require('./routes/permissionRoutes');
const reidRoutes = require('./routes/reidRoutes');
const tileRoutes = require('./routes/tileRoutes');

// Create Express app
const app = express();

// Middleware
app.use(express.json());
app.use(express.urlencoded({ extended: false }));
app.use(cookieParser());
app.use(helmet());
app.use(cors({
  origin: '*',
  credentials: true
}));

// Logging middleware
if (process.env.NODE_ENV === 'development') {
  app.use(morgan('dev'));
}

// Mount routes
app.use('/api/layers', layerRoutes);
app.use('/api/unfurl', unfurlRoutes);
app.use('/api/permissions', permissionRoutes);
app.use('/api/reid', reidRoutes);
app.use('/api/tiles', tileRoutes);

// Default route
app.get('/', (req, res) => {
  res.json({
    message: 'Team Planning API Server',
    status: 'Running'
  });
});

// Error handling middleware
app.use(errorHandler);

// Handle 404
app.use((req, res) => {
  res.status(404).json({
    success: false,
    error: 'Resource not found'
  });
});

const PORT = process.env.PORT || 3400;

async function start() {
  await connectDB();

  const server = http.createServer(app);
  socketService.initialize(server);

  server.on('error', (err) => {
    if (err.code === 'EADDRINUSE') {
      console.warn(`Port ${PORT} in use, killing old process...`);
      try {
        execSync(`fuser -k ${PORT}/tcp`, { stdio: 'ignore' });
      } catch {}
      setTimeout(() => {
        const retryServer = http.createServer(app);
        socketService.initialize(retryServer);
        retryServer.listen(PORT, () => {
          console.log(`Main API server running in ${process.env.NODE_ENV} mode on port ${PORT}`);
        });
      }, 2000);
    } else {
      throw err;
    }
  });

  server.listen(PORT, () => {
    console.log(`Main API server running in ${process.env.NODE_ENV} mode on port ${PORT}`);
  });

  telegramService.initialize();
}

start().catch(err => {
  console.error('Failed to start server:', err);
  process.exit(1);
});

// Handle unhandled promise rejections
process.on('unhandledRejection', (err) => {
  console.error('Unhandled Promise Rejection:', err);
});
