const express = require('express');
const router = express.Router();
const { registerUser, loginUser, getMe, getAllUsers, getPartners, updateUserAccess, createAdmin } = require('../controllers/userController');
const { protect, adminOnly, superAdminOnly } = require('../middleware/authMiddleware');
const { upload } = require('../config/cloudinary');

router.post('/register', registerUser);
router.post('/login', loginUser);
router.post('/admin', protect, superAdminOnly, createAdmin);
router.get('/me', protect, getMe);
router.get('/', protect, adminOnly, getAllUsers);
router.get('/partners', protect, adminOnly, getPartners);
router.put('/:id/access', protect, adminOnly, updateUserAccess);
router.post('/upload-photo', protect, upload.single('photo'), (req, res) => {
  if (!req.file) {
    return res.status(400).json({ success: false, message: 'No file uploaded.' });
  }
  res.json({ success: true, url: req.file.path });
});

module.exports = router;
