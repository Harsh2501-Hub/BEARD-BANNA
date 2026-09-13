const express = require('express');
const cors = require('cors');
const mongoose = require('mongoose');
require('dotenv').config();

const dns = require('dns');
try { dns.setServers(['8.8.8.8', '8.8.4.4']); } catch (e) {}

const app = express();
const PORT = process.env.PORT || 5000;

// Import Models
const Product = require('./models/Product');
const User = require('./models/User');

// Import Routes
const authRoutes = require('./routes/authRoutes');
const productRoutes = require('./routes/productRoutes');
const orderRoutes = require('./routes/orderRoutes');
const reviewRoutes = require('./routes/reviewRoutes');
const inquiryRoutes = require('./routes/inquiryRoutes');
const paymentRoutes = require('./routes/paymentRoutes');

// Middleware
app.use(cors());
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

// Health Check Route
app.get('/api/v1/health', (req, res) => {
  res.status(200).json({
    success: true,
    message: 'BEARD BANNA Backend REST API is running smoothly 🚀',
    timestamp: new Date().toISOString()
  });
});

// API Routes
app.use('/api/v1/auth', authRoutes);
app.use('/api/v1/products', productRoutes);
app.use('/api/v1/orders', orderRoutes);
app.use('/api/v1/reviews', reviewRoutes);
app.use('/api/v1/inquiries', inquiryRoutes);
app.use('/api/v1/payment', paymentRoutes);

// Seed Default Products with 3 Multi-Angle Images (Front, Back, Side)
const seedInitialData = async () => {
  try {
    const productCount = await Product.countDocuments();
    if (productCount === 0) {
      console.log('🌱 Seeding initial 3-angle products into MongoDB Atlas...');
      await Product.insertMany([
        {
          name: 'Royal Warrior Embroidered Tee',
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
          rating: 4.9,
          reviewsCount: 28,
          description: 'Royal warrior tee with gold Rajputana scriptures and premium 100% cotton fabric.',
          isFeatured: true,
          bestSeller: true
        },
        {
          name: 'Imperial Heritage Polo Shirt',
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
          rating: 4.8,
          reviewsCount: 19,
          description: 'Classic polo shirt with royal crest logo and tailored fit.',
          isFeatured: true,
          isNewArrival: true
        },
        {
          name: 'Rajputana Valor Heavyweight Hoodie',
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
          rating: 5.0,
          reviewsCount: 34,
          description: 'Premium heavyweight cotton hoodie crafted for brave hearts.',
          isFeatured: true,
          bestSeller: true
        }
      ]);
      console.log('✅ Initial 3-angle products seeded successfully into MongoDB!');
    }
  } catch (err) {
    console.error('⚠️ Initial seeding error:', err.message);
  }
};

// ── ONE-TIME MIGRATION: Sync sizeStock from variants for all existing products ──
const migrateStockSync = async () => {
  try {
    const allProducts = await Product.find({});
    const sizes = ['S', 'M', 'L', 'XL', 'XXL'];
    let migrated = 0;

    for (const p of allProducts) {
      const sizeMap = { S: 0, M: 0, L: 0, XL: 0, XXL: 0 };

      // Read from existing sizeStock map
      if (p.sizeStock) {
        const raw = (p.sizeStock instanceof Map) ? Object.fromEntries(p.sizeStock) : p.sizeStock;
        sizes.forEach(s => { sizeMap[s] = Number(raw[s]) || 0; });
      }

      // Read from variants array (has real per-size stock)
      if (Array.isArray(p.variants) && p.variants.length > 0) {
        p.variants.forEach(v => {
          if (v.size && sizeMap.hasOwnProperty(v.size.toUpperCase())) {
            const vStock = Number(v.stock) || 0;
            if (vStock > 0) sizeMap[v.size.toUpperCase()] = vStock;
          }
        });
      }

      const totalStock = Object.values(sizeMap).reduce((a, b) => a + b, 0);
      const availableSizes = sizes.filter(s => sizeMap[s] > 0);
      const syncedVariants = sizes.map(s => ({ size: s, color: 'Default', sku: '', stock: sizeMap[s] }));

      await Product.updateOne(
        { _id: p._id },
        { $set: { sizeStock: sizeMap, stock: totalStock, variants: syncedVariants, sizes: availableSizes } }
      );
      migrated++;
    }
    if (migrated > 0) console.log(`✅ Stock sync migration complete: ${migrated} products updated`);
  } catch (err) {
    console.warn('⚠️ Stock sync migration error:', err.message);
  }
};

// Admin-only migration trigger endpoint
app.post('/api/v1/admin/migrate-stock', async (req, res) => {
  try {
    await migrateStockSync();
    res.json({ success: true, message: 'Stock sync migration complete' });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

// Database Connection
const MONGODB_URI = process.env.MONGODB_URI || 'mongodb://127.0.0.1:27017/beardbanna';
mongoose.connect(MONGODB_URI)
  .then(async () => {
    console.log('✅ Connected to MongoDB Atlas Database');
    await seedInitialData();
    await migrateStockSync(); // Auto-migrate stock on every startup
  })
  .catch(err => console.error('❌ MongoDB Connection Error:', err.message));

// Start Server
app.listen(PORT, () => {
  console.log(`👑 BEARD BANNA Server running on port ${PORT}`);
});

