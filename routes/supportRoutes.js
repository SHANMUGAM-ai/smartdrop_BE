const express = require('express');
const router = express.Router();
const { createTicket, getAllTickets, updateTicket } = require('../controllers/supportController');
const { protect, adminOnly } = require('../middleware/authMiddleware');

router.post('/', protect, createTicket);
router.get('/', protect, adminOnly, getAllTickets);
router.put('/:id', protect, adminOnly, updateTicket);

module.exports = router;
