const mongoose = require('mongoose');

const orderSchema = new mongoose.Schema(
  {
    orderId: { type: String, unique: true },
    customer: { type: String, required: true },
    customerPhone: { type: String },
    customerEmail: { type: String },
    pickup: { type: String, required: [true, 'Pickup location is required'] },
    drop: { type: String, required: [true, 'Drop location is required'] },
    type: {
      type: String,
      enum: ['Normal', 'Fragile', 'Food', 'Document'],
      default: 'Normal',
    },
    size: { type: String, enum: ['Small', 'Medium', 'Large'], default: 'Small' },
    urgency: { type: String, enum: ['Normal', 'Express'], default: 'Normal' },
    price: { type: Number, required: true },
    deliveryType: {
      type: String,
      enum: ['single', 'multi', 'bulk'],
      default: 'single',
    },
    items: [
      {
        name: { type: String, default: '' },
        quantity: { type: Number, default: 1 },
        weight: { type: Number, default: 0 },
        price: { type: Number, default: 0 },
      },
    ],
    totalWeight: { type: Number, default: 0 },
    payMethod: {
      type: String,
      enum: ['UPI', 'Card', 'NetBanking', 'COD', 'Razorpay'],
      default: 'UPI',
    },
    payStatus: { type: String, enum: ['Pending', 'Paid', 'Completed', 'Failed'], default: 'Pending' },
    status: {
      type: String,
      enum: ['pending', 'accepted', 'picked_up', 'out_for_delivery', 'delivered', 'cancelled'],
      default: 'pending',
    },
    partner: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
    partnerName: { type: String, default: 'Assigning...' },
    userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
    phoneOtp: { type: String, select: false },
    phoneOtpExpiresAt: { type: Date },
    phoneOtpVerified: { type: Boolean, default: false },
    // Razorpay fields
    razorpayOrderId: { type: String },
    razorpayPaymentId: { type: String },
    razorpaySignature: { type: String },
    // Timeline events
    timeline: [
      {
        event: String,
        time: { type: Date, default: Date.now },
        done: { type: Boolean, default: false },
      },
    ],
    estimatedDelivery: { type: String },
    distance: { type: Number }, // in km
    // Delivery proof
    deliveryProofUrl: { type: String },

    // Earnings split
    platformFee: { type: Number, default: 0 },
    partnerAmount: { type: Number, default: 0 },

    // Delivery OTP (for handover verification)
    deliveryOtp: { type: String, select: false },
    deliveryOtpExpiresAt: { type: Date },
    deliveryOtpVerified: { type: Boolean, default: false },
  },
  { timestamps: true }
);

// Auto-generate orderId before saving
orderSchema.pre('save', async function (next) {
  if (!this.orderId) {
    const count = await mongoose.model('Order').countDocuments();
    this.orderId = `ORD-${1000 + count + 1}`;
    // Set default timeline
    this.timeline = [
      { event: 'Order Placed', done: true },
      { event: 'Partner Assigned', done: false },
      { event: 'Picked Up', done: false },
      { event: 'Out for Delivery', done: false },
      { event: 'Delivered', done: false },
    ];
  }
  next();
});

module.exports = mongoose.model('Order', orderSchema);

