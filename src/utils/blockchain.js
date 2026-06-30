const crypto = require('crypto');

/**
 * Computes a SHA-256 hash for a given block's parameters
 */
function calculateBlockHash(index, timestamp, shippingId, data, prevHash) {
  const stringifiedData = typeof data === 'string' ? data : JSON.stringify(data);
  const input = `${index}|${new Date(timestamp).getTime()}|${shippingId}|${stringifiedData}|${prevHash}`;
  return crypto.createHash('sha256').update(input).digest('hex');
}

/**
 * Creates and records a new block in the tamper-proof ledger database
 * @param {object} prisma - The Prisma Client instance
 * @param {string} shippingId - ID of the shipment
 * @param {string} eventName - Description of the event (e.g. 'Shipment Created', 'Transit Update', 'Delivered')
 * @param {object} payload - Key-value pair payload representing the state details
 */
async function recordLedgerBlock(prisma, shippingId, eventName, payload) {
  // Find all blocks for this shipment to calculate the next index and fetch the previous hash
  const existingBlocks = await prisma.blockchainBlock.findMany({
    where: { ID_Pengiriman: shippingId },
    orderBy: { Index: 'asc' },
  });

  const nextIndex = existingBlocks.length;
  let prevHash = '0'; // Genesis block default

  if (nextIndex > 0) {
    prevHash = existingBlocks[existingBlocks.length - 1].Hash;
  }

  const timestamp = new Date();
  const dataObject = {
    eventName,
    payload,
  };
  const stringifiedData = JSON.stringify(dataObject);

  const blockHash = calculateBlockHash(
    nextIndex,
    timestamp,
    shippingId,
    stringifiedData,
    prevHash
  );

  const newBlock = await prisma.blockchainBlock.create({
    data: {
      Index: nextIndex,
      Tanggal: timestamp,
      ID_Pengiriman: shippingId,
      Data: stringifiedData,
      Prev_Hash: prevHash,
      Hash: blockHash,
    },
  });

  return newBlock;
}

/**
 * Cryptographically validates the entire ledger history of a specific shipment
 * Checks block hash matching and block-to-block hash linkages.
 * @param {object} prisma - The Prisma Client instance
 * @param {string} shippingId - ID of the shipment to validate
 * @returns {object} { valid: boolean, errors: array }
 */
async function validateLedgerChain(prisma, shippingId) {
  const blocks = await prisma.blockchainBlock.findMany({
    where: { ID_Pengiriman: shippingId },
    orderBy: { Index: 'asc' },
  });

  const errors = [];

  for (let i = 0; i < blocks.length; i++) {
    const block = blocks[i];
    
    // 1. Re-calculate current block's hash to see if data has been manipulated
    const recalculatedHash = calculateBlockHash(
      block.Index,
      block.Tanggal,
      block.ID_Pengiriman,
      block.Data,
      block.Prev_Hash
    );

    if (block.Hash !== recalculatedHash) {
      errors.push({
        index: block.Index,
        blockId: block.ID_Block,
        reason: `Hash mismatch: recorded hash '${block.Hash.substring(0, 10)}...' does not match calculated hash '${recalculatedHash.substring(0, 10)}...' (data may have been tampered with).`,
      });
    }

    // 2. Validate chain linkage
    if (i > 0) {
      const prevBlock = blocks[i - 1];
      if (block.Prev_Hash !== prevBlock.Hash) {
        errors.push({
          index: block.Index,
          blockId: block.ID_Block,
          reason: `Linkage broken: block 'Prev_Hash' ('${block.Prev_Hash.substring(0, 10)}...') does not match previous block's hash ('${prevBlock.Hash.substring(0, 10)}...').`,
        });
      }
    } else {
      // Genesis block check
      if (block.Prev_Hash !== '0') {
        errors.push({
          index: block.Index,
          blockId: block.ID_Block,
          reason: `Genesis block 'Prev_Hash' is not '0'.`,
        });
      }
    }
  }

  return {
    valid: errors.length === 0,
    errors,
  };
}

module.exports = {
  calculateBlockHash,
  recordLedgerBlock,
  validateLedgerChain,
};
