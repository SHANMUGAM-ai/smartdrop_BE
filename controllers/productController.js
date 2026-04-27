const Product = require('../models/Product');

// @desc    Create a new product
// @route   POST /api/products
// @access  Vendor / Admin
exports.createProduct = async (req, res) => {
  try {
    const {
      name,
      description,
      category,
      subcategory,
      price,
      unit,
      unitValue,
      stock,
      stockUnit,
      images,
      tags,
      offer,
    } = req.body;

    if (!name || !description || !category || price == null || stock == null) {
      return res.status(400).json({ success: false, message: 'Name, description, category, price, and stock are required.' });
    }

    const product = await Product.create({
      name,
      description,
      category,
      subcategory,
      price,
      unit: unit || 'piece',
      unitValue: unitValue || 1,
      stock,
      stockUnit: stockUnit || 'piece',
      images: images || [],
      vendor: req.user._id,
      vendorName: req.user.name,
      tags: tags || [],
      offer: offer || { discountPercent: 0 },
    });

    res.status(201).json({ success: true, product });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

// @desc    Get all products (with search, filter, pagination)
// @route   GET /api/products
// @access  Public
exports.getProducts = async (req, res) => {
  try {
    const {
      keyword,
      category,
      minPrice,
      maxPrice,
      vendor,
      isFeatured,
      page = 1,
      limit = 20,
      sortBy = 'createdAt',
      order = 'desc',
    } = req.query;

    const query = { isActive: true };

    if (keyword) {
      query.$or = [
        { name: { $regex: keyword, $options: 'i' } },
        { description: { $regex: keyword, $options: 'i' } },
        { tags: { $in: [new RegExp(keyword, 'i')] } },
      ];
    }

    if (category) query.category = category;
    if (vendor) query.vendor = vendor;
    if (isFeatured === 'true') query.isFeatured = true;

    if (minPrice != null || maxPrice != null) {
      query.price = {};
      if (minPrice != null) query.price.$gte = Number(minPrice);
      if (maxPrice != null) query.price.$lte = Number(maxPrice);
    }

    const sortOption = {};
    sortOption[sortBy] = order === 'asc' ? 1 : -1;

    const skip = (Number(page) - 1) * Number(limit);

    const products = await Product.find(query)
      .populate('vendor', 'name phone zone')
      .sort(sortOption)
      .skip(skip)
      .limit(Number(limit));

    const total = await Product.countDocuments(query);

    res.json({
      success: true,
      count: products.length,
      total,
      page: Number(page),
      pages: Math.ceil(total / Number(limit)),
      products,
    });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

// @desc    Get single product by ID
// @route   GET /api/products/:id
// @access  Public
exports.getProductById = async (req, res) => {
  try {
    const product = await Product.findById(req.params.id).populate('vendor', 'name phone zone rating');
    if (!product) {
      return res.status(404).json({ success: false, message: 'Product not found.' });
    }
    res.json({ success: true, product });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

// @desc    Update product
// @route   PUT /api/products/:id
// @access  Vendor (owner) / Admin
exports.updateProduct = async (req, res) => {
  try {
    let product = await Product.findById(req.params.id);
    if (!product) {
      return res.status(404).json({ success: false, message: 'Product not found.' });
    }

    // Only vendor owner or admin can update
    if (
      product.vendor.toString() !== req.user._id.toString() &&
      !['admin', 'superadmin'].includes(req.user.role)
    ) {
      return res.status(403).json({ success: false, message: 'Not authorized to update this product.' });
    }

    const updates = { ...req.body };
    delete updates.vendor; // prevent changing vendor
    delete updates.reviews; // prevent direct review manipulation

    product = await Product.findByIdAndUpdate(req.params.id, updates, { new: true, runValidators: true });
    res.json({ success: true, product });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

// @desc    Delete product
// @route   DELETE /api/products/:id
// @access  Vendor (owner) / Admin
exports.deleteProduct = async (req, res) => {
  try {
    const product = await Product.findById(req.params.id);
    if (!product) {
      return res.status(404).json({ success: false, message: 'Product not found.' });
    }

    if (
      product.vendor.toString() !== req.user._id.toString() &&
      !['admin', 'superadmin'].includes(req.user.role)
    ) {
      return res.status(403).json({ success: false, message: 'Not authorized to delete this product.' });
    }

    await Product.findByIdAndDelete(req.params.id);
    res.json({ success: true, message: 'Product deleted successfully.' });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

// @desc    Get products for logged-in vendor
// @route   GET /api/products/my/products
// @access  Vendor / Admin
exports.getMyProducts = async (req, res) => {
  try {
    const products = await Product.find({ vendor: req.user._id }).sort({ createdAt: -1 });
    res.json({ success: true, count: products.length, products });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

// @desc    Add product review
// @route   POST /api/products/:id/reviews
// @access  Private (User)
exports.addReview = async (req, res) => {
  try {
    const { rating, comment } = req.body;
    if (!rating || rating < 1 || rating > 5) {
      return res.status(400).json({ success: false, message: 'Rating between 1 and 5 is required.' });
    }

    const product = await Product.findById(req.params.id);
    if (!product) {
      return res.status(404).json({ success: false, message: 'Product not found.' });
    }

    // Check if user already reviewed
    const alreadyReviewed = product.reviews.find(
      (r) => r.user.toString() === req.user._id.toString()
    );
    if (alreadyReviewed) {
      return res.status(400).json({ success: false, message: 'You have already reviewed this product.' });
    }

    product.reviews.push({
      user: req.user._id,
      name: req.user.name,
      rating: Number(rating),
      comment: comment || '',
    });

    product.numReviews = product.reviews.length;
    product.rating = product.reviews.reduce((acc, item) => item.rating + acc, 0) / product.reviews.length;

    await product.save();
    res.status(201).json({ success: true, message: 'Review added.', product });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

