const Order = require('../models/Order');
const User = require('../models/User');
const Wallet = require('../models/Wallet');
const PRICING = require('../config/pricing');
const { sendOrderOtpSms } = require('../utils/smsService');
const { sendStatusUpdate } = require('../utils/emailService');

const generateOtp = () => `${Math.floor(100000 + Math.random() * 900000)}`;
const generateDeliveryOtp = () => `${Math.floor(1000 + Math.random() * 9000)}`;
const isValidIndianPhone = (phone = '') => /^\d{10}$/.test(phone);
const sanitizeOrder = (order) => {
  const cleanOrder = order.toObject ? order.toObject() : { ...order };
  delete cleanOrder.phoneOtp;
  delete cleanOrder.deliveryOtp;
  return cleanOrder;
};

// Helper: calculate earnings split
const calculateEarnings = (totalAmount) => {
  const platformFee = Math.round(totalAmount * PRICING.PLATFORM_COMMISSION);
  const partnerAmount = totalAmount - platformFee;
  return { platformFee, partnerAmount };
};

// @desc    Create a new order (after payment)
// @route   POST /api/orders
// @access  Private
exports.createOrder = async (req, res) => {
  try {
    const { customer, customerPhone, customerEmail, pickup, drop, type, size, urgency, price, payMethod, razorpayOrderId, razorpayPaymentId, razorpaySignature, deliveryType, items, totalWeight } = req.body;
    const isCodOrder = payMethod === 'COD';

    if (!pickup || !drop || !price) {
      return res.status(400).json({ success: false, message: 'Pickup, drop, and price are required.' });
    }

    if (!customerPhone || !isValidIndianPhone(customerPhone)) {
      return res.status(400).json({ success: false, message: 'Enter a valid 10-digit mobile number to receive OTP.' });
    }

    const otp = isCodOrder ? null : generateOtp();
    const otpExpiresAt = isCodOrder ? null : new Date(Date.now() + 10 * 60 * 1000);

    const { platformFee, partnerAmount } = calculateEarnings(price);

    const order = await Order.create({
      customer: customer || 'Guest',
      customerPhone,
      customerEmail,
      pickup,
      drop,
      type,
      size,
      urgency,
      price,
      payMethod,
      userId: req.user?._id || null,
      phoneOtp: otp || undefined,
      phoneOtpExpiresAt: otpExpiresAt,
      phoneOtpVerified: isCodOrder,
      razorpayOrderId,
      razorpayPaymentId,
      razorpaySignature,
      payStatus: razorpayPaymentId ? 'Paid' : 'Pending',
      deliveryType: deliveryType || 'single',
      items: items || [],
      totalWeight: totalWeight || 0,
      platformFee,
      partnerAmount,
    });

    let smsResult = { delivered: false, provider: 'console' };
    if (!isCodOrder) {
      try {
        smsResult = await sendOrderOtpSms({
          phone: customerPhone,
          otp,
          orderId: order.orderId,
        });
      } catch (smsError) {
        console.error(smsError.message);
      }
    }

    res.status(201).json({
      success: true,
      message: isCodOrder ? 'Order placed successfully! Pay cash on delivery.' : 'Order created successfully! OTP sent to your phone number.',
      order: sanitizeOrder(order),
      otpRequired: !isCodOrder,
      smsProvider: smsResult.provider,
      devOtp: !isCodOrder && process.env.NODE_ENV !== 'production' ? otp : undefined,
    });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

// @desc    Verify order phone OTP
// @route   POST /api/orders/:id/verify-otp
// @access  Private
exports.verifyOrderOtp = async (req, res) => {
  try {
    const { otp } = req.body;
    const order = await Order.findOne({ orderId: req.params.id }).select('+phoneOtp');

    if (!order) {
      return res.status(404).json({ success: false, message: 'Order not found.' });
    }

    if (!otp || !/^\d{6}$/.test(otp)) {
      return res.status(400).json({ success: false, message: 'Enter the 6-digit OTP.' });
    }

    if (String(order.userId) !== String(req.user._id)) {
      return res.status(403).json({ success: false, message: "You cannot verify another user's order." });
    }

    if (order.phoneOtpVerified) {
      return res.json({ success: true, message: 'OTP already verified.', order: sanitizeOrder(order) });
    }

    if (!order.phoneOtpExpiresAt || order.phoneOtpExpiresAt.getTime() < Date.now()) {
      return res.status(400).json({ success: false, message: 'OTP expired. Place the order again.' });
    }

    if (order.phoneOtp !== otp) {
      return res.status(400).json({ success: false, message: 'Invalid OTP.' });
    }

    order.phoneOtpVerified = true;
    order.timeline = [
      { event: 'Order Placed', done: true, time: new Date() },
      ...order.timeline.slice(1),
    ];
    await order.save();

    res.json({ success: true, message: 'Phone OTP verified. Order confirmed.', order: sanitizeOrder(order) });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

// @desc    Get single order by orderId (for tracking)
// @route   GET /api/orders/:id
// @access  Public
exports.getOrderById = async (req, res) => {
  try {
    const order = await Order.findOne({ orderId: req.params.id }).populate('partner', 'name phone vehicle rating');

    if (!order) {
      return res.status(404).json({ success: false, message: `Order ${req.params.id} not found.` });
    }

    res.json({ success: true, order });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

// @desc    Get all orders (admin)
// @route   GET /api/orders
// @access  Admin
exports.getAllOrders = async (req, res) => {
  try {
    const orders = await Order.find().sort({ createdAt: -1 }).populate('partner', 'name');
    res.json({ success: true, count: orders.length, orders });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

// @desc    Get orders for logged-in user
// @route   GET /api/orders/myorders
// @access  Private
exports.getMyOrders = async (req, res) => {
  try {
    const orders = await Order.find({ userId: req.user._id }).sort({ createdAt: -1 });
    res.json({ success: true, orders });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

// @desc    Get available orders for partners (pending, not assigned)
// @route   GET /api/orders/available
// @access  Partner
exports.getAvailableOrders = async (req, res) => {
  try {
    const orders = await Order.find({
      status: 'pending',
      partner: { $exists: false },
      phoneOtpVerified: true,
    }).sort({ createdAt: -1 });

    res.json({ success: true, count: orders.length, orders });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

// @desc    Partner accepts an order
// @route   PUT /api/orders/:id/accept
// @access  Partner
exports.acceptOrder = async (req, res) => {
  try {
    const order = await Order.findOne({ orderId: req.params.id });
    if (!order) return res.status(404).json({ success: false, message: 'Order not found.' });
    if (order.partner) return res.status(400).json({ success: false, message: 'Order already assigned.' });
    if (order.status !== 'pending') return res.status(400).json({ success: false, message: 'Order not available.' });

    const partner = await User.findById(req.user._id);
    if (!partner || partner.role !== 'partner') {
      return res.status(403).json({ success: false, message: 'Only partners can accept orders.' });
    }

    order.partner = req.user._id;
    order.partnerName = partner.name;
    order.status = 'accepted';
    order.timeline = order.timeline.map((t) =>
      t.event === 'Partner Assigned' ? { ...t, done: true, time: new Date() } : t
    );
    await order.save();

    // Update partner stats
    partner.totalOrders += 1;
    await partner.save();

    // Send status update email
    if (order.customerEmail) {
      try {
        await sendStatusUpdate({
          to: order.customerEmail,
          name: order.customer,
          orderId: order.orderId,
          status: 'accepted',
          partnerName: partner.name,
        });
      } catch (e) { console.error('Status email failed:', e.message); }
    }

    res.json({ success: true, message: 'Order accepted!', order: sanitizeOrder(order) });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

// @desc    Partner updates order status
// @route   PUT /api/orders/:id/status
// @access  Partner
exports.updateOrderStatus = async (req, res) => {
  try {
    const { status, otp } = req.body;
    const validStatuses = ['picked_up', 'out_for_delivery', 'delivered'];

    if (!validStatuses.includes(status)) {
      return res.status(400).json({ success: false, message: 'Invalid status update.' });
    }

    const order = await Order.findOne({ orderId: req.params.id }).select('+deliveryOtp');
    if (!order) return res.status(404).json({ success: false, message: 'Order not found.' });

    // Only assigned partner or admin can update
    if (String(order.partner) !== String(req.user._id) && !['admin', 'superadmin'].includes(req.user.role)) {
      return res.status(403).json({ success: false, message: 'Not authorized to update this order.' });
    }

    // Delivery requires OTP verification
    if (status === 'delivered') {
      if (!order.deliveryOtp) {
        return res.status(400).json({ success: false, message: 'Delivery OTP not generated yet. Mark as out for delivery first.' });
      }
      if (!order.deliveryOtpVerified) {
        return res.status(400).json({ success: false, message: 'Delivery OTP not verified. Ask customer for OTP.' });
      }
    }

    order.status = status;

    // Update timeline
    const eventMap = {
      picked_up: 'Picked Up',
      out_for_delivery: 'Out for Delivery',
      delivered: 'Delivered',
    };

    order.timeline = order.timeline.map((t) =>
      t.event === eventMap[status] ? { ...t, done: true, time: new Date() } : t
    );

    // Generate delivery OTP when moving to out_for_delivery
    if (status === 'out_for_delivery') {
      const deliveryOtp = generateDeliveryOtp();
      order.deliveryOtp = deliveryOtp;
      order.deliveryOtpExpiresAt = new Date(Date.now() + 30 * 60 * 1000); // 30 min expiry
      order.deliveryOtpVerified = false;

      // Send OTP to customer via SMS
      if (order.customerPhone) {
        try {
          await sendOrderOtpSms({
            phone: order.customerPhone,
            otp: deliveryOtp,
            orderId: order.orderId,
            message: `Your SmartDrop delivery OTP is ${deliveryOtp}. Share it with partner ${order.partnerName} to receive your order.`,
          });
        } catch (smsError) {
          console.error('Delivery OTP SMS failed:', smsError.message);
        }
      }
    }

    // On delivered: update pay status, credit wallet
    if (status === 'delivered') {
      order.payStatus = 'Completed';

      // Update partner wallet
      if (order.partner && order.partnerAmount > 0) {
        let wallet = await Wallet.findOne({ partnerId: order.partner });
        if (!wallet) {
          wallet = await Wallet.create({
            partnerId: order.partner,
            balance: 0,
            transactions: [],
          });
        }

        wallet.balance += order.partnerAmount;
        wallet.transactions.push({
          orderId: order.orderId,
          amount: order.partnerAmount,
          type: 'credit',
          description: `Delivery earning for ${order.orderId}`,
        });
        await wallet.save();

        // Also update legacy totalEarnings on User for backward compat
        const partner = await User.findById(order.partner);
        if (partner) {
          partner.totalEarnings += order.partnerAmount;
          await partner.save();
        }
      }
    }

    await order.save();

    // Send status update email
    if (order.customerEmail) {
      try {
        await sendStatusUpdate({
          to: order.customerEmail,
          name: order.customer,
          orderId: order.orderId,
          status,
          partnerName: order.partnerName,
        });
      } catch (e) { console.error('Status email failed:', e.message); }
    }

    const responseOrder = sanitizeOrder(order);
    // Include deliveryOtp in response only for dev or if partner just generated it
    if (status === 'out_for_delivery' && process.env.NODE_ENV !== 'production') {
      responseOrder.deliveryOtp = order.deliveryOtp;
    }

    res.json({ success: true, message: `Order ${status.replace(/_/g, ' ')}!`, order: responseOrder });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

// @desc    Verify delivery OTP
// @route   POST /api/orders/:id/verify-delivery-otp
// @access  Private (customer or admin)
exports.verifyDeliveryOtp = async (req, res) => {
  try {
    const { otp } = req.body;
    const order = await Order.findOne({ orderId: req.params.id }).select('+deliveryOtp');

    if (!order) {
      return res.status(404).json({ success: false, message: 'Order not found.' });
    }

    if (!otp || !/^\d{4}$/.test(otp)) {
      return res.status(400).json({ success: false, message: 'Enter the 4-digit delivery OTP.' });
    }

    // Allow: order owner, partner assigned, or admin
    const isOwner = String(order.userId) === String(req.user._id);
    const isPartner = String(order.partner) === String(req.user._id);
    const isAdmin = ['admin', 'superadmin'].includes(req.user.role);

    if (!isOwner && !isPartner && !isAdmin) {
      return res.status(403).json({ success: false, message: 'Not authorized.' });
    }

    if (order.deliveryOtpVerified) {
      return res.json({ success: true, message: 'Delivery OTP already verified.', order: sanitizeOrder(order) });
    }

    if (!order.deliveryOtp || !order.deliveryOtpExpiresAt || order.deliveryOtpExpiresAt.getTime() < Date.now()) {
      return res.status(400).json({ success: false, message: 'Delivery OTP expired. Ask partner to regenerate.' });
    }

    if (order.deliveryOtp !== otp) {
      return res.status(400).json({ success: false, message: 'Invalid delivery OTP.' });
    }

    order.deliveryOtpVerified = true;
    await order.save();

    res.json({ success: true, message: 'Delivery OTP verified. Partner can now mark delivered.', order: sanitizeOrder(order) });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

// @desc    Get partner's assigned/active orders
// @route   GET /api/orders/partner/orders
// @access  Partner
exports.getPartnerOrders = async (req, res) => {
  try {
    const orders = await Order.find({
      partner: req.user._id,
      status: { $in: ['accepted', 'picked_up', 'out_for_delivery'] },
    }).sort({ createdAt: -1 });

    res.json({ success: true, orders });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

// @desc    Get partner's earnings + wallet
// @route   GET /api/orders/partner/earnings
// @access  Partner
exports.getPartnerEarnings = async (req, res) => {
  try {
    const partner = await User.findById(req.user._id).select('totalEarnings totalOrders rating');
    const wallet = await Wallet.findOne({ partnerId: req.user._id });
    const orders = await Order.find({
      partner: req.user._id,
      status: 'delivered',
    }).sort({ createdAt: -1 }).limit(50);

    // Weekly earnings aggregation (using partnerAmount, not hardcoded 0.7)
    const weekly = [];
    const days = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
    for (let i = 6; i >= 0; i--) {
      const d = new Date();
      d.setDate(d.getDate() - i);
      const dayOrders = orders.filter((o) => {
        const od = new Date(o.updatedAt);
        return od.toDateString() === d.toDateString();
      });
      weekly.push({
        day: days[d.getDay()],
        earn: dayOrders.reduce((sum, o) => sum + (o.partnerAmount || 0), 0),
        count: dayOrders.length,
      });
    }

    res.json({
      success: true,
      partner,
      wallet: wallet ? { balance: wallet.balance, transactionCount: wallet.transactions.length } : { balance: 0, transactionCount: 0 },
      weekly,
      recentOrders: orders.slice(0, 10),
    });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

// @desc    Update order (admin general update)
// @route   PUT /api/orders/:id
// @access  Admin or Partner
exports.updateOrder = async (req, res) => {
  try {
    const { status, payStatus, partnerName, timeline } = req.body;

    const order = await Order.findOne({ orderId: req.params.id });
    if (!order) return res.status(404).json({ success: false, message: 'Order not found.' });

    if (status) order.status = status;
    if (payStatus) order.payStatus = payStatus;
    if (partnerName) order.partnerName = partnerName;
    if (timeline) order.timeline = timeline;

    await order.save();
    res.json({ success: true, message: 'Order updated.', order });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

// @desc    Admin dashboard stats
// @route   GET /api/orders/stats
// @access  Admin
exports.getStats = async (req, res) => {
  try {
    const total = await Order.countDocuments();
    const delivered = await Order.countDocuments({ status: 'delivered' });
    const transit = await Order.countDocuments({ status: { $in: ['accepted', 'picked_up', 'out_for_delivery'] } });
    const pending = await Order.countDocuments({ status: 'pending' });

    // Revenue aggregation with earnings split
    const revenueAgg = await Order.aggregate([
      { $match: { payStatus: { $in: ['Paid', 'Completed'] } } },
      {
        $group: {
          _id: null,
          totalRevenue: { $sum: '$price' },
          totalPlatformFee: { $sum: '$platformFee' },
          totalPartnerAmount: { $sum: '$partnerAmount' },
        },
      },
    ]);

    // Delivery type breakdown
    const deliveryTypeBreakdown = await Order.aggregate([
      { $group: { _id: '$deliveryType', count: { $sum: 1 } } },
    ]);

    const deliveryTypes = { single: 0, multi: 0, bulk: 0 };
    deliveryTypeBreakdown.forEach((d) => {
      if (d._id) deliveryTypes[d._id] = d.count;
    });

    // Daily deliveries (today)
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const dailyDeliveries = await Order.countDocuments({ status: 'delivered', updatedAt: { $gte: today } });

    res.json({
      success: true,
      stats: {
        total,
        delivered,
        transit,
        pending,
        dailyDeliveries,
        revenue: revenueAgg[0]?.totalRevenue || 0,
        platformEarning: revenueAgg[0]?.totalPlatformFee || 0,
        partnerPayout: revenueAgg[0]?.totalPartnerAmount || 0,
        commissionPercent: Math.round(PRICING.PLATFORM_COMMISSION * 100),
        deliveryTypes,
      },
    });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};
