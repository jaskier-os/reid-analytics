require("dotenv").config();

module.exports = {
  port: process.env.PORT || 3400,
  mongoURI: process.env.MONGO_URI || "mongodb://localhost:27017/reid-analytics",
  baseUrl: process.env.BASE_URL || `http://localhost:${process.env.PORT || 3400}`,

  // External services
  storageServiceUrl:
    process.env.STORAGE_SERVICE_URL || "http://localhost:3300/api",
  reidWorkerUrl:
    process.env.REID_WORKER_URL || "http://localhost:5000",

  // Permissions
  permissions: {
    root: "REID_ANALYTICS",
    view: "REID_ANALYTICS:VIEW",
    create: "REID_ANALYTICS:CREATE",
    edit: "REID_ANALYTICS:VIEW",
    delete: "REID_ANALYTICS:DELETE",
    admin: "REID_ANALYTICS:ADMIN",
  },

  // Cors settings
  corsOrigins: process.env.CORS_ORIGINS
    ? process.env.CORS_ORIGINS.split(",")
    : ["http://localhost:5400"],
};
