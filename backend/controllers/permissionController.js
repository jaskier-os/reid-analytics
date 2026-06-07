// permissionController.js
const permissionService = require('../services/permissionService');

/**
 * Get service permissions structure
 * @route GET /api/permissions/getServicePermissions
 * @access Public
 */
exports.getServicePermissions = (req, res) => {
  try {
    const permissions = permissionService.getServicePermissions();
    
    return res.status(200).json({
      success: true,
      data: permissions
    });
  } catch (error) {
    console.error('Error getting service permissions:', error);
    return res.status(500).json({
      success: false,
      error: 'Server error'
    });
  }
};
