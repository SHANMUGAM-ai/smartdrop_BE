const Support = require('../models/Support');

// @desc    Submit support ticket
// @route   POST /api/support
// @access  Public
exports.createTicket = async (req, res) => {
  try {
    const { name, contact, orderId, issueType, message } = req.body;
    if (!name || !contact || !message) {
      return res.status(400).json({ success: false, message: 'Name, contact, and message are required.' });
    }
    const ticket = await Support.create({ name, contact, orderId, issueType, message });
    res.status(201).json({ success: true, message: 'Ticket submitted!', ticket });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

// @desc    Get all tickets (admin)
// @route   GET /api/support
// @access  Admin
exports.getAllTickets = async (req, res) => {
  try {
    const tickets = await Support.find().sort({ createdAt: -1 });
    res.json({ success: true, count: tickets.length, tickets });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

// @desc    Update ticket status
// @route   PUT /api/support/:id
// @access  Admin
exports.updateTicket = async (req, res) => {
  try {
    const ticket = await Support.findByIdAndUpdate(
      req.params.id,
      { status: req.body.status, unread: false },
      { new: true }
    );
    if (!ticket) return res.status(404).json({ success: false, message: 'Ticket not found.' });
    res.json({ success: true, ticket });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};
