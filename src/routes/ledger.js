const express = require('express');
const {
  getAllBlocks,
  getLedgerByShippingId,
  verifyLedger,
  simulateTamper,
} = require('../controllers/ledger');
const authenticateJWT = require('../middleware/auth');

const router = express.Router();

// Get complete ledger blockchain history (Public view for transparency)
router.get('/blocks', getAllBlocks);

// Require authentication for other ledger queries
router.use(authenticateJWT);

// Get ledger blocks specifically for a single shipment
router.get('/shipping/:shippingId', getLedgerByShippingId);

// Cryptographically audit shipment's ledger integrity
router.get('/verify/:shippingId', verifyLedger);

// DEMO ONLY: Intentionally modify a block data payload to trigger verification alerts
router.post('/tamper', simulateTamper);

module.exports = router;
