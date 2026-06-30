const express = require('express');
const {
  getAllBlocks,
  getLedgerByShippingId,
  verifyLedger,
  simulateTamper,
} = require('../controllers/ledger');
const authenticateJWT = require('../middleware/auth');

const router = express.Router();

// Require authentication to query the ledger
router.use(authenticateJWT);

// Get complete ledger blockchain history
router.get('/blocks', getAllBlocks);

// Get ledger blocks specifically for a single shipment
router.get('/shipping/:shippingId', getLedgerByShippingId);

// Cryptographically audit shipment's ledger integrity
router.get('/verify/:shippingId', verifyLedger);

// DEMO ONLY: Intentionally modify a block data payload to trigger verification alerts
router.post('/tamper', simulateTamper);

module.exports = router;
