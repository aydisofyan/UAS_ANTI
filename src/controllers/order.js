const prisma = require('../config/db');

/**
 * Place a new order (Pengepul or Pabrik only)
 * Expects body: { items: [ { ID_Produk, Jumlah_Beli } ] }
 */
async function createOrder(req, res) {
  try {
    const { items } = req.body;

    if (!items || !Array.isArray(items) || items.length === 0) {
      return res.status(400).json({
        success: false,
        message: 'Keranjang belanja (items) tidak boleh kosong.',
      });
    }

    // We will validate all items before proceeding to the transaction
    const validatedItems = [];
    let calculatedTotal = 0;

    for (const item of items) {
      const { ID_Produk, Jumlah_Beli } = item;

      if (!ID_Produk || !Jumlah_Beli || parseInt(Jumlah_Beli) <= 0) {
        return res.status(400).json({
          success: false,
          message: 'Setiap item wajib memiliki ID_Produk dan Jumlah_Beli yang valid.',
        });
      }

      // Check product details and stock
      const product = await prisma.produk.findUnique({
        where: { ID_Produk },
      });

      if (!product) {
        return res.status(404).json({
          success: false,
          message: `Produk dengan ID ${ID_Produk} tidak ditemukan.`,
        });
      }

      if (product.Stok < parseInt(Jumlah_Beli)) {
        return res.status(400).json({
          success: false,
          message: `Stok produk '${product.Nama_Produk}' tidak mencukupi. Tersedia: ${product.Stok}, Diminta: ${Jumlah_Beli}.`,
        });
      }

      const subtotal = product.Harga * parseInt(Jumlah_Beli);
      calculatedTotal += subtotal;

      validatedItems.push({
        product,
        Jumlah_Beli: parseInt(Jumlah_Beli),
        subtotal,
      });
    }

    // Execute database transaction to secure data integrity
    const transactionResult = await prisma.$transaction(async (tx) => {
      // 1. Create the main Pesanan record
      const order = await tx.pesanan.create({
        data: {
          ID_User_Pembeli: req.user.ID_User,
          Status_Pesanan: 'Menunggu',
          Total_Harga: calculatedTotal,
        },
      });

      // 2. Loop to create Detail_Pesanan and deduct Stock
      for (const item of validatedItems) {
        // Create order detail
        await tx.detail_Pesanan.create({
          data: {
            ID_Pesanan: order.ID_Pesanan,
            ID_Produk: item.product.ID_Produk,
            Jumlah_Beli: item.Jumlah_Beli,
            Subtotal: item.subtotal,
          },
        });

        // Deduct inventory stock
        await tx.produk.update({
          where: { ID_Produk: item.product.ID_Produk },
          data: {
            Stok: {
              decrement: item.Jumlah_Beli,
            },
          },
        });
      }

      return order;
    });

    // Fetch full nested transaction response for return
    const completedOrder = await prisma.pesanan.findUnique({
      where: { ID_Pesanan: transactionResult.ID_Pesanan },
      include: {
        Detail_Pesanan: {
          include: {
            Produk: {
              select: {
                Nama_Produk: true,
                Kategori: true,
                Harga: true,
              },
            },
          },
        },
        Pembeli: {
          select: {
            Nama: true,
            Email: true,
            Peran: true,
          },
        },
      },
    });

    return res.status(201).json({
      success: true,
      message: 'Pesanan berhasil dibuat!',
      data: completedOrder,
    });
  } catch (error) {
    console.error('Error creating order:', error);
    return res.status(500).json({
      success: false,
      message: 'Terjadi kesalahan server saat memproses pesanan.',
      error: error.message,
    });
  }
}

/**
 * Get orders (Role-scoped visibility)
 */
async function getOrders(req, res) {
  try {
    const { ID_User, Peran } = req.user;
    let orders = [];

    const orderIncludes = {
      Detail_Pesanan: {
        include: {
          Produk: {
            include: {
              Petani: {
                select: { Nama: true, Email: true },
              },
            },
          },
        },
      },
      Pembeli: {
        select: { Nama: true, Email: true, Peran: true },
      },
      Pengiriman: true,
    };

    if (Peran === 'Admin' || Peran === 'Kurir') {
      // Admins and Couriers can see all orders
      orders = await prisma.pesanan.findMany({
        include: orderIncludes,
        orderBy: { Tanggal_Pesan: 'desc' },
      });
    } else if (Peran === 'Pengepul' || Peran === 'Pabrik') {
      // Buyers can only see their own purchases
      orders = await prisma.pesanan.findMany({
        where: { ID_User_Pembeli: ID_User },
        include: orderIncludes,
        orderBy: { Tanggal_Pesan: 'desc' },
      });
    } else if (Peran === 'Petani') {
      // Farmers can see orders containing their products
      orders = await prisma.pesanan.findMany({
        where: {
          Detail_Pesanan: {
            some: {
              Produk: {
                ID_User_Petani: ID_User,
              },
            },
          },
        },
        include: orderIncludes,
        orderBy: { Tanggal_Pesan: 'desc' },
      });
    }

    return res.status(200).json({
      success: true,
      data: orders,
    });
  } catch (error) {
    console.error('Error fetching orders:', error);
    return res.status(500).json({
      success: false,
      message: 'Terjadi kesalahan server saat memuat data pesanan.',
      error: error.message,
    });
  }
}

/**
 * Get an order by ID (with authorization checks)
 */
async function getOrderById(req, res) {
  try {
    const { id } = req.params;
    const { ID_User, Peran } = req.user;

    const order = await prisma.pesanan.findUnique({
      where: { ID_Pesanan: id },
      include: {
        Detail_Pesanan: {
          include: {
            Produk: {
              include: {
                Petani: { select: { Nama: true, Email: true } },
              },
            },
          },
        },
        Pembeli: { select: { ID_User: true, Nama: true, Email: true, Peran: true } },
        Pengiriman: true,
      },
    });

    if (!order) {
      return res.status(404).json({
        success: false,
        message: 'Pesanan tidak ditemukan.',
      });
    }

    // Role validation check
    let authorized = false;

    if (Peran === 'Admin' || Peran === 'Kurir') {
      authorized = true;
    } else if (Peran === 'Pengepul' || Peran === 'Pabrik') {
      authorized = order.ID_User_Pembeli === ID_User;
    } else if (Peran === 'Petani') {
      // Authorized if order contains farmer's product
      const hasFarmerProduct = order.Detail_Pesanan.some(
        (detail) => detail.Produk.ID_User_Petani === ID_User
      );
      authorized = hasFarmerProduct;
    }

    if (!authorized) {
      return res.status(403).json({
        success: false,
        message: 'Akses ditolak: Anda tidak diizinkan untuk melihat detail pesanan ini.',
      });
    }

    return res.status(200).json({
      success: true,
      data: order,
    });
  } catch (error) {
    console.error('Error fetching order by ID:', error);
    return res.status(500).json({
      success: false,
      message: 'Terjadi kesalahan server saat memuat detail pesanan.',
      error: error.message,
    });
  }
}

module.exports = {
  createOrder,
  getOrders,
  getOrderById,
};
