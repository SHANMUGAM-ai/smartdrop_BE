const express = require('express');
const router = express.Router();
const {
  createOrder,
  verifyOrderOtp,
  verifyDeliveryOtp,
  getOrderById,
  getAllOrders,
  getMyOrders,
  updateOrder,
  getStats,
  getAvailableOrders,
  acceptOrder,
  updateOrderStatus,
  getPartnerOrders,
  getPartnerEarnings,
} = require('../controllers/orderController');
const { protect, adminOnly, partnerOnly } = require('../middleware/authMiddleware');

router.post('/', protect, createOrder);                 // Create order (logged in user)
router.post('/:id/verify-otp', protect, verifyOrderOtp);
router.post('/:id/verify-delivery-otp', protect, verifyDeliveryOtp); // Verify delivery OTP
router.get('/stats', protect, adminOnly, getStats);     // Admin stats
router.get('/myorders', protect, getMyOrders);          // User's own orders
router.get('/available', protect, partnerOnly, getAvailableOrders); // Partner: available orders
router.get('/partner/orders', protect, partnerOnly, getPartnerOrders); // Partner: my active orders
router.get('/partner/earnings', protect, partnerOnly, getPartnerEarnings); // Partner: earnings
router.get('/', protect, adminOnly, getAllOrders);       // Admin: all orders
router.get('/:id', getOrderById);                       // Track by orderId (public)
router.put('/:id', protect, partnerOnly, updateOrder);  // Admin/Partner general update
router.put('/:id/accept', protect, partnerOnly, acceptOrder); // Partner accept order
router.put('/:id/status', protect, partnerOnly, updateOrderStatus); // Partner update status

module.exports = router;

