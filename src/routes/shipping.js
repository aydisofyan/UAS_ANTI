const express = require('express');
const {
  shipOrder,
  updateShippingStatus,
  getAllShippings,
} = require('../controllers/shipping');
const authenticateJWT = require('../middleware/auth');
const authorize = require('../middleware/rbac');

const router = express.Router();

// Require authentication for all shipping actions
router.use(authenticateJWT);

// Retrieve all shipments (accessible by all roles to support supply chain visibility)
router.get('/', getAllShippings);

// Dispatch order shipment (Kurir or Admin only)
router.post('/', authorize(['Kurir', 'Admin']), shipOrder);

// Update shipping transit status (Kurir or Admin only)
router.put('/:id/status', authorize(['Kurir', 'Admin']), updateShippingStatus);

module.exports = router;
