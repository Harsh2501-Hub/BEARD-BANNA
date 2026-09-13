// ===============================
// PRODUCTS CATALOG - BACKEND & LOCAL SYNCED
// Real-time stock from MongoDB via API
// ===============================

const DEFAULT_CATALOG = [
  {
    id: "1",
    _id: "1",
    name: "Royal Warrior Embroidered Tee",
    title: "Royal Warrior Embroidered Tee",
    price: 999,
    originalPrice: 1499,
    category: "Round Neck T-Shirts",
    stock: 25,
    sizeStock: { S: 0, M: 5, L: 15, XL: 5, XXL: 0 },
    image: "images/Product 1.jpeg",
    secondaryImage: "images/Product 2.jpeg",
    frontImage: "images/Product 1.jpeg",
    backImage: "images/Product 2.jpeg",
    sideImage: "images/Product 3.jpeg",
    images: ["images/Product 1.jpeg", "images/Product 2.jpeg", "images/Product 3.jpeg"],
    description: "Royal warrior tee with gold Rajputana scriptures and premium 100% cotton fabric.",
    sizes: ["M", "L", "XL"],
    rating: 4.9,
    ratingsAverage: 4.9,
    reviewsCount: 28,
    ratingsCount: 28,
    isFeatured: true,
    bestSeller: true
  },
  {
    id: "2",
    _id: "2",
    name: "Imperial Heritage Polo Shirt",
    title: "Imperial Heritage Polo Shirt",
    price: 1299,
    originalPrice: 1799,
    category: "Collar T-Shirts",
    stock: 18,
    sizeStock: { S: 2, M: 8, L: 8, XL: 0, XXL: 0 },
    image: "images/Product 2.jpeg",
    secondaryImage: "images/Product 3.jpeg",
    frontImage: "images/Product 2.jpeg",
    backImage: "images/Product 3.jpeg",
    sideImage: "images/Product 1.jpeg",
    images: ["images/Product 2.jpeg", "images/Product 3.jpeg", "images/Product 1.jpeg"],
    description: "Classic polo shirt with royal crest logo and tailored fit.",
    sizes: ["S", "M", "L"],
    rating: 4.8,
    ratingsAverage: 4.8,
    reviewsCount: 19,
    ratingsCount: 19,
    isFeatured: true,
    isNewArrival: true
  },
  {
    id: "3",
    _id: "3",
    name: "Rajputana Valor Heavyweight Hoodie",
    title: "Rajputana Valor Heavyweight Hoodie",
    price: 1999,
    originalPrice: 2699,
    category: "Hoodies",
    stock: 12,
    sizeStock: { S: 0, M: 0, L: 5, XL: 5, XXL: 2 },
    image: "images/Product 3.jpeg",
    secondaryImage: "images/Product 1.jpeg",
    frontImage: "images/Product 3.jpeg",
    backImage: "images/Product 1.jpeg",
    sideImage: "images/Product 2.jpeg",
    images: ["images/Product 3.jpeg", "images/Product 1.jpeg", "images/Product 2.jpeg"],
    description: "Premium cotton hoodie crafted for brave hearts.",
    sizes: ["L", "XL", "XXL"],
    rating: 5.0,
    ratingsAverage: 5.0,
    reviewsCount: 34,
    ratingsCount: 34,
    isFeatured: true,
    bestSeller: true
  }
];

let products = (function() {
  try {
    const cached = JSON.parse(localStorage.getItem('products') || '[]');
    if (cached && cached.length > 0) return cached;
  } catch(e) {}
  return [...DEFAULT_CATALOG];
})();

// Helper: map a raw API product to our standard catalog object
function mapApiProduct(p) {
  const sizes = ['S', 'M', 'L', 'XL', 'XXL'];

  // --- Resolve sizeStock ---
  // The API now always returns sizeStock as { S:0, M:0, L:37, XL:0, XXL:0 }
  const sizeMap = { S: 0, M: 0, L: 0, XL: 0, XXL: 0 };

  if (p.sizeStock && typeof p.sizeStock === 'object' && !Array.isArray(p.sizeStock)) {
    sizes.forEach(s => {
      const val = Number(p.sizeStock[s]);
      sizeMap[s] = isNaN(val) ? 0 : val;
    });
  }

  // Also cross-check variants in case sizeStock is still all zeros
  if (Array.isArray(p.variants) && p.variants.length > 0) {
    p.variants.forEach(v => {
      if (v.size && sizeMap.hasOwnProperty(v.size.toUpperCase())) {
        const existing = sizeMap[v.size.toUpperCase()];
        const fromVariant = Number(v.stock) || 0;
        // Use variant value if sizeMap is 0 and variant has stock
        if (existing === 0 && fromVariant > 0) {
          sizeMap[v.size.toUpperCase()] = fromVariant;
        }
      }
    });
  }

  const totalStock = p.stock !== undefined
    ? Number(p.stock)
    : Object.values(sizeMap).reduce((a, b) => a + b, 0);

  const availableSizes = sizes.filter(s => sizeMap[s] > 0);

  const front = p.frontImage || p.image || (Array.isArray(p.images) && p.images[0]) || 'images/Product 1.jpeg';
  const back  = p.backImage  || p.secondaryImage || (Array.isArray(p.images) && p.images[1]) || front;
  const side  = p.sideImage  || (Array.isArray(p.images) && p.images[2]) || front;

  return {
    id: String(p._id || p.id),
    _id: String(p._id || p.id),
    name: p.title || p.name || 'Product',
    title: p.title || p.name || 'Product',
    price: Number(p.price) || 0,
    originalPrice: Number(p.originalPrice) || 0,
    category: (p.category && p.category.name) ? p.category.name : (p.category || 'T-Shirts'),
    image: front,
    secondaryImage: back,
    frontImage: front,
    backImage: back,
    sideImage: side,
    images: [front, back, side],
    description: p.description || '',
    sizes: availableSizes.length > 0 ? availableSizes : sizes,
    stock: totalStock,
    sizeStock: sizeMap,       // ← ALWAYS present with all size keys
    rating: p.ratingsAverage || p.rating || 4.8,
    ratingsAverage: p.ratingsAverage || p.rating || 4.8,
    reviewsCount: p.reviewsCount || p.ratingsCount || 0,
    isFeatured: p.isFeatured || false,
    isNewArrival: p.isNewArrival || false,
    bestSeller: p.bestSeller || false,
    sku: p.sku || '',
    slug: p.slug || ''
  };
}

async function fetchProductsFromAPI() {
  try {
    const res = await API.get('/products');

    // Handle both res.data.products and res.data (flat array)
    let apiList = null;
    if (res.success) {
      if (Array.isArray(res.data)) {
        apiList = res.data;
      } else if (res.data && Array.isArray(res.data.products)) {
        apiList = res.data.products;
      } else if (Array.isArray(res.products)) {
        apiList = res.products;
      }
    }

    if (apiList && apiList.length > 0) {
      // Replace products entirely with fresh API data (real-time)
      products = apiList.map(mapApiProduct);
      // Cache in localStorage for offline fallback only
      try { localStorage.setItem('products', JSON.stringify(products)); } catch(e) {}
    } else {
      // Fallback to localStorage cache
      const cached = JSON.parse(localStorage.getItem('products') || '[]');
      if (cached.length > 0) products = cached.map(mapApiProduct);
    }
  } catch (err) {
    console.warn('API unreachable, using localStorage cache:', err.message);
    const cached = JSON.parse(localStorage.getItem('products') || '[]');
    if (cached.length > 0) products = cached.map(mapApiProduct);
  }

  return products;
}

window.fetchProductsFromAPI = fetchProductsFromAPI;
window.mapApiProduct = mapApiProduct;