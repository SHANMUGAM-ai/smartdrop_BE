const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');

const userSchema = new mongoose.Schema(
  {
    name: { type: String, required: [true, 'Name is required'], trim: true },
    email: {
      type: String,
      required: [true, 'Email is required'],
      unique: true,
      lowercase: true,
      match: [/^\S+@\S+\.\S+$/, 'Please enter a valid email'],
    },
    phone: { type: String, trim: true },
    password: { type: String, required: [true, 'Password is required'], minlength: 6, select: false },
    role: { type: String, enum: ['user', 'partner', 'admin', 'superadmin'], default: 'user' },
    isBlocked: { type: Boolean, default: false },
    // Partner specific
    partnerStatus: { type: String, enum: ['Pending', 'Approved', 'Rejected'], default: 'Approved' },
    zone: { type: String },
    serviceType: { type: String, enum: ['Single Product', 'Multi Product', 'House Shift'] },
    vehicle: { type: String, enum: ['Bike', 'Auto', 'Van', 'Truck', 'Lorry'] },
    vehicleNumber: { type: String },
    licenseNumber: { type: String },
    rcBookNumber: { type: String },
    personPhotoUrl: { type: String },
    partnerReviewedAt: { type: Date },
    partnerReviewedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
    partnerReviewNotes: { type: String, trim: true, maxlength: 500 },
    isOnline: { type: Boolean, default: false },
    isAvailable: { type: Boolean, default: true },
    totalEarnings: { type: Number, default: 0 },
    totalOrders: { type: Number, default: 0 },
    rating: { type: Number, default: 4.5 },
  },
  { timestamps: true }
);

// Hash password before saving
userSchema.pre('save', async function (next) {
  if (!this.isModified('password')) return next();
  const salt = await bcrypt.genSalt(10);
  this.password = await bcrypt.hash(this.password, salt);
  next();
});

// Compare passwords
userSchema.methods.matchPassword = async function (enteredPassword) {
  return await bcrypt.compare(enteredPassword, this.password);
};

module.exports = mongoose.model('User', userSchema);
