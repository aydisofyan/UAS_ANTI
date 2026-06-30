const jwt = require('jsonwebtoken');

const JWT_SECRET = process.env.JWT_SECRET || 'saltchain_super_secret_secure_key_2026';

function authenticateJWT(req, res, next) {
  const authHeader = req.headers.authorization;

  if (authHeader) {
    // Expecting token formatted as: "Bearer <token>"
    const token = authHeader.split(' ')[1];

    if (!token) {
      return res.status(401).json({
        success: false,
        message: 'Akses ditolak: Format token tidak valid.',
      });
    }

    jwt.verify(token, JWT_SECRET, (err, decodedUser) => {
      if (err) {
        return res.status(403).json({
          success: false,
          message: 'Akses ditolak: Token tidak valid atau kedaluwarsa.',
        });
      }

      req.user = decodedUser;
      next();
    });
  } else {
    res.status(401).json({
      success: false,
      message: 'Akses ditolak: Header Otorisasi tidak ditemukan.',
    });
  }
}

module.exports = authenticateJWT;
