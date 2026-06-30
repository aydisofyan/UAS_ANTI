const prisma = require('../config/db');
const { recordLedgerBlock } = require('../utils/blockchain');

/**
 * Dispatch/create a shipment for a pending order (Kurir or Admin only)
 * Expects body: { ID_Pesanan, Kurir_Nama }
 */
async function shipOrder(req, res) {
  try {
    const { ID_Pesanan, Kurir_Nama } = req.body;

    if (!ID_Pesanan) {
      return res.status(400).json({
        success: false,
        message: 'ID_Pesanan wajib disertakan.',
      });
    }

    // 1. Fetch order details
    const order = await prisma.pesanan.findUnique({
      where: { ID_Pesanan },
      include: { Pengiriman: true },
    });

    if (!order) {
      return res.status(404).json({
        success: false,
        message: 'Pesanan tidak ditemukan.',
      });
    }

    // 2. Validate order status. It must be 'Menunggu' or 'Diproses' (without shipping created yet)
    if (order.Status_Pesanan !== 'Menunggu') {
      return res.status(400).json({
        success: false,
        message: `Tidak dapat memproses pengiriman. Status pesanan saat ini: ${order.Status_Pesanan}.`,
      });
    }

    if (order.Pengiriman.length > 0) {
      return res.status(400).json({
        success: false,
        message: 'Pengiriman untuk pesanan ini sudah terdaftar.',
      });
    }

    // 3. Create shipping details
    const courierName = Kurir_Nama || req.user.Nama || 'Kurir SaltChain';
    const trackingResi = `SC-${Date.now()}-${Math.floor(1000 + Math.random() * 9000)}`;
    
    // Estimasi tiba: 3 hari dari sekarang
    const estimasiTiba = new Date();
    estimasiTiba.setDate(estimasiTiba.getDate() + 3);

    const result = await prisma.$transaction(async (tx) => {
      // Create shipping
      const shipping = await tx.pengiriman.create({
        data: {
          ID_Pesanan,
          Kurir: courierName,
          Resi: trackingResi,
          Estimasi_Tiba: estimasiTiba,
          Status_Kirim: 'Diproses',
        },
      });

      // Update order status to Diproses
      await tx.pesanan.update({
        where: { ID_Pesanan },
        data: { Status_Pesanan: 'Diproses' },
      });

      return shipping;
    });

    // 4. LOG TO THE BLOCKCHAIN TAMPER-PROOF LEDGER! (Genesis Block for this shipment)
    const ledgerBlock = await recordLedgerBlock(
      prisma,
      result.ID_Pengiriman,
      'PENGIRIMAN_DIBUAT',
      {
        ID_Pesanan: result.ID_Pesanan,
        Kurir: result.Kurir,
        Resi: result.Resi,
        Estimasi_Tiba: result.Estimasi_Tiba,
        Status_Kirim: result.Status_Kirim,
        Operator: req.user.Nama,
      }
    );

    return res.status(201).json({
      success: true,
      message: 'Pengiriman berhasil diproses dan dicatat di Ledger Blockchain!',
      data: result,
      ledgerBlock,
    });
  } catch (error) {
    console.error('Error dispatching shipment:', error);
    return res.status(500).json({
      success: false,
      message: 'Terjadi kesalahan server saat memproses pengiriman.',
      error: error.message,
    });
  }
}

/**
 * Update shipment status (Kurir or Admin only)
 * Expects body: { Status_Kirim }
 */
async function updateShippingStatus(req, res) {
  try {
    const { id } = req.params; // ID_Pengiriman
    const { Status_Kirim } = req.body;

    const VALID_STATUSES = ['Diproses', 'Dikirim', 'Sampai'];
    if (!Status_Kirim || !VALID_STATUSES.includes(Status_Kirim)) {
      return res.status(400).json({
        success: false,
        message: `Status tidak valid. Gunakan salah satu dari: ${VALID_STATUSES.join(', ')}`,
      });
    }

    // 1. Fetch current shipping details
    const shipping = await prisma.pengiriman.findUnique({
      where: { ID_Pengiriman: id },
    });

    if (!shipping) {
      return res.status(404).json({
        success: false,
        message: 'Data pengiriman tidak ditemukan.',
      });
    }

    // 2. Perform state transition checks
    if (shipping.Status_Kirim === 'Sampai') {
      return res.status(400).json({
        success: false,
        message: 'Pengiriman sudah selesai (Sampai) dan statusnya tidak dapat diubah lagi.',
      });
    }

    if (shipping.Status_Kirim === 'Dikirim' && Status_Kirim === 'Diproses') {
      return res.status(400).json({
        success: false,
        message: 'Tidak dapat mengembalikan status dari Dikirim ke Diproses.',
      });
    }

    // 3. Update shipping and order status
    const updatedShipping = await prisma.$transaction(async (tx) => {
      const ship = await tx.pengiriman.update({
        where: { ID_Pengiriman: id },
        data: { Status_Kirim },
      });

      let nextOrderStatus = 'Diproses';
      if (Status_Kirim === 'Dikirim') {
        nextOrderStatus = 'Dikirim';
      } else if (Status_Kirim === 'Sampai') {
        nextOrderStatus = 'Selesai';
      }

      await tx.pesanan.update({
        where: { ID_Pesanan: shipping.ID_Pesanan },
        data: { Status_Pesanan: nextOrderStatus },
      });

      return ship;
    });

    // 4. LOG TO THE BLOCKCHAIN TAMPER-PROOF LEDGER! (Transit/Delivery blocks)
    const eventName = Status_Kirim === 'Dikirim' ? 'PENGIRIMAN_DIKIRIM' : 'PENGIRIMAN_SAMPAI';
    const ledgerBlock = await recordLedgerBlock(
      prisma,
      updatedShipping.ID_Pengiriman,
      eventName,
      {
        Resi: updatedShipping.Resi,
        Status_Kirim: updatedShipping.Status_Kirim,
        Kurir: updatedShipping.Kurir,
        Operator: req.user.Nama,
        Waktu_Perubahan: new Date(),
      }
    );

    return res.status(200).json({
      success: true,
      message: `Status pengiriman diperbarui menjadi '${Status_Kirim}' dan diverifikasi di Ledger Blockchain.`,
      data: updatedShipping,
      ledgerBlock,
    });
  } catch (error) {
    console.error('Error updating shipping status:', error);
    return res.status(500).json({
      success: false,
      message: 'Terjadi kesalahan server saat memperbarui status pengiriman.',
      error: error.message,
    });
  }
}

/**
 * Fetch all shipments
 */
async function getAllShippings(req, res) {
  try {
    const shippings = await prisma.pengiriman.findMany({
      include: {
        Pesanan: {
          include: {
            Pembeli: {
              select: { Nama: true, Email: true },
            },
          },
        },
      },
      orderBy: { Estimasi_Tiba: 'asc' },
    });

    return res.status(200).json({
      success: true,
      data: shippings,
    });
  } catch (error) {
    console.error('Error fetching all shippings:', error);
    return res.status(500).json({
      success: false,
      message: 'Terjadi kesalahan server saat memuat data pengiriman.',
      error: error.message,
    });
  }
}

module.exports = {
  shipOrder,
  updateShippingStatus,
  getAllShippings,
};
