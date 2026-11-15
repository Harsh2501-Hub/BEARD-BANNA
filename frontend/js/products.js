// ==============================================================================
// BEARD BANNA — PRODUCTS CATALOG (CENTRAL SUPABASE DATABASE)
// Single Source of Truth for Storefront, Collection, and Product Details
// ==============================================================================

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
    is_active: true,
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
    is_active: true,
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
    is_active: true,
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

// Helper: map a raw Supabase database row to the catalog object
function mapSupabaseProduct(p) {
  const sizes = ['S', 'M', 'L', 'XL', 'XXL'];
  const sizeMap = { S: 0, M: 0, L: 0, XL: 0, XXL: 0 };

  const rawSizeStock = (p.size_stock || p.sizeStock);
  if (rawSizeStock && typeof rawSizeStock === 'object') {
    sizes.forEach(s => {
      const val = Number(rawSizeStock[s]);
      sizeMap[s] = isNaN(val) ? 0 : val;
    });
  }

  const totalStock = p.stock !== undefined
    ? Number(p.stock)
    : Object.values(sizeMap).reduce((a, b) => a + b, 0);

  const availableSizes = sizes.filter(s => sizeMap[s] > 0);

  const imagesArr = Array.isArray(p.images) ? p.images : (
    (typeof p.images === 'string' && p.images.startsWith('[')) ? JSON.parse(p.images) : []
  );

  const front = p.image || p.frontImage || (imagesArr.length > 0 ? imagesArr[0] : 'images/Product 1.jpeg');
  const back = p.secondary_image || p.backImage || (imagesArr.length > 1 ? imagesArr[1] : front);
  const side = p.sideImage || (imagesArr.length > 2 ? imagesArr[2] : front);

  return {
    id: String(p.id || p._id),
    _id: String(p.id || p._id),
    name: p.name || p.title || 'Product',
    title: p.title || p.name || 'Product',
    price: Number(p.price) || 0,
    originalPrice: Number(p.original_price || p.originalPrice || 0),
    category: p.category || 'T-Shirts',
    image: front,
    secondaryImage: back,
    frontImage: front,
    backImage: back,
    sideImage: side,
    images: imagesArr.length > 0 ? imagesArr : [front, back, side],
    description: p.description || '',
    sizes: availableSizes.length > 0 ? availableSizes : ['M'],
    stock: totalStock,
    sizeStock: sizeMap,
    is_active: p.is_active !== undefined ? p.is_active : true,
    isFeatured: p.is_featured || false,
    rating: p.ratingsAverage || p.rating || 4.9,
    ratingsAverage: p.ratingsAverage || p.rating || 4.9,
    reviewsCount: p.reviewsCount || p.ratingsCount || 24,
    ratingsCount: p.ratingsCount || 24,
    slug: p.slug || (p.name || '').toLowerCase().replace(/[^a-z0-9]+/g, '-')
  };
}

// Ensure Supabase client is hydrated before fetching
async function awaitSupabaseClient(timeoutMs = 1500) {
  if (window.supabaseClient) return window.supabaseClient;
  const start = Date.now();
  while (Date.now() - start < timeoutMs) {
    if (window.supabaseClient) return window.supabaseClient;
    await new Promise(r => setTimeout(r, 60));
  }
  return window.supabaseClient || null;
}

// ── PRIMARY DATABASE QUERY: SUPABASE CENTRAL DB ──────────────────────────────
async function fetchProductsFromAPI() {
  const sb = await awaitSupabaseClient();

  if (sb) {
    // 1. Try public get_public_products RPC
    try {
      const { data: rpcData, error: rpcErr } = await sb.rpc('get_public_products');
      if (!rpcErr && Array.isArray(rpcData) && rpcData.length > 0) {
        products = rpcData.map(mapSupabaseProduct);
        try { localStorage.setItem('products', JSON.stringify(products)); } catch(e) {}
        return products;
      }
    } catch (e) {}

    // 2. Direct Supabase SELECT (RLS allows is_active = true)
    try {
      const { data, error } = await sb
        .from('products')
        .select('*')
        .eq('is_active', true)
        .order('created_at', { ascending: false });

      if (!error && Array.isArray(data) && data.length > 0) {
        products = data.map(mapSupabaseProduct);
        try { localStorage.setItem('products', JSON.stringify(products)); } catch(e) {}
        return products;
      }
    } catch (err) {
      console.warn('[Products] Supabase table query notice:', err.message);
    }
  }

  // 3. Fallback: Secondary REST API (if available)
  try {
    if (typeof API !== 'undefined' && API.get) {
      const res = await API.get('/products');
      let apiList = null;
      if (res && res.success) {
        apiList = Array.isArray(res.data) ? res.data : (res.data?.products || res.products);
      }
      if (apiList && apiList.length > 0) {
        products = apiList.map(mapSupabaseProduct);
        try { localStorage.setItem('products', JSON.stringify(products)); } catch(e) {}
        return products;
      }
    }
  } catch (e) {}

  // 4. Fallback: LocalStorage cache
  try {
    const cached = JSON.parse(localStorage.getItem('products') || '[]');
    if (cached.length > 0) {
      products = cached.map(mapSupabaseProduct);
      return products;
    }
  } catch (e) {}

  // 5. Default catalog
  products = [...DEFAULT_CATALOG];
  return products;
}

// Expose globally
window.products = products;
window.fetchProductsFromAPI = fetchProductsFromAPI;
window.mapSupabaseProduct = mapSupabaseProduct;
window.mapApiProduct = mapSupabaseProduct;
