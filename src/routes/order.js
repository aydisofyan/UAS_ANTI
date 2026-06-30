const express = require('express');
const { createOrder, getOrders, getOrderById } = require('../controllers/order');
const authenticateJWT = require('../middleware/auth');
const authorize = require('../middleware/rbac');

const router = express.Router();

// Require authentication for all order-related operations
router.use(authenticateJWT);

// Create order (restricted to Pengepul and Pabrik)
router.post('/', authorize(['Pengepul', 'Pabrik']), createOrder);

// Retrieve orders (visible list is dynamically restricted depending on role)
router.get('/', getOrders);

// Retrieve specific order detail (visibility restricted based on role and ownership)
router.get('/:id', getOrderById);

module.exports = router;
