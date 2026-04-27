const express = require('express');
const router = express.Router();
const { createRazorpayOrder, verifyPayment, getRazorpayKey } = require('../controllers/paymentController');
const { protect } = require('../middleware/authMiddleware');

router.get('/key', getRazorpayKey);
router.post('/create-order', protect, createRazorpayOrder);
router.post('/verify', protect, verifyPayment);

module.exports = router;

