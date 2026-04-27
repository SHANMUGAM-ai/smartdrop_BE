const mongoose = require('mongoose');

const reviewSchema = new mongoose.Schema(
  {
    user: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    name: { type: String, required: true },
    rating: { type: Number, required: true, min: 1, max: 5 },
    comment: { type: String },
  },
  { timestamps: true }
);

const productSchema = new mongoose.Schema(
  {
    name: { type: String, required: [true, 'Product name is required'], trim: true },
    description: { type: String, required: [true, 'Description is required'] },
    category: {
      type: String,
      required: [true, 'Category is required'],
      enum: ['Grocery', 'Pharmacy', 'Electronics', 'Food', 'Beverages', 'Household', 'Personal Care', 'Other'],
    },
    subcategory: { type: String, trim: true },
    price: { type: Number, required: [true, 'Price is required'], min: 0 },
    unit: {
      type: String,
      enum: ['piece', 'gram', 'kg', 'ml', 'liter', 'pack', 'box'],
      default: 'piece',
    },
    unitValue: { type: Number, default: 1, min: 0 },
    stock: { type: Number, required: [true, 'Stock is required'], min: 0, default: 0 },
    stockUnit: {
      type: String,
      enum: ['piece', 'gram', 'kg', 'ml', 'liter', 'pack', 'box'],
      default: 'piece',
    },
    images: [{ type: String }],
    vendor: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    vendorName: { type: String },
    isActive: { type: Boolean, default: true },
    isFeatured: { type: Boolean, default: false },
    tags: [{ type: String, trim: true }],
    offer: {
      discountPercent: { type: Number, min: 0, max: 100, default: 0 },
      offerPrice: { type: Number, min: 0 },
      validUntil: { type: Date },
    },
    rating: { type: Number, default: 0, min: 0, max: 5 },
    numReviews: { type: Number, default: 0 },
    reviews: [reviewSchema],
  },
  { timestamps: true }
);

// Index for search
productSchema.index({ name: 'text', description: 'text', tags: 'text' });
productSchema.index({ category: 1, isActive: 1 });
productSchema.index({ vendor: 1 });

// Calculate offer price before saving
productSchema.pre('save', function (next) {
  if (this.offer && this.offer.discountPercent > 0) {
    this.offer.offerPrice = parseFloat((this.price * (1 - this.offer.discountPercent / 100)).toFixed(2));
  }
  next();
});

module.exports = mongoose.model('Product', productSchema);

