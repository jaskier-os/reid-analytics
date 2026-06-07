// permissionService.js
const config = require('../config/config');

/**
 * Get service permissions structure in a standardized format
 * @returns {Object} - Service permissions object in a standard format
 */
exports.getServicePermissions = () => {
    // Return permissions structure for this service
    const permissions = {};
  
    // Example for wiki service (adjust based on service type)
    const rootPermission = config.permissions.root; // e.g., 'WIKI' or 'STORAGE'
    const permissionsList = [];
    
    // Add all permissions without the prefix (standardized across services)
    Object.keys(config.permissions).forEach(key => {
      if (key !== 'root') {
        permissionsList.push(config.permissions[key].split(':')[1]);
      }
    });
    
    // Set the permissions object with the standard format
    permissions[rootPermission] = permissionsList;
    
    return permissions;
};
