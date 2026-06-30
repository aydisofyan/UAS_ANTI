const prisma = require('../config/db');

/**
 * Create a new product (Petani only)
 */
async function createProduct(req, res) {
  try {
    const { Nama_Produk, Kategori, Stok, Harga } = req.body;

    if (!Nama_Produk || !Kategori || Stok === undefined || Harga === undefined) {
      return res.status(400).json({
        success: false,
        message: 'Semua field (Nama_Produk, Kategori, Stok, Harga) wajib diisi.',
      });
    }

    if (parseInt(Stok) < 0 || parseFloat(Harga) < 0) {
      return res.status(400).json({
        success: false,
        message: 'Stok dan Harga tidak boleh bernilai negatif.',
      });
    }

    const newProduct = await prisma.produk.create({
      data: {
        ID_User_Petani: req.user.ID_User,
        Nama_Produk,
        Kategori,
        Stok: parseInt(Stok),
        Harga: parseFloat(Harga),
      },
    });

    return res.status(201).json({
      success: true,
      message: 'Produk berhasil ditambahkan!',
      data: newProduct,
    });
  } catch (error) {
    console.error('Error creating product:', error);
    return res.status(500).json({
      success: false,
      message: 'Terjadi kesalahan server saat menambahkan produk.',
      error: error.message,
    });
  }
}

/**
 * Get all products (Public or authenticated)
 */
async function getAllProducts(req, res) {
  try {
    const products = await prisma.produk.findMany({
      include: {
        Petani: {
          select: {
            ID_User: true,
            Nama: true,
            Email: true,
          },
        },
      },
      orderBy: { Nama_Produk: 'asc' },
    });

    return res.status(200).json({
      success: true,
      data: products,
    });
  } catch (error) {
    console.error('Error fetching all products:', error);
    return res.status(500).json({
      success: false,
      message: 'Terjadi kesalahan server saat memuat daftar produk.',
      error: error.message,
    });
  }
}

/**
 * Get products owned by the authenticated Farmer (Petani)
 */
async function getProductsByFarmer(req, res) {
  try {
    const products = await prisma.produk.findMany({
      where: { ID_User_Petani: req.user.ID_User },
      orderBy: { Nama_Produk: 'asc' },
    });

    return res.status(200).json({
      success: true,
      data: products,
    });
  } catch (error) {
    console.error('Error fetching farmer products:', error);
    return res.status(500).json({
      success: false,
      message: 'Terjadi kesalahan server saat memuat produk Anda.',
      error: error.message,
    });
  }
}

/**
 * Update product (Owner Petani only)
 */
async function updateProduct(req, res) {
  try {
    const { id } = req.params;
    const { Nama_Produk, Kategori, Stok, Harga } = req.body;

    // Check if product exists and belongs to the active farmer
    const product = await prisma.produk.findUnique({
      where: { ID_Produk: id },
    });

    if (!product) {
      return res.status(404).json({
        success: false,
        message: 'Produk tidak ditemukan.',
      });
    }

    if (product.ID_User_Petani !== req.user.ID_User) {
      return res.status(403).json({
        success: false,
        message: 'Akses ditolak: Anda hanya dapat memperbarui produk Anda sendiri.',
      });
    }

    // Prepare update data
    const updateData = {};
    if (Nama_Produk) updateData.Nama_Produk = Nama_Produk;
    if (Kategori) updateData.Kategori = Kategori;
    if (Stok !== undefined) {
      if (parseInt(Stok) < 0) {
        return res.status(400).json({
          success: false,
          message: 'Stok tidak boleh bernilai negatif.',
        });
      }
      updateData.Stok = parseInt(Stok);
    }
    if (Harga !== undefined) {
      if (parseFloat(Harga) < 0) {
        return res.status(400).json({
          success: false,
          message: 'Harga tidak boleh bernilai negatif.',
        });
      }
      updateData.Harga = parseFloat(Harga);
    }

    const updatedProduct = await prisma.produk.update({
      where: { ID_Produk: id },
      data: updateData,
    });

    return res.status(200).json({
      success: true,
      message: 'Produk berhasil diperbarui!',
      data: updatedProduct,
    });
  } catch (error) {
    console.error('Error updating product:', error);
    return res.status(500).json({
      success: false,
      message: 'Terjadi kesalahan server saat memperbarui produk.',
      error: error.message,
    });
  }
}

/**
 * Delete product (Owner Petani only)
 */
async function deleteProduct(req, res) {
  try {
    const { id } = req.params;

    // Check if product exists and belongs to active farmer
    const product = await prisma.produk.findUnique({
      where: { ID_Produk: id },
    });

    if (!product) {
      return res.status(404).json({
        success: false,
        message: 'Produk tidak ditemukan.',
      });
    }

    if (product.ID_User_Petani !== req.user.ID_User) {
      return res.status(403).json({
        success: false,
        message: 'Akses ditolak: Anda hanya dapat menghapus produk Anda sendiri.',
      });
    }

    await prisma.produk.delete({
      where: { ID_Produk: id },
    });

    return res.status(200).json({
      success: true,
      message: 'Produk berhasil dihapus.',
    });
  } catch (error) {
    console.error('Error deleting product:', error);
    return res.status(500).json({
      success: false,
      message: 'Terjadi kesalahan server saat menghapus produk.',
      error: error.message,
    });
  }
}

module.exports = {
  createProduct,
  getAllProducts,
  getProductsByFarmer,
  updateProduct,
  deleteProduct,
};
