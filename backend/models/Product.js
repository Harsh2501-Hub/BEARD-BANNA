const mongoose = require('mongoose');

// Per-size variant sub-schema
const variantSchema = new mongoose.Schema({
  size: { type: String, uppercase: true, trim: true },
  color: { type: String, default: 'Default' },
  sku: { type: String, default: '' },
  stock: { type: Number, default: 0, min: 0 }
}, { _id: false });

const productSchema = new mongoose.Schema({
  name: {
    type: String,
    required: [true, 'Product name is required'],
    trim: true
  },
  title: {
    type: String,
    trim: true,
    default: ''
  },
  slug: {
    type: String,
    trim: true,
    default: ''
  },
  price: {
    type: Number,
    required: [true, 'Price is required'],
    min: 0
  },
  originalPrice: {
    type: Number,
    default: 0
  },
  category: {
    type: String,
    required: [true, 'Category is required'],
    trim: true
  },
  image: {
    type: String,
    required: [true, 'Primary (Front) image URL is required']
  },
  secondaryImage: { type: String, default: '' },
  frontImage: { type: String, default: '' },
  backImage: { type: String, default: '' },
  sideImage: { type: String, default: '' },
  images: [{ type: String }],
  colors: [{ type: String }],
  sizes: [{ type: String }],

  // Total stock (sum of all size variants)
  stock: {
    type: Number,
    default: 0,
    min: 0
  },

  // Per-size stock map: { S: 5, M: 10, L: 37, XL: 0, XXL: 0 }
  sizeStock: {
    type: Map,
    of: Number,
    default: () => ({ S: 0, M: 0, L: 0, XL: 0, XXL: 0 })
  },

  // Detailed variant records (size + color + sku)
  variants: [variantSchema],

  rating: {
    type: Number,
    default: 4.8,
    min: 0,
    max: 5
  },
  ratingsAverage: {
    type: Number,
    default: 4.8
  },
  reviewsCount: {
    type: Number,
    default: 0
  },
  ratingsCount: {
    type: Number,
    default: 0
  },
  description: {
    type: String,
    default: ''
  },
  isFeatured: { type: Boolean, default: false },
  isNewArrival: { type: Boolean, default: false },
  bestSeller: { type: Boolean, default: false },
  sku: { type: String, default: '' }
}, {
  timestamps: true
});

// Pre-save hook: auto-sync sizeStock ↔ variants ↔ stock
productSchema.pre('save', function (next) {
  syncStockFields(this);
  next();
});

productSchema.pre('findOneAndUpdate', function (next) {
  const update = this.getUpdate();
  if (update) syncStockFieldsOnUpdate(update);
  next();
});

function syncStockFields(doc) {
  const sizes = ['S', 'M', 'L', 'XL', 'XXL'];
  const sizeMap = {};

  // Priority 1: read from variants array
  if (Array.isArray(doc.variants) && doc.variants.length > 0) {
    doc.variants.forEach(v => {
      if (v.size) sizeMap[v.size.toUpperCase()] = Number(v.stock) || 0;
    });
  }

  // Priority 2: read from sizeStock map (if variants missing)
  if (Object.keys(sizeMap).length === 0 && doc.sizeStock) {
    const sm = doc.sizeStock instanceof Map ? Object.fromEntries(doc.sizeStock) : doc.sizeStock;
    sizes.forEach(s => {
      sizeMap[s] = Number(sm[s]) || 0;
    });
  }

  // Ensure all sizes exist in map
  sizes.forEach(s => { if (sizeMap[s] === undefined) sizeMap[s] = 0; });

  // Write back
  doc.sizeStock = sizeMap;
  doc.stock = Object.values(sizeMap).reduce((a, b) => a + b, 0);

  // Sync variants array with the map
  doc.variants = sizes.map(s => ({
    size: s,
    color: 'Default',
    sku: '',
    stock: sizeMap[s]
  }));

  // Available sizes list
  doc.sizes = sizes.filter(s => sizeMap[s] > 0);
}

function syncStockFieldsOnUpdate(update) {
  const body = update.$set || update;
  const sizes = ['S', 'M', 'L', 'XL', 'XXL'];
  const sizeMap = {};

  if (Array.isArray(body.variants) && body.variants.length > 0) {
    body.variants.forEach(v => {
      if (v.size) sizeMap[v.size.toUpperCase()] = Number(v.stock) || 0;
    });
  } else if (body.sizeStock) {
    const sm = body.sizeStock instanceof Map ? Object.fromEntries(body.sizeStock) : body.sizeStock;
    sizes.forEach(s => { sizeMap[s] = Number(sm[s]) || 0; });
  }

  if (Object.keys(sizeMap).length === 0) return;

  sizes.forEach(s => { if (sizeMap[s] === undefined) sizeMap[s] = 0; });

  const totalStock = Object.values(sizeMap).reduce((a, b) => a + b, 0);
  const availableSizes = sizes.filter(s => sizeMap[s] > 0);
  const syncedVariants = sizes.map(s => ({ size: s, color: 'Default', sku: '', stock: sizeMap[s] }));

  if (update.$set) {
    update.$set.sizeStock = sizeMap;
    update.$set.stock = totalStock;
    update.$set.variants = syncedVariants;
    update.$set.sizes = availableSizes;
  } else {
    update.sizeStock = sizeMap;
    update.stock = totalStock;
    update.variants = syncedVariants;
    update.sizes = availableSizes;
  }
}

module.exports = mongoose.model('Product', productSchema);
