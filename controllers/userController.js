const User = require('../models/User');
const jwt = require('jsonwebtoken');

const SUPERADMIN_EMAIL = process.env.SUPERADMIN_EMAIL;
const SUPERADMIN_PASSWORD = process.env.SUPERADMIN_PASSWORD;

// Generate JWT token
const generateToken = (id) =>
  jwt.sign({ id }, process.env.JWT_SECRET, { expiresIn: process.env.JWT_EXPIRE || '30d' });

const toUserResponse = (user) => ({
  _id: user._id,
  name: user.name,
  email: user.email,
  phone: user.phone,
  role: user.role,
  partnerStatus: user.partnerStatus,
  zone: user.zone,
  serviceType: user.serviceType,
  vehicle: user.vehicle,
  vehicleNumber: user.vehicleNumber,
  licenseNumber: user.licenseNumber,
  rcBookNumber: user.rcBookNumber,
  personPhotoUrl: user.personPhotoUrl,
  partnerReviewedAt: user.partnerReviewedAt,
  partnerReviewedBy: user.partnerReviewedBy,
  partnerReviewNotes: user.partnerReviewNotes,
  isBlocked: user.isBlocked,
  createdAt: user.createdAt,
});

// @desc    Register new user
// @route   POST /api/users/register
// @access  Public
exports.registerUser = async (req, res) => {
  try {
    const {
      name,
      email,
      phone,
      password,
      role,
      zone,
      serviceType,
      vehicle,
      vehicleNumber,
      licenseNumber,
      rcBookNumber,
      personPhotoUrl,
    } = req.body;

    if (!name || !email || !password) {
      return res.status(400).json({ success: false, message: 'Name, email and password are required.' });
    }

    // Prevent self-registration as admin or superadmin
    let safeRole = role;
    if (role === 'admin' || role === 'superadmin') {
      safeRole = 'user';
    }

    if (safeRole === 'partner') {
      const missingPartnerFields = [
        ['phone', phone],
        ['zone', zone],
        ['serviceType', serviceType],
        ['vehicle', vehicle],
        ['vehicleNumber', vehicleNumber],
        ['licenseNumber', licenseNumber],
        ['rcBookNumber', rcBookNumber],
        ['personPhotoUrl', personPhotoUrl],
      ].filter(([, value]) => !value);

      if (missingPartnerFields.length > 0) {
        return res.status(400).json({
          success: false,
          message: 'Phone, zone, service type, vehicle, vehicle number, license, RC book, and photo are required for partner registration.',
        });
      }
    }

    const exists = await User.findOne({ email });
    if (exists) {
      return res.status(400).json({ success: false, message: 'Email already registered.' });
    }

    const user = await User.create({
      name,
      email,
      phone,
      password,
      role: safeRole,
      partnerStatus: safeRole === 'partner' ? 'Pending' : 'Approved',
      zone,
      serviceType,
      vehicle,
      vehicleNumber,
      licenseNumber,
      rcBookNumber,
      personPhotoUrl,
    });

    if (safeRole === 'partner') {
      return res.status(201).json({
        success: true,
        message: 'Partner registration submitted successfully! Please wait for admin approval.',
        user: toUserResponse(user),
      });
    }

    res.status(201).json({
      success: true,
      message: 'Account created successfully!',
      user: toUserResponse(user),
      token: generateToken(user._id),
    });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

// @desc    Create admin/superadmin (superadmin only)
// @route   POST /api/users/admin
// @access  Super Admin
exports.createAdmin = async (req, res) => {
  try {
    const { name, email, phone, password, role } = req.body;

    if (!name || !email || !password || !role) {
      return res.status(400).json({ success: false, message: 'Name, email, password, and role are required.' });
    }

    if (!['admin', 'superadmin'].includes(role)) {
      return res.status(400).json({ success: false, message: 'Role must be admin or superadmin.' });
    }

    const exists = await User.findOne({ email });
    if (exists) {
      return res.status(400).json({ success: false, message: 'Email already registered.' });
    }

    const user = await User.create({
      name,
      email,
      phone,
      password,
      role,
      partnerStatus: 'Approved',
    });

    res.status(201).json({
      success: true,
      message: `${role === 'superadmin' ? 'Super admin' : 'Admin'} created successfully!`,
      user: toUserResponse(user),
    });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

// @desc    Login user
// @route   POST /api/users/login
// @access  Public
exports.loginUser = async (req, res) => {
  try {
    const { email, password } = req.body;

    if (!email || !password) {
      return res.status(400).json({ success: false, message: 'Email and password are required.' });
    }

    let user = await User.findOne({ email }).select('+password');

    if (!user && SUPERADMIN_EMAIL && SUPERADMIN_PASSWORD && email.toLowerCase() === SUPERADMIN_EMAIL.toLowerCase() && password === SUPERADMIN_PASSWORD) {
      user = await User.create({
        name: 'Super Admin',
        email: SUPERADMIN_EMAIL,
        password: SUPERADMIN_PASSWORD,
        role: 'superadmin',
      });
      user = await User.findById(user._id).select('+password');
    }

    if (!user || !(await user.matchPassword(password))) {
      return res.status(401).json({ success: false, message: 'Invalid email or password.' });
    }

    if (user.isBlocked && user.role !== 'superadmin') {
      return res.status(403).json({ success: false, message: 'Your account is blocked. Contact admin.' });
    }

    if (user.role === 'partner' && user.partnerStatus !== 'Approved') {
      return res.status(403).json({
        success: false,
        message: `Your partner account is ${user.partnerStatus.toLowerCase()}. Please wait for admin verification.`,
      });
    }

    res.json({
      success: true,
      message: `Welcome back, ${user.name}!`,
      user: toUserResponse(user),
      token: generateToken(user._id),
    });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

// @desc    Get current user profile
// @route   GET /api/users/me
// @access  Private
exports.getMe = async (req, res) => {
  const user = await User.findById(req.user._id);
  res.json({ success: true, user });
};

// @desc    Get all users (admin)
// @route   GET /api/users
// @access  Admin
exports.getAllUsers = async (req, res) => {
  try {
    const users = await User.find()
      .populate('partnerReviewedBy', 'name email role')
      .sort({ createdAt: -1 });
    res.json({ success: true, count: users.length, users });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

// @desc    Get all partners
// @route   GET /api/users/partners
// @access  Admin
exports.getPartners = async (req, res) => {
  try {
    const partners = await User.find({ role: 'partner' })
      .populate('partnerReviewedBy', 'name email role')
      .sort({ createdAt: -1 });
    res.json({ success: true, partners });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

exports.updateUserAccess = async (req, res) => {
  try {
    const { isBlocked, partnerStatus, role, partnerReviewNotes } = req.body;
    const updates = {};

    if (typeof isBlocked === 'boolean') updates.isBlocked = isBlocked;

    const existingUser = await User.findById(req.params.id).select('-password');
    if (!existingUser) return res.status(404).json({ success: false, message: 'User not found.' });

    // Only superadmin can modify other superadmins
    if (existingUser.role === 'superadmin' && req.user.role !== 'superadmin') {
      return res.status(403).json({ success: false, message: 'Super admin account cannot be modified by another admin.' });
    }

    // Superadmins can never be blocked
    if (existingUser.role === 'superadmin' && typeof isBlocked === 'boolean' && isBlocked === true) {
      return res.status(403).json({ success: false, message: 'Super admin accounts cannot be blocked.' });
    }

    // Only superadmin can change roles to/from admin/superadmin
    if (role && ['admin', 'superadmin'].includes(role)) {
      if (req.user.role !== 'superadmin') {
        return res.status(403).json({ success: false, message: 'Only superadmin can assign admin roles.' });
      }
      updates.role = role;
    }

    if (partnerStatus !== undefined) {
      if (!['Pending', 'Approved', 'Rejected'].includes(partnerStatus)) {
        return res.status(400).json({ success: false, message: 'Invalid partner status.' });
      }

      if (req.user.role !== 'superadmin') {
        return res.status(403).json({ success: false, message: 'Only superadmin can verify partner applications.' });
      }

      if (existingUser.role !== 'partner') {
        return res.status(400).json({ success: false, message: 'Partner verification is only available for partner accounts.' });
      }

      updates.partnerStatus = partnerStatus;

      if (partnerStatus === 'Pending') {
        updates.partnerReviewedAt = null;
        updates.partnerReviewedBy = null;
      } else {
        updates.partnerReviewedAt = new Date();
        updates.partnerReviewedBy = req.user._id;
      }
    }

    if (typeof partnerReviewNotes === 'string') {
      if (existingUser.role === 'partner' && req.user.role !== 'superadmin') {
        return res.status(403).json({ success: false, message: 'Only superadmin can update partner review notes.' });
      }
      updates.partnerReviewNotes = partnerReviewNotes.trim();
    }

    const user = await User.findByIdAndUpdate(req.params.id, updates, { new: true })
      .select('-password')
      .populate('partnerReviewedBy', 'name email role');

    res.json({ success: true, user });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};
