// ====================================================
// ONE-TIME MIGRATION: Sync sizeStock from variants for all existing products
// Run once: node scripts/migrateStockSync.js
// ====================================================

const mongoose = require('mongoose');
require('dotenv').config();

const productSchema = new mongoose.Schema({
  name: String,
  title: String,
  price: Number,
  category: String,
  image: String,
  stock: Number,
  sizeStock: { type: Map, of: Number },
  variants: [{
    size: String,
    color: String,
    sku: String,
    stock: Number
  }],
  sizes: [String]
}, { strict: false, timestamps: true });

const Product = mongoose.model('Product', productSchema);

async function migrate() {
  const MONGO_URI = process.env.MONGODB_URI || process.env.MONGO_URI || 'mongodb://localhost:27017/beard-banna';
  await mongoose.connect(MONGO_URI);
  console.log('Connected to MongoDB');

  const sizes = ['S', 'M', 'L', 'XL', 'XXL'];
  const products = await Product.find({});
  console.log(`Found ${products.length} products to check`);

  let updated = 0;

  for (const p of products) {
    const sizeMap = { S: 0, M: 0, L: 0, XL: 0, XXL: 0 };

    // Source 1: existing sizeStock map
    if (p.sizeStock) {
      const raw = (p.sizeStock instanceof Map) ? Object.fromEntries(p.sizeStock) : p.sizeStock;
      sizes.forEach(s => { sizeMap[s] = Number(raw[s]) || 0; });
    }

    // Source 2: variants (may have real stock)
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
      {
        $set: {
          sizeStock: sizeMap,
          stock: totalStock,
          variants: syncedVariants,
          sizes: availableSizes
        }
      }
    );
    console.log(`  ✓ ${p.name || p.title}: L=${sizeMap['L']}, total=${totalStock}`);
    updated++;
  }

  console.log(`\n✅ Migration complete: ${updated} products synced`);
  await mongoose.disconnect();
}

migrate().catch(err => {
  console.error('Migration failed:', err);
  process.exit(1);
});
