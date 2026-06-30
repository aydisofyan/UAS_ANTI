const { PrismaClient } = require('@prisma/client');
const bcrypt = require('bcryptjs');

const prisma = new PrismaClient();

async function main() {
  console.log('Seeding database with default users...');

  // Hash passwords
  const adminPassword = await bcrypt.hash('admin123', 10);
  const petaniPassword = await bcrypt.hash('petani123', 10);
  const pengepulPassword = await bcrypt.hash('pengepul123', 10);
  const pabrikPassword = await bcrypt.hash('pabrik123', 10);
  const kurirPassword = await bcrypt.hash('kurir123', 10);

  // Users data
  const users = [
    {
      Nama: 'Admin SaltChain',
      Email: 'admin@saltchain.com',
      Password: adminPassword,
      Peran: 'Admin',
    },
    {
      Nama: 'Pak Budi (Petani Garam Madura)',
      Email: 'petani1@saltchain.com',
      Password: petaniPassword,
      Peran: 'Petani',
    },
    {
      Nama: 'Bu Sri (Petani Garam Cirebon)',
      Email: 'petani2@saltchain.com',
      Password: petaniPassword,
      Peran: 'Petani',
    },
    {
      Nama: 'CV Selaras Jaya (Pengepul Garam)',
      Email: 'pengepul@saltchain.com',
      Password: pengepulPassword,
      Peran: 'Pengepul',
    },
    {
      Nama: 'PT Garam Industri Nusantara (Pabrik)',
      Email: 'pabrik@saltchain.com',
      Password: pabrikPassword,
      Peran: 'Pabrik',
    },
    {
      Nama: 'Agus Logistik (Kurir SaltChain)',
      Email: 'kurir@saltchain.com',
      Password: kurirPassword,
      Peran: 'Kurir',
    },
  ];

  for (const user of users) {
    const existing = await prisma.user.findUnique({
      where: { Email: user.Email },
    });

    if (!existing) {
      const created = await prisma.user.create({ data: user });
      console.log(`Created user: ${created.Nama} (${created.Peran})`);
    } else {
      console.log(`User already exists: ${existing.Nama}`);
    }
  }

  // Seed initial products for Pak Budi (Petani 1)
  const petani1 = await prisma.user.findFirst({ where: { Email: 'petani1@saltchain.com' } });
  if (petani1) {
    const products = [
      {
        ID_User_Petani: petani1.ID_User,
        Nama_Produk: 'Garam Kasar Madura Premium',
        Kategori: 'Garam Konsumsi',
        Stok: 500, // Kg
        Harga: 12000, // IDR per Kg
      },
      {
        ID_User_Petani: petani1.ID_User,
        Nama_Produk: 'Garam Halus Beryodium Madura',
        Kategori: 'Garam Dapur',
        Stok: 300, // Kg
        Harga: 15000, // IDR per Kg
      },
    ];

    for (const prod of products) {
      const existingProd = await prisma.produk.findFirst({
        where: { Nama_Produk: prod.Nama_Produk, ID_User_Petani: prod.ID_User_Petani },
      });
      if (!existingProd) {
        const p = await prisma.produk.create({ data: prod });
        console.log(`Created seed product: ${p.Nama_Produk}`);
      }
    }
  }

  // Seed initial products for Bu Sri (Petani 2)
  const petani2 = await prisma.user.findFirst({ where: { Email: 'petani2@saltchain.com' } });
  if (petani2) {
    const products = [
      {
        ID_User_Petani: petani2.ID_User,
        Nama_Produk: 'Garam Industri Cirebon Grade A',
        Kategori: 'Garam Industri',
        Stok: 1000, // Kg
        Harga: 9000, // IDR per Kg
      },
    ];

    for (const prod of products) {
      const existingProd = await prisma.produk.findFirst({
        where: { Nama_Produk: prod.Nama_Produk, ID_User_Petani: prod.ID_User_Petani },
      });
      if (!existingProd) {
        const p = await prisma.produk.create({ data: prod });
        console.log(`Created seed product: ${p.Nama_Produk}`);
      }
    }
  }

  console.log('Seeding completed successfully!');
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
