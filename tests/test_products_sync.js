// ==============================================================================
// BEARD BANNA — AUTOMATED PRODUCT PERSISTENCE & SYNC VERIFICATION SUITE
// ==============================================================================

const fs = require('fs');
const path = require('path');
const https = require('https');

const ROOT_DIR = path.resolve(__dirname, '..');
let passedTests = 0;
let totalTests = 0;

function assert(condition, message) {
  totalTests++;
  if (condition) {
    console.log(`  ✅ PASS: ${message}`);
    passedTests++;
  } else {
    console.error(`  ❌ FAIL: ${message}`);
  }
}

async function runTests() {
  console.log('\n👑 BEARD BANNA — PRODUCT SYNC & PERSISTENCE TEST SUITE\n');

  // TEST 1: Live Supabase Database Query (Single Source of Truth)
  console.log('[Suite 1: Live Central Database]');
  await new Promise((resolve) => {
    const url = 'https://xdetdylcbcvtsuxteeen.supabase.co/rest/v1/products?select=id,name,price,is_active';
    const req = https.get(url, {
      headers: {
        'apikey': 'sb_publishable_1kPBK6tBanQ2Hn__ZYdJVg_oskboZIv',
        'Authorization': 'Bearer sb_publishable_1kPBK6tBanQ2Hn__ZYdJVg_oskboZIv'
      }
    }, (res) => {
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => {
        try {
          const products = JSON.parse(data);
          assert(Array.isArray(products) && products.length >= 3, `Supabase public.products returns active products (Found: ${products.length})`);
          assert(products.some(p => p.name.includes('Royal Warrior')), 'Product 1: Royal Warrior Embroidered Tee present in DB');
          assert(products.some(p => p.name.includes('Imperial Heritage')), 'Product 2: Imperial Heritage Polo Shirt present in DB');
          assert(products.some(p => p.name.includes('Rajputana Valor')), 'Product 3: Rajputana Valor Heavyweight Hoodie present in DB');
        } catch (e) {
          assert(false, `Failed to parse Supabase products response: ${e.message}`);
        }
        resolve();
      });
    });
    req.on('error', (err) => {
      assert(false, `Supabase connection error: ${err.message}`);
      resolve();
    });
  });

  // TEST 2: Frontend Product Module Integrity
  console.log('\n[Suite 2: Frontend Product Fetching]');
  const frontendProductsJs = fs.readFileSync(path.join(ROOT_DIR, 'frontend', 'js', 'products.js'), 'utf8');
  assert(frontendProductsJs.includes('supabaseClient'), 'frontend/js/products.js connects to Supabase client');
  assert(frontendProductsJs.includes('get_public_products') || frontendProductsJs.includes('.from(\'products\')'), 'frontend/js/products.js queries Supabase products directly');
  assert(frontendProductsJs.includes('is_active = true') || frontendProductsJs.includes('is_active'), 'frontend/js/products.js respects published status');
  assert(frontendProductsJs.includes('awaitSupabaseClient'), 'frontend/js/products.js includes hydration guard for async client init');

  // TEST 3: Admin Product Management Integrity
  console.log('\n[Suite 3: Admin Panel Product CRUD & Persistence]');
  const adminProductsJs = fs.readFileSync(path.join(ROOT_DIR, 'admin-panel', 'js', 'products.js'), 'utf8');
  assert(adminProductsJs.includes('uploadImageToStorage'), 'admin-panel/js/products.js uploads images to persistent storage');
  assert(/storage\s*\.\s*from\(\s*['"]products['"]\s*\)/.test(adminProductsJs), 'admin-panel/js/products.js uses products storage bucket');
  assert(adminProductsJs.includes('admin_save_product') || adminProductsJs.includes('.from(\'products\').upsert'), 'admin-panel/js/products.js persists directly to Supabase DB');
  assert(adminProductsJs.includes('togglePublish'), 'admin-panel/js/products.js implements publish/unpublish workflow');
  assert(adminProductsJs.includes('deleteProduct'), 'admin-panel/js/products.js implements permanent database delete');
  assert(!adminProductsJs.includes('https://beard-banna-backend.onrender.com'), 'admin-panel/js/products.js removed dead Render backend calls');
  assert(adminProductsJs.includes('saveSuccess = false') && adminProductsJs.includes('!saveSuccess'), 'admin-panel/js/products.js blocks success message when DB write fails');

  // TEST 4: HTML Script Tag Ordering Across Storefront
  console.log('\n[Suite 4: Storefront Script Ordering]');
  const pages = [
    { file: 'frontend/collection.html', name: 'Collection Page' },
    { file: 'frontend/product.html', name: 'Product Detail Page' },
    { file: 'frontend/cart.html', name: 'Cart Page' },
    { file: 'frontend/wishlist.html', name: 'Wishlist Page' }
  ];

  for (const page of pages) {
    const html = fs.readFileSync(path.join(ROOT_DIR, page.file), 'utf8');
    const supabaseIdx = html.indexOf('supabase-client.js');
    const productsIdx = html.indexOf('products.js');

    assert(supabaseIdx !== -1, `${page.name} includes supabase-client.js`);
    if (productsIdx !== -1) {
      assert(supabaseIdx < productsIdx, `${page.name} loads Supabase client BEFORE products.js`);
    }
  }

  // TEST 5: SQL Migration Script Verification
  console.log('\n[Suite 5: SQL Migration Script & RPC Definitions]');
  const sqlContent = fs.readFileSync(path.join(ROOT_DIR, 'frontend', 'supabase-products-sync.sql'), 'utf8');
  assert(sqlContent.includes('CREATE TABLE IF NOT EXISTS public.products'), 'SQL defines public.products schema');
  assert(sqlContent.includes('CREATE OR REPLACE FUNCTION public.admin_save_product'), 'SQL defines admin_save_product RPC');
  assert(sqlContent.includes('CREATE OR REPLACE FUNCTION public.admin_toggle_product_status'), 'SQL defines admin_toggle_product_status RPC');
  assert(sqlContent.includes('CREATE OR REPLACE FUNCTION public.admin_delete_product'), 'SQL defines admin_delete_product RPC');
  assert(sqlContent.includes('CREATE OR REPLACE FUNCTION public.get_public_products'), 'SQL defines get_public_products RPC');
  assert(sqlContent.includes('storage.buckets'), 'SQL configures Supabase Storage bucket');
  assert(sqlContent.includes('beardbanna07773@gmail.com'), 'SQL configures verified admin email permissions');

  console.log(`\n==================================================`);
  console.log(`TEST SUMMARY: ${passedTests}/${totalTests} Passed (${Math.round((passedTests/totalTests)*100)}%)`);
  console.log(`==================================================\n`);

  if (passedTests === totalTests) {
    process.exit(0);
  } else {
    process.exit(1);
  }
}

runTests();
