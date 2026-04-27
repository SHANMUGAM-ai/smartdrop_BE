const mongoose = require('mongoose');

const walletSchema = new mongoose.Schema(
  {
    partnerId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
      unique: true,
      index: true,
    },
    balance: { type: Number, default: 0, min: 0 },
    transactions: [
      {
        orderId: { type: String, required: true },
        amount: { type: Number, required: true },
        type: { type: String, enum: ['credit', 'debit'], default: 'credit' },
        description: { type: String },
        createdAt: { type: Date, default: Date.now },
      },
    ],
  },
  { timestamps: true }
);

module.exports = mongoose.model('Wallet', walletSchema);

