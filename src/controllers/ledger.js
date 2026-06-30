const prisma = require('../config/db');
const { validateLedgerChain } = require('../utils/blockchain');

/**
 * Fetch all blockchain blocks in the entire system (complete explorer view)
 */
async function getAllBlocks(req, res) {
  try {
    const blocks = await prisma.blockchainBlock.findMany({
      include: {
        Pengiriman: {
          include: {
            Pesanan: {
              select: {
                Total_Harga: true,
                Pembeli: { select: { Nama: true } },
              },
            },
          },
        },
      },
      orderBy: [
        { Tanggal: 'desc' },
        { Index: 'desc' }
      ],
    });

    return res.status(200).json({
      success: true,
      data: blocks,
    });
  } catch (error) {
    console.error('Error fetching all ledger blocks:', error);
    return res.status(500).json({
      success: false,
      message: 'Terjadi kesalahan server saat memuat data Ledger.',
      error: error.message,
    });
  }
}

/**
 * Fetch blocks specifically belonging to a single shipment ID
 */
async function getLedgerByShippingId(req, res) {
  try {
    const { shippingId } = req.params;

    const blocks = await prisma.blockchainBlock.findMany({
      where: { ID_Pengiriman: shippingId },
      orderBy: { Index: 'asc' },
    });

    return res.status(200).json({
      success: true,
      data: blocks,
    });
  } catch (error) {
    console.error('Error fetching ledger for shipment:', error);
    return res.status(500).json({
      success: false,
      message: 'Terjadi kesalahan server saat memuat detail Ledger pengiriman.',
      error: error.message,
    });
  }
}

/**
 * Perform a cryptographic verification audit on a specific shipment's blockchain ledger
 */
async function verifyLedger(req, res) {
  try {
    const { shippingId } = req.params;

    // Verify if shipment exists
    const shipment = await prisma.pengiriman.findUnique({
      where: { ID_Pengiriman: shippingId },
    });

    if (!shipment) {
      return res.status(404).json({
        success: false,
        message: 'Pengiriman tidak ditemukan.',
      });
    }

    const audit = await validateLedgerChain(prisma, shippingId);

    return res.status(200).json({
      success: true,
      valid: audit.valid,
      errors: audit.errors,
      message: audit.valid
        ? 'Integritas Blockchain Valid: Semua hash data terverifikasi aman dan tidak dimanipulasi.'
        : 'Peringatan: Terdeteksi manipulasi data! Rantai blockchain rusak.',
    });
  } catch (error) {
    console.error('Error verifying ledger:', error);
    return res.status(500).json({
      success: false,
      message: 'Terjadi kesalahan server saat memverifikasi Ledger.',
      error: error.message,
    });
  }
}

/**
 * DEMO ONLY: Intentionally tampers with a block's data in the database
 * to show the blockchain integrity validation flagging the manipulation.
 * Expects body: { ID_Block, TamperedDataText }
 */
async function simulateTamper(req, res) {
  try {
    const { ID_Block, TamperedDataText } = req.body;

    if (!ID_Block || !TamperedDataText) {
      return res.status(400).json({
        success: false,
        message: 'ID_Block dan TamperedDataText wajib disertakan.',
      });
    }

    const block = await prisma.blockchainBlock.findUnique({
      where: { ID_Block },
    });

    if (!block) {
      return res.status(404).json({
        success: false,
        message: 'Blok tidak ditemukan.',
      });
    }

    // Parse the original block data JSON and manipulate payload
    let originalDataObj;
    try {
      originalDataObj = JSON.parse(block.Data);
    } catch (e) {
      originalDataObj = { eventName: 'UNKNOWN', payload: {} };
    }

    // Tamper with the payload content without re-calculating the hash
    originalDataObj.payload.TAMPERED = true;
    originalDataObj.payload.MANIPULATED_TEXT = TamperedDataText;
    originalDataObj.payload.OriginalOperator = originalDataObj.payload.Operator;
    originalDataObj.payload.Operator = '🚨 PENYUSUP (INTEGRITAS RUSAK)';

    const tamperedDataString = JSON.stringify(originalDataObj);

    // Save the tampered text directly to the database (violating the block hash)
    const tamperedBlock = await prisma.blockchainBlock.update({
      where: { ID_Block },
      data: {
        Data: tamperedDataString,
      },
    });

    return res.status(200).json({
      success: true,
      message: 'Simulasi manipulasi berhasil! Data di database telah dirubah secara paksa tanpa memperbarui tanda tangan digital (Hash). Jalankan verifikasi audit untuk melihat kegagalan rantai.',
      data: tamperedBlock,
    });
  } catch (error) {
    console.error('Error simulating tamper:', error);
    return res.status(500).json({
      success: false,
      message: 'Terjadi kesalahan server saat mensimulasikan tamper.',
      error: error.message,
    });
  }
}

module.exports = {
  getAllBlocks,
  getLedgerByShippingId,
  verifyLedger,
  simulateTamper,
};
