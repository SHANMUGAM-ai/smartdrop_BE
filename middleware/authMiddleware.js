const jwt = require('jsonwebtoken');
const User = require('../models/User');

// Protect routes — requires valid JWT
exports.protect = async (req, res, next) => {
  let token;

  if (req.headers.authorization && req.headers.authorization.startsWith('Bearer')) {
    token = req.headers.authorization.split(' ')[1];
  }

  if (!token) {
    return res.status(401).json({ success: false, message: 'Not authorized. No token provided.' });
  }

  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    req.user = await User.findById(decoded.id).select('-password');
    if (!req.user) {
      return res.status(401).json({ success: false, message: 'User not found.' });
    }
    if (req.user.isBlocked && req.user.role !== 'superadmin') {
      return res.status(403).json({ success: false, message: 'Your account is blocked. Contact admin.' });
    }
    if (req.user.role === 'partner' && req.user.partnerStatus !== 'Approved') {
      return res.status(403).json({ success: false, message: 'Your partner account is pending approval. Please wait for admin verification.' });
    }
    next();
  } catch (err) {
    return res.status(401).json({ success: false, message: 'Invalid or expired token.' });
  }
};

// Admin only
exports.adminOnly = (req, res, next) => {
  if (req.user && ['admin', 'superadmin'].includes(req.user.role)) return next();
  return res.status(403).json({ success: false, message: 'Access denied. Admins only.' });
};

// Super admin only
exports.superAdminOnly = (req, res, next) => {
  if (req.user && req.user.role === 'superadmin') return next();
  return res.status(403).json({ success: false, message: 'Access denied. Super admins only.' });
};

// Partner only
exports.partnerOnly = (req, res, next) => {
  if (req.user && (req.user.role === 'partner' || req.user.role === 'admin' || req.user.role === 'superadmin')) return next();
  return res.status(403).json({ success: false, message: 'Access denied. Partners only.' });
};
