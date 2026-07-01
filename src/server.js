require('dotenv').config();
const express = require('express');
const cors = require('cors');
const morgan = require('morgan');
const path = require('path');
const prisma = require('./config/db');

// Catch Uncaught Exceptions globally to prevent the Node process from dying
process.on('uncaughtException', (error) => {
  console.error('🔥 CRITICAL ERROR: Uncaught Exception caught!');
  console.error(error.stack || error);
  console.log('🛡️  System recovery triggered: Server kept online safely.');
});

// Catch Unhandled Promise Rejections globally
process.on('unhandledRejection', (reason, promise) => {
  console.error('🔥 CRITICAL ERROR: Unhandled Rejection caught at:', promise);
  console.error('Reason:', reason.stack || reason);
  console.log('🛡️  System recovery triggered: Server kept online safely.');
});

// Routes imports
const authRoutes = require('./routes/auth');
const productRoutes = require('./routes/product');
const orderRoutes = require('./routes/order');
const shippingRoutes = require('./routes/shipping');
const ledgerRoutes = require('./routes/ledger');

const app = express();
const PORT = process.env.PORT || 3000;

// Middleware
app.use(cors());
app.use(express.json());
app.use(morgan('dev'));

// Set Request Timeout (prevent slow-loris attacks and hung connections - 30 seconds)
app.use((req, res, next) => {
  res.setTimeout(30000, () => {
    console.warn(`⏳ Request timeout triggered for ${req.method} ${req.url}`);
    if (!res.headersSent) {
      res.status(408).json({
        success: false,
        message: 'Koneksi melebihi batas waktu (Timeout). Silakan coba lagi.'
      });
    }
  });
  next();
});

// Serve Static Frontend Assets
app.use(express.static(path.join(__dirname, '../public')));

// API Routes Mounting
app.use('/api/auth', authRoutes);
app.use('/api/products', productRoutes);
app.use('/api/orders', orderRoutes);
app.use('/api/shippings', shippingRoutes);
app.use('/api/ledger', ledgerRoutes);

// Fallback to SPA Frontend for unmatched routes
app.get('*', (req, res) => {
  res.sendFile(path.join(__dirname, '../public/index.html'), (err) => {
    if (err) {
      if (!res.headersSent) {
        res.status(500).json({
          success: false,
          message: 'Gagal memuat halaman utama frontend SaltChain.',
        });
      }
    }
  });
});

// 🚨 GLOBAL ERROR BOUNDARY MIDDLEWARE
// Express will pipe any unhandled error inside routers straight here, preventing server crashes.
app.use((err, req, res, next) => {
  console.error('🚨 [Express Error Boundary Catch]:', err);
  
  if (res.headersSent) {
    return next(err);
  }

  res.status(500).json({
    success: false,
    message: 'Terjadi kesalahan sistem internal. Jaringan server tetap stabil dan online.',
    error: process.env.NODE_ENV === 'development' ? err.message : undefined
  });
});

// Start Server
if (require.main === module) {
  const server = app.listen(PORT, () => {
    console.log('========================================================');
    console.log(` 🧂 SaltChain Server is running on port ${PORT}`);
    console.log(` 🏷️  Slogan: "Transparansi Distribusi Garam dari Petani hingga Industri"`);
    console.log(` 🌐 Frontend Dashboard: http://localhost:${PORT}`);
    console.log('========================================================');
  });

  // Graceful Shutdown - Closes connections safely when closing/rebooting app
  const handleShutdown = async (signal) => {
    console.log(`\n🛑 Received ${signal}. Graceful shutdown initiated...`);
    
    // Close the HTTP Server
    server.close(async () => {
      console.log('🔌 Server HTTP dihentikan.');
      
      // Disconnect Prisma client safely
      try {
        await prisma.$disconnect();
        console.log('📦 Koneksi database Prisma diputus dengan aman.');
      } catch (dbErr) {
        console.error('Gagal memutus koneksi database:', dbErr);
      }
      
      console.log('👋 SaltChain dihentikan sepenuhnya dengan selamat.');
      process.exit(0);
    });

    // Force close after 10 seconds if graceful shutdown takes too long
    setTimeout(() => {
      console.error('⚠️ Graceful shutdown timed out. Forcing process exit.');
      process.exit(1);
    }, 10000);
  };

  process.on('SIGINT', () => handleShutdown('SIGINT'));
  process.on('SIGTERM', () => handleShutdown('SIGTERM'));
}

// Export app for Vercel Serverless environment
module.exports = app;
