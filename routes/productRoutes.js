const express = require('express');
const router = express.Router();
const {
  createProduct,
  getProducts,
  getProductById,
  updateProduct,
  deleteProduct,
  getMyProducts,
  addReview,
} = require('../controllers/productController');
const { protect, partnerOnly, adminOnly } = require('../middleware/authMiddleware');

// Public routes
router.get('/', getProducts);
router.get('/:id', getProductById);

// Protected vendor/admin routes
router.post('/', protect, partnerOnly, createProduct);
router.get('/my/products', protect, partnerOnly, getMyProducts);
router.put('/:id', protect, partnerOnly, updateProduct);
router.delete('/:id', protect, partnerOnly, deleteProduct);

// Review route
router.post('/:id/reviews', protect, addReview);

module.exports = router;

