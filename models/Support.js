const mongoose = require('mongoose');

const supportSchema = new mongoose.Schema(
  {
    ticketId: { type: String, unique: true },
    name: { type: String, required: true },
    contact: { type: String, required: true },
    orderId: { type: String },
    issueType: {
      type: String,
      enum: ['Delivery Issue', 'Payment Issue', 'Partner Issue', 'Other'],
      default: 'Other',
    },
    message: { type: String, required: true },
    status: { type: String, enum: ['Open', 'In Progress', 'Resolved'], default: 'Open' },
    unread: { type: Boolean, default: true },
  },
  { timestamps: true }
);

supportSchema.pre('save', async function (next) {
  if (!this.ticketId) {
    const count = await mongoose.model('Support').countDocuments();
    this.ticketId = `TKT-${2000 + count + 1}`;
  }
  next();
});

module.exports = mongoose.model('Support', supportSchema);
