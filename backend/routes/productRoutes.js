const express = require('express');
const router = express.Router();
const Product = require('../models/Product');

// ── Helper: format a Mongoose product doc into a clean API response ──────────
function formatProduct(p) {
  const front = p.frontImage || p.image || (Array.isArray(p.images) && p.images[0]) || 'images/Product 1.jpeg';
  const back  = p.backImage  || p.secondaryImage || (Array.isArray(p.images) && p.images[1]) || front;
  const side  = p.sideImage  || (Array.isArray(p.images) && p.images[2]) || front;
  const imgList = (Array.isArray(p.images) && p.images.length > 0) ? p.images : [front, back, side];

  // Resolve sizeStock — Mongoose Map → plain object
  const sizes = ['S', 'M', 'L', 'XL', 'XXL'];
  const sizeMap = { S: 0, M: 0, L: 0, XL: 0, XXL: 0 };

  // Source 1: sizeStock field (Map or plain object)
  if (p.sizeStock) {
    const raw = (p.sizeStock instanceof Map) ? Object.fromEntries(p.sizeStock) : p.sizeStock;
    sizes.forEach(s => { sizeMap[s] = Number(raw[s]) || 0; });
  }

  // Source 2: variants array (overrides if non-zero)
  if (Array.isArray(p.variants) && p.variants.length > 0) {
    p.variants.forEach(v => {
      if (v.size && sizeMap.hasOwnProperty(v.size.toUpperCase())) {
        sizeMap[v.size.toUpperCase()] = Number(v.stock) || 0;
      }
    });
  }

  const totalStock = Object.values(sizeMap).reduce((a, b) => a + b, 0);
  const availableSizes = sizes.filter(s => sizeMap[s] > 0);

  return {
    id: p._id,
    _id: p._id,
    name: p.title || p.name,
    title: p.title || p.name,
    slug: p.slug || '',
    price: p.price,
    originalPrice: p.originalPrice || 0,
    category: p.category,
    image: front,
    secondaryImage: back,
    frontImage: front,
    backImage: back,
    sideImage: side,
    images: imgList,
    colors: p.colors || [],
    sizes: availableSizes.length > 0 ? availableSizes : (p.sizes || []),
    stock: totalStock,
    sizeStock: sizeMap,       // ← always a plain object with S/M/L/XL/XXL keys
    variants: sizes.map(s => ({ size: s, stock: sizeMap[s] })),
    rating: p.ratingsAverage || p.rating || 4.8,
    ratingsAverage: p.ratingsAverage || p.rating || 4.8,
    reviewsCount: p.reviewsCount || p.ratingsCount || 0,
    ratingsCount: p.reviewsCount || p.ratingsCount || 0,
    description: p.description || '',
    isFeatured: p.isFeatured || false,
    isNewArrival: p.isNewArrival || false,
    bestSeller: p.bestSeller || false,
    sku: p.sku || '',
    createdAt: p.createdAt,
    updatedAt: p.updatedAt
  };
}

// ── Helper: build sizeStock + variants from incoming request body ─────────────
function parseSizeStockFromBody(body) {
  const sizes = ['S', 'M', 'L', 'XL', 'XXL'];
  const sizeMap = { S: 0, M: 0, L: 0, XL: 0, XXL: 0 };

  // From variants array
  if (Array.isArray(body.variants) && body.variants.length > 0) {
    body.variants.forEach(v => {
      if (v.size && sizeMap.hasOwnProperty(v.size.toUpperCase())) {
        sizeMap[v.size.toUpperCase()] = Number(v.stock) || 0;
      }
    });
  }

  // From sizeStock object
  if (body.sizeStock && typeof body.sizeStock === 'object' && !Array.isArray(body.sizeStock)) {
    sizes.forEach(s => {
      const val = Number(body.sizeStock[s]);
      if (!isNaN(val)) sizeMap[s] = val;
    });
  }

  const totalStock = Object.values(sizeMap).reduce((a, b) => a + b, 0);
  const syncedVariants = sizes.map(s => ({ size: s, color: 'Default', sku: '', stock: sizeMap[s] }));
  const availableSizes = sizes.filter(s => sizeMap[s] > 0);

  return { sizeMap, totalStock, syncedVariants, availableSizes };
}

const mongoose = require('mongoose');
const fs = require('fs');
const path = require('path');
const DATA_FILE = path.join(__dirname, '../data/products.json');

function loadLocalProducts() {
  try {
    if (fs.existsSync(DATA_FILE)) {
      const raw = fs.readFileSync(DATA_FILE, 'utf8');
      const list = JSON.parse(raw);
      if (Array.isArray(list) && list.length > 0) return list;
    }
  } catch (e) {
    console.error('Error reading products.json:', e.message);
  }
  return [...SEED_FALLBACK_PRODUCTS];
}

function saveLocalProducts(productsList) {
  try {
    fs.mkdirSync(path.dirname(DATA_FILE), { recursive: true });
    fs.writeFileSync(DATA_FILE, JSON.stringify(productsList, null, 2), 'utf8');
  } catch (e) {
    console.error('Error writing products.json:', e.message);
  }
}

const SEED_FALLBACK_PRODUCTS = [
  {
    _id: "64f1a2b3c4d5e6f7a8b9c0d1",
    id: "1",
    name: 'Royal Warrior Embroidered Tee',
    title: 'Royal Warrior Embroidered Tee',
    price: 999,
    originalPrice: 1499,
    category: 'Round Neck T-Shirts',
    image: 'images/Product 1.jpeg',
    secondaryImage: 'images/Product 2.jpeg',
    frontImage: 'images/Product 1.jpeg',
    backImage: 'images/Product 2.jpeg',
    sideImage: 'images/Product 3.jpeg',
    images: ['images/Product 1.jpeg', 'images/Product 2.jpeg', 'images/Product 3.jpeg'],
    colors: ['Black', 'Royal Blue'],
    sizes: ['S', 'M', 'L', 'XL', 'XXL'],
    stock: 30,
    sizeStock: { S: 0, M: 5, L: 15, XL: 10, XXL: 0 },
    variants: [
      { size: 'S', stock: 0 },
      { size: 'M', stock: 5 },
      { size: 'L', stock: 15 },
      { size: 'XL', stock: 10 },
      { size: 'XXL', stock: 0 }
    ],
    rating: 4.9,
    reviewsCount: 28,
    description: 'Royal warrior tee with gold Rajputana scriptures and premium 100% cotton fabric.',
    isFeatured: true,
    bestSeller: true
  },
  {
    _id: "64f1a2b3c4d5e6f7a8b9c0d2",
    id: "2",
    name: 'Imperial Heritage Polo Shirt',
    title: 'Imperial Heritage Polo Shirt',
    price: 1299,
    originalPrice: 1799,
    category: 'Collar T-Shirts',
    image: 'images/Product 2.jpeg',
    secondaryImage: 'images/Product 3.jpeg',
    frontImage: 'images/Product 2.jpeg',
    backImage: 'images/Product 3.jpeg',
    sideImage: 'images/Product 1.jpeg',
    images: ['images/Product 2.jpeg', 'images/Product 3.jpeg', 'images/Product 1.jpeg'],
    colors: ['Navy', 'Maroon'],
    sizes: ['S', 'M', 'L', 'XL'],
    stock: 25,
    sizeStock: { S: 2, M: 8, L: 15, XL: 0, XXL: 0 },
    variants: [
      { size: 'S', stock: 2 },
      { size: 'M', stock: 8 },
      { size: 'L', stock: 15 },
      { size: 'XL', stock: 0 },
      { size: 'XXL', stock: 0 }
    ],
    rating: 4.8,
    reviewsCount: 19,
    description: 'Classic polo shirt with royal crest logo and tailored fit.',
    isFeatured: true,
    isNewArrival: true
  },
  {
    _id: "64f1a2b3c4d5e6f7a8b9c0d3",
    id: "3",
    name: 'Rajputana Valor Heavyweight Hoodie',
    title: 'Rajputana Valor Heavyweight Hoodie',
    price: 1999,
    originalPrice: 2699,
    category: 'Hoodies',
    image: 'images/Product 3.jpeg',
    secondaryImage: 'images/Product 1.jpeg',
    frontImage: 'images/Product 3.jpeg',
    backImage: 'images/Product 1.jpeg',
    sideImage: 'images/Product 2.jpeg',
    images: ['images/Product 3.jpeg', 'images/Product 1.jpeg', 'images/Product 2.jpeg'],
    colors: ['Black', 'Dark Olive'],
    sizes: ['M', 'L', 'XL', 'XXL'],
    stock: 20,
    sizeStock: { S: 0, M: 0, L: 8, XL: 8, XXL: 4 },
    variants: [
      { size: 'S', stock: 0 },
      { size: 'M', stock: 0 },
      { size: 'L', stock: 8 },
      { size: 'XL', stock: 8 },
      { size: 'XXL', stock: 4 }
    ],
    rating: 5.0,
    reviewsCount: 34,
    description: 'Premium heavyweight cotton hoodie crafted for brave hearts.',
    isFeatured: true,
    bestSeller: true
  }
];

// @route   GET /api/v1/products
// @desc    Get all products (with category filter & search)
router.get('/', async (req, res) => {
  try {
    const { category, search, featured } = req.query;
    let productsList = [];

    if (mongoose.connection.readyState === 1) {
      try {
        const filter = {};
        if (category && category !== 'All') {
          filter.category = new RegExp(`^${category}$`, 'i');
        }
        if (featured === 'true') {
          filter.isFeatured = true;
        }
        if (search) {
          filter.$or = [
            { name: { $regex: search, $options: 'i' } },
            { description: { $regex: search, $options: 'i' } },
            { category: { $regex: search, $options: 'i' } }
          ];
        }
        const dbProducts = await Product.find(filter).sort({ createdAt: -1 });
        if (dbProducts && dbProducts.length > 0) {
          productsList = dbProducts.map(formatProduct);
        }
      } catch (dbErr) {
        console.warn('MongoDB query warning, using local file store:', dbErr.message);
      }
    }

    // If MongoDB is offline or returned empty, read from persistent products.json
    if (!productsList || productsList.length === 0) {
      let localList = loadLocalProducts();
      if (category && category !== 'All') {
        localList = localList.filter(p => (p.category?.name || p.category || '').toLowerCase() === category.toLowerCase());
      }
      if (featured === 'true') {
        localList = localList.filter(p => p.isFeatured);
      }
      if (search) {
        const s = search.toLowerCase();
        localList = localList.filter(p => (p.name || '').toLowerCase().includes(s) || (p.description || '').toLowerCase().includes(s) || (p.category || '').toLowerCase().includes(s));
      }
      productsList = localList.map(formatProduct);
    }

    res.json({
      success: true,
      count: productsList.length,
      data: productsList,
      products: productsList
    });
  } catch (error) {
    const local = loadLocalProducts().map(formatProduct);
    res.json({
      success: true,
      count: local.length,
      data: local,
      products: local
    });
  }
});

// @route   GET /api/v1/products/:id
// @desc    Get single product by ID or slug
router.get('/:id', async (req, res) => {
  try {
    const idParam = req.params.id;

    if (mongoose.connection.readyState === 1) {
      try {
        let product = null;
        if (mongoose.Types.ObjectId.isValid(idParam)) {
          product = await Product.findById(idParam);
        } else {
          product = await Product.findOne({
            $or: [
              { slug: idParam },
              { name: new RegExp(`^${idParam}$`, 'i') }
            ]
          });
        }
        if (product) {
          const formatted = formatProduct(product);
          return res.json({ success: true, data: { product: formatted, ...formatted } });
        }
      } catch (e) {}
    }

    // Fallback: lookup in persistent products.json
    const allLocal = loadLocalProducts();
    const match = allLocal.find(p => String(p.id) === String(idParam) || String(p._id) === String(idParam) || (p.slug && p.slug.toLowerCase() === idParam.toLowerCase()) || (p.name && p.name.toLowerCase() === idParam.toLowerCase()));

    if (match) {
      const formatted = formatProduct(match);
      return res.json({ success: true, data: { product: formatted, ...formatted } });
    }

    res.status(404).json({ success: false, message: 'Product not found' });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

// @route   POST /api/v1/products
// @desc    Add a new product (persisted in local file & MongoDB)
router.post('/', async (req, res) => {
  try {
    const body = { ...req.body };

    // Resolve images
    const front = body.frontImage || body.image || 'images/Product 1.jpeg';
    const back  = body.backImage  || body.secondaryImage || front;
    const side  = body.sideImage  || front;
    body.image = front;
    body.secondaryImage = back;
    body.frontImage = front;
    body.backImage = back;
    body.sideImage = side;
    body.images = (Array.isArray(body.images) && body.images.length > 0) ? body.images : [front, back, side];

    // Resolve name (support "title" or "name")
    if (!body.name && body.title) body.name = body.title;
    if (!body.title && body.name) body.title = body.name;

    // Resolve sizeStock & variants
    const { sizeMap, totalStock, syncedVariants, availableSizes } = parseSizeStockFromBody(body);
    body.sizeStock = sizeMap;
    body.stock = totalStock;
    body.variants = syncedVariants;
    body.sizes = availableSizes;

    let savedProduct = null;

    if (mongoose.connection.readyState === 1) {
      try {
        const dbProduct = await Product.create(body);
        if (dbProduct) savedProduct = formatProduct(dbProduct);
      } catch (dbErr) {
        console.warn('Could not save to MongoDB Atlas, saving to persistent file:', dbErr.message);
      }
    }

    if (!savedProduct) {
      const generatedId = new mongoose.Types.ObjectId().toString();
      const localObj = {
        _id: generatedId,
        id: generatedId,
        ...body,
        ratingsAverage: 4.8,
        ratingsCount: 0,
        reviewsCount: 0,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString()
      };
      savedProduct = formatProduct(localObj);
    }

    // Always persist to local products.json file
    const allLocal = loadLocalProducts();
    const existingIndex = allLocal.findIndex(p => String(p._id) === String(savedProduct._id) || String(p.id) === String(savedProduct.id));
    if (existingIndex > -1) {
      allLocal[existingIndex] = savedProduct;
    } else {
      allLocal.unshift(savedProduct);
    }
    saveLocalProducts(allLocal);

    res.status(201).json({
      success: true,
      message: 'Product created successfully',
      data: { product: savedProduct, ...savedProduct }
    });
  } catch (error) {
    console.error('Error in POST /products:', error);
    res.status(400).json({ success: false, message: error.message });
  }
});

// @route   PUT /api/v1/products/:id
// @desc    Update product (including stock per size)
router.put('/:id', async (req, res) => {
  try {
    const idParam = req.params.id;
    const body = { ...req.body };

    // Resolve images if provided
    if (body.frontImage || body.image) {
      const front = body.frontImage || body.image;
      const back  = body.backImage  || body.secondaryImage || front;
      const side  = body.sideImage  || front;
      body.image = front;
      body.secondaryImage = back;
      body.frontImage = front;
      body.backImage = back;
      body.sideImage = side;
      body.images = [front, back, side];
    }

    // Resolve name
    if (!body.name && body.title) body.name = body.title;
    if (!body.title && body.name) body.title = body.name;

    // Resolve sizeStock & variants if stock data is provided
    const hasStockData = body.variants || body.sizeStock;
    if (hasStockData) {
      const { sizeMap, totalStock, syncedVariants, availableSizes } = parseSizeStockFromBody(body);
      body.sizeStock = sizeMap;
      body.stock = totalStock;
      body.variants = syncedVariants;
      body.sizes = availableSizes;
    }

    let updatedProduct = null;

    if (mongoose.connection.readyState === 1 && mongoose.Types.ObjectId.isValid(idParam)) {
      try {
        const dbProduct = await Product.findByIdAndUpdate(idParam, body, {
          new: true,
          runValidators: true
        });
        if (dbProduct) updatedProduct = formatProduct(dbProduct);
      } catch (dbErr) {
        console.warn('MongoDB Atlas update notice:', dbErr.message);
      }
    }

    // Always update in persistent products.json
    const allLocal = loadLocalProducts();
    const idx = allLocal.findIndex(p => String(p._id) === String(idParam) || String(p.id) === String(idParam));
    if (idx > -1) {
      allLocal[idx] = formatProduct({ ...allLocal[idx], ...body, updatedAt: new Date().toISOString() });
      if (!updatedProduct) updatedProduct = allLocal[idx];
      saveLocalProducts(allLocal);
    } else if (updatedProduct) {
      allLocal.unshift(updatedProduct);
      saveLocalProducts(allLocal);
    }

    if (!updatedProduct) {
      return res.status(404).json({ success: false, message: 'Product not found' });
    }

    res.json({
      success: true,
      message: 'Product updated successfully',
      data: { product: updatedProduct, ...updatedProduct }
    });
  } catch (error) {
    res.status(400).json({ success: false, message: error.message });
  }
});

// @route   DELETE /api/v1/products/:id
// @desc    Delete product
router.delete('/:id', async (req, res) => {
  try {
    const idParam = req.params.id;

    if (mongoose.connection.readyState === 1 && mongoose.Types.ObjectId.isValid(idParam)) {
      try {
        await Product.findByIdAndDelete(idParam);
      } catch (e) {}
    }

    // Always delete from persistent products.json
    const allLocal = loadLocalProducts();
    const updated = allLocal.filter(p => String(p._id) !== String(idParam) && String(p.id) !== String(idParam));
    saveLocalProducts(updated);

    res.json({ success: true, message: 'Product deleted successfully' });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

module.exports = router;
