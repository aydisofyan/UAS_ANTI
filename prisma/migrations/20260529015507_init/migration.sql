-- CreateTable
CREATE TABLE "User" (
    "ID_User" TEXT NOT NULL PRIMARY KEY,
    "Nama" TEXT NOT NULL,
    "Email" TEXT NOT NULL,
    "Password" TEXT NOT NULL,
    "Peran" TEXT NOT NULL
);

-- CreateTable
CREATE TABLE "Produk" (
    "ID_Produk" TEXT NOT NULL PRIMARY KEY,
    "ID_User_Petani" TEXT NOT NULL,
    "Nama_Produk" TEXT NOT NULL,
    "Kategori" TEXT NOT NULL,
    "Stok" INTEGER NOT NULL,
    "Harga" REAL NOT NULL,
    CONSTRAINT "Produk_ID_User_Petani_fkey" FOREIGN KEY ("ID_User_Petani") REFERENCES "User" ("ID_User") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "Pesanan" (
    "ID_Pesanan" TEXT NOT NULL PRIMARY KEY,
    "ID_User_Pembeli" TEXT NOT NULL,
    "Tanggal_Pesan" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "Status_Pesanan" TEXT NOT NULL,
    "Total_Harga" REAL NOT NULL,
    CONSTRAINT "Pesanan_ID_User_Pembeli_fkey" FOREIGN KEY ("ID_User_Pembeli") REFERENCES "User" ("ID_User") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "Detail_Pesanan" (
    "ID_Detail" TEXT NOT NULL PRIMARY KEY,
    "ID_Pesanan" TEXT NOT NULL,
    "ID_Produk" TEXT NOT NULL,
    "Jumlah_Beli" INTEGER NOT NULL,
    "Subtotal" REAL NOT NULL,
    CONSTRAINT "Detail_Pesanan_ID_Pesanan_fkey" FOREIGN KEY ("ID_Pesanan") REFERENCES "Pesanan" ("ID_Pesanan") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "Detail_Pesanan_ID_Produk_fkey" FOREIGN KEY ("ID_Produk") REFERENCES "Produk" ("ID_Produk") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "Pengiriman" (
    "ID_Pengiriman" TEXT NOT NULL PRIMARY KEY,
    "ID_Pesanan" TEXT NOT NULL,
    "Kurir" TEXT NOT NULL,
    "Resi" TEXT NOT NULL,
    "Estimasi_Tiba" DATETIME NOT NULL,
    "Status_Kirim" TEXT NOT NULL,
    CONSTRAINT "Pengiriman_ID_Pesanan_fkey" FOREIGN KEY ("ID_Pesanan") REFERENCES "Pesanan" ("ID_Pesanan") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "BlockchainBlock" (
    "ID_Block" TEXT NOT NULL PRIMARY KEY,
    "Index" INTEGER NOT NULL,
    "Tanggal" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "ID_Pengiriman" TEXT NOT NULL,
    "Data" TEXT NOT NULL,
    "Prev_Hash" TEXT NOT NULL,
    "Hash" TEXT NOT NULL,
    CONSTRAINT "BlockchainBlock_ID_Pengiriman_fkey" FOREIGN KEY ("ID_Pengiriman") REFERENCES "Pengiriman" ("ID_Pengiriman") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateIndex
CREATE UNIQUE INDEX "User_Email_key" ON "User"("Email");

-- CreateIndex
CREATE UNIQUE INDEX "Pengiriman_Resi_key" ON "Pengiriman"("Resi");
