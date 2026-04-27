const Razorpay = require('razorpay');
const crypto = require('crypto');
const Order = require('../models/Order');
const PRICING = require('../config/pricing');
const { sendBookingConfirmation } = require('../utils/emailService');

let razorpayInstance = null;
const getRazorpay = () => {
  if (!razorpayInstance) {
    if (!process.env.RAZORPAY_KEY_ID || process.env.RAZORPAY_KEY_ID === 'dummy_key_id_for_dev') {
      throw new Error('Razorpay key_id is not configured.');
    }
    razorpayInstance = new Razorpay({
      key_id: process.env.RAZORPAY_KEY_ID,
      key_secret: process.env.RAZORPAY_KEY_SECRET,
    });
  }
  return razorpayInstance;
};

// @desc    Create Razorpay order
// @route   POST /api/payments/create-order
// @access  Private
exports.createRazorpayOrder = async (req, res) => {
  try {
    const { amount, currency = 'INR', receipt, notes } = req.body;

    if (!amount || amount <= 0) {
      return res.status(400).json({ success: false, message: 'Valid amount is required.' });
    }

    const options = {
      amount: Math.round(amount * 100), // Convert to paise
      currency,
      receipt: receipt || `rcpt_${Date.now()}`,
      notes: notes || {},
    };

    const razorpayOrder = await getRazorpay().orders.create(options);

    res.status(201).json({
      success: true,
      order: razorpayOrder,
      keyId: process.env.RAZORPAY_KEY_ID,
    });
  } catch (err) {
    console.error('Razorpay create order error:', err);
    res.status(500).json({ success: false, message: err.message || 'Failed to create payment order.' });
  }
};

// @desc    Verify Razorpay payment
// @route   POST /api/payments/verify
// @access  Private
exports.verifyPayment = async (req, res) => {
  try {
    const { razorpayOrderId, razorpayPaymentId, razorpaySignature, orderData } = req.body;

    if (!razorpayOrderId || !razorpayPaymentId || !razorpaySignature) {
      return res.status(400).json({ success: false, message: 'Missing payment verification fields.' });
    }

    // Verify signature
    const body = razorpayOrderId + '|' + razorpayPaymentId;
    const expectedSignature = crypto
      .createHmac('sha256', process.env.RAZORPAY_KEY_SECRET)
      .update(body)
      .digest('hex');

    if (expectedSignature !== razorpaySignature) {
      return res.status(400).json({ success: false, message: 'Invalid payment signature.' });
    }

    // Calculate earnings split
    const platformFee = Math.round(orderData.price * PRICING.PLATFORM_COMMISSION);
    const partnerAmount = orderData.price - platformFee;

    // Create the actual order in DB
    const order = await Order.create({
      ...orderData,
      userId: req.user?._id || null,
      payStatus: 'Paid',
      payMethod: orderData.payMethod || 'UPI',
      phoneOtpVerified: true,
      razorpayOrderId,
      razorpayPaymentId,
      razorpaySignature,
      platformFee,
      partnerAmount,
    });

    // Send confirmation email
    if (orderData.customerEmail) {
      try {
        await sendBookingConfirmation({
          to: orderData.customerEmail,
          name: orderData.customer,
          orderId: order.orderId,
          pickup: orderData.pickup,
          drop: orderData.drop,
          price: orderData.price,
          payMethod: orderData.payMethod || 'UPI',
        });
      } catch (emailErr) {
        console.error('Confirmation email failed:', emailErr.message);
      }
    }

    res.json({
      success: true,
      message: 'Payment verified and order created.',
      order,
    });
  } catch (err) {
    console.error('Payment verify error:', err);
    res.status(500).json({ success: false, message: err.message });
  }
};

// @desc    Get Razorpay key (public)
// @route   GET /api/payments/key
// @access  Public
exports.getRazorpayKey = (req, res) => {
  res.json({
    success: true,
    keyId: process.env.RAZORPAY_KEY_ID,
  });
};

