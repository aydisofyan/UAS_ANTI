/**
 * Middleware factory for Role-Based Access Control
 * @param {Array<string>} allowedRoles - Array of roles permitted to access the endpoint
 */
function authorize(allowedRoles = []) {
  // Convert string to array if a single role is passed
  if (typeof allowedRoles === 'string') {
    allowedRoles = [allowedRoles];
  }

  return (req, res, next) => {
    if (!req.user) {
      return res.status(401).json({
        success: false,
        message: 'Akses ditolak: User tidak terotentikasi.',
      });
    }

    const { Peran } = req.user;

    // Check if the user's role is allowed
    if (allowedRoles.length && !allowedRoles.includes(Peran)) {
      return res.status(403).json({
        success: false,
        message: `Akses ditolak: Peran '${Peran}' tidak diizinkan untuk melakukan aksi ini.`,
      });
    }

    next();
  };
}

module.exports = authorize;
