const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const prisma = require('../config/db');

const JWT_SECRET = process.env.JWT_SECRET || 'saltchain_super_secret_secure_key_2026';
const ALLOWED_ROLES = ['Petani', 'Pengepul', 'Pabrik', 'Kurir', 'Admin'];

/**
 * Register a new user
 */
async function register(req, res) {
  try {
    const { Nama, Email, Password, Peran } = req.body;

    // Validate request body
    if (!Nama || !Email || !Password || !Peran) {
      return res.status(400).json({
        success: false,
        message: 'Semua field (Nama, Email, Password, Peran) wajib diisi.',
      });
    }

    // Validate email format
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(Email)) {
      return res.status(400).json({
        success: false,
        message: 'Format email tidak valid.',
      });
    }

    // Validate role
    if (!ALLOWED_ROLES.includes(Peran)) {
      return res.status(400).json({
        success: false,
        message: `Peran tidak valid. Peran yang diperbolehkan: ${ALLOWED_ROLES.join(', ')}`,
      });
    }

    // Check if user already exists
    const existingUser = await prisma.user.findUnique({
      where: { Email },
    });

    if (existingUser) {
      return res.status(400).json({
        success: false,
        message: 'Email sudah terdaftar.',
      });
    }

    // Hash password
    const hashedPassword = await bcrypt.hash(Password, 10);

    // Create user
    const newUser = await prisma.user.create({
      data: {
        Nama,
        Email,
        Password: hashedPassword,
        Peran,
      },
    });

    return res.status(201).json({
      success: true,
      message: 'Registrasi berhasil!',
      data: {
        ID_User: newUser.ID_User,
        Nama: newUser.Nama,
        Email: newUser.Email,
        Peran: newUser.Peran,
      },
    });
  } catch (error) {
    console.error('Error in registration:', error);
    return res.status(500).json({
      success: false,
      message: 'Terjadi kesalahan server saat registrasi.',
      error: error.message,
    });
  }
}

/**
 * Login a user
 */
async function login(req, res) {
  try {
    const { Email, Password } = req.body;

    if (!Email || !Password) {
      return res.status(400).json({
        success: false,
        message: 'Email dan Password wajib diisi.',
      });
    }

    // Find user
    const user = await prisma.user.findUnique({
      where: { Email },
    });

    if (!user) {
      return res.status(401).json({
        success: false,
        message: 'Email atau Password salah.',
      });
    }

    // Validate password
    const isPasswordValid = await bcrypt.compare(Password, user.Password);
    if (!isPasswordValid) {
      return res.status(401).json({
        success: false,
        message: 'Email atau Password salah.',
      });
    }

    // Generate JWT token
    const token = jwt.sign(
      {
        ID_User: user.ID_User,
        Nama: user.Nama,
        Email: user.Email,
        Peran: user.Peran,
      },
      JWT_SECRET,
      { expiresIn: '24h' }
    );

    return res.status(200).json({
      success: true,
      message: 'Login berhasil!',
      token,
      user: {
        ID_User: user.ID_User,
        Nama: user.Nama,
        Email: user.Email,
        Peran: user.Peran,
      },
    });
  } catch (error) {
    console.error('Error in login:', error);
    return res.status(500).json({
      success: false,
      message: 'Terjadi kesalahan server saat login.',
      error: error.message,
    });
  }
}

/**
 * Get current authenticated user profile
 */
async function getProfile(req, res) {
  try {
    const user = await prisma.user.findUnique({
      where: { ID_User: req.user.ID_User },
      select: {
        ID_User: true,
        Nama: true,
        Email: true,
        Peran: true,
      },
    });

    if (!user) {
      return res.status(404).json({
        success: false,
        message: 'User tidak ditemukan.',
      });
    }

    return res.status(200).json({
      success: true,
      data: user,
    });
  } catch (error) {
    console.error('Error fetching profile:', error);
    return res.status(500).json({
      success: false,
      message: 'Terjadi kesalahan server saat mengambil data profil.',
      error: error.message,
    });
  }
}

module.exports = {
  register,
  login,
  getProfile,
};
