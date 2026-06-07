// permissionRoutes.js
const express = require('express');
const router = express.Router();
const {
  getServicePermissions,
} = require('../controllers/permissionController');

// Get service permissions structure (no auth required, just returns schema)
router.get('/getServicePermissions', getServicePermissions);


module.exports = router;