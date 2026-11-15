// ==============================================================================
// BEARD BANNA — ADMIN PRODUCTS MANAGEMENT (CENTRAL SUPABASE DATABASE)
// Direct DB Persistence, Persistent Storage, and Live Cross-Device Sync
// ==============================================================================

let products = [];
let editingProductId = null;
let currentPreviewAngle = "front";

// Track pending image files selected for upload
const pendingFiles = {
  front: null,
  back: null,
  side: null
};

// Track active image URLs or local previews
const currentImageUrls = {
  front: "",
  back: "",
  side: ""
};

// ── 1. LOAD ADMIN PRODUCTS FROM CENTRAL SUPABASE DATABASE ────────────────────
async function loadAdminProducts() {
  const tbody = document.getElementById("products-table-body");
  if (tbody) {
    tbody.innerHTML = `
      <tr>
        <td colspan="7" style="text-align:center; padding: 30px; color:#94a3b8;">
          <div style="border: 3px solid rgba(251,191,36,0.2); border-top: 3px solid #fbbf24; border-radius: 50%; width: 32px; height: 32px; animation: spinAdmin 0.8s linear infinite; margin: 0 auto 12px auto;"></div>
          <p style="color:#fbbf24; font-weight:600; margin:0;">Loading products from central database...</p>
        </td>
      </tr>
      <style>@keyframes spinAdmin { 0% { transform: rotate(0deg); } 100% { transform: rotate(360deg); } }</style>
    `;
  }

  let dbProducts = null;

  // Primary: Query Supabase public.products
  if (window.supabaseClient) {
    try {
      const { data, error } = await window.supabaseClient
        .from('products')
        .select('*')
        .order('created_at', { ascending: false });

      if (!error && Array.isArray(data)) {
        dbProducts = data;
      } else if (error) {
        console.warn('[Admin Products] Supabase query notice:', error.message);
      }
    } catch (e) {
      console.warn('[Admin Products] Supabase query exception:', e.message);
    }
  }

  // Fallback: Check local storage only if DB was completely unreachable
  if (dbProducts === null) {
    try {
      const cached = JSON.parse(localStorage.getItem('products') || '[]');
      if (cached.length > 0) dbProducts = cached;
    } catch (e) {}
  }

  // Map to standardized format
  if (Array.isArray(dbProducts) && dbProducts.length > 0) {
    products = dbProducts.map(mapAdminProductRecord);
  } else {
    products = [];
  }

  // Cache in localStorage for offline resiliency
  try { localStorage.setItem('products', JSON.stringify(products)); } catch(e) {}
  renderProducts();
}

function mapAdminProductRecord(p) {
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
    stock: totalStock,
    sizeStock: sizeMap,
    is_active: p.is_active !== undefined ? p.is_active : true,
    isFeatured: p.is_featured || false,
    rating: p.ratingsAverage || p.rating || 4.9,
    reviewsCount: p.reviewsCount || p.ratingsCount || 24,
    slug: p.slug || (p.name || '').toLowerCase().replace(/[^a-z0-9]+/g, '-')
  };
}

// ── 2. RENDER PRODUCTS TABLE ──────────────────────────────────────────────────
function renderProducts(productList = products) {
  const tbody = document.getElementById("products-table-body");
  if (!tbody) return;
  tbody.innerHTML = "";

  if (productList.length === 0) {
    tbody.innerHTML = `
      <tr>
        <td colspan="7">
          <div class="empty-products" style="text-align:center; padding: 30px;">
            📦 <h3>No Products in Central Database</h3>
            <p>Add your first luxury Rajputana product using the form.</p>
          </div>
        </td>
      </tr>
    `;
    const countEl = document.getElementById("product-count");
    if (countEl) countEl.textContent = "0 Products";
    return;
  }

  productList.forEach(product => {
    const front = product.frontImage || product.image || "images/Product 1.jpeg";
    const back = product.backImage || product.secondaryImage || front;
    const side = product.sideImage || front;
    const isPublished = product.is_active !== false;

    tbody.innerHTML += `
      <tr style="${isPublished ? '' : 'opacity: 0.65; background: rgba(15, 23, 42, 0.4);'}">
        <td>
          <div style="display:flex; gap:4px;">
            <img src="${escapeHtml(front)}" title="Front View" style="width:38px; height:38px; object-fit:cover; border-radius:4px; border:1px solid #38bdf8;" onerror="this.onerror=null; this.src='images/Product 1.jpeg';">
            <img src="${escapeHtml(back)}" title="Back View" style="width:38px; height:38px; object-fit:cover; border-radius:4px; border:1px solid #475569;" onerror="this.onerror=null; this.src='images/Product 1.jpeg';">
            <img src="${escapeHtml(side)}" title="Side View" style="width:38px; height:38px; object-fit:cover; border-radius:4px; border:1px solid #475569;" onerror="this.onerror=null; this.src='images/Product 1.jpeg';">
          </div>
        </td>
        <td>
          <div class="product-info">
            <h4 style="margin:0; font-size:0.95rem; color:#f8fafc;">${escapeHtml(product.name)}</h4>
            <span style="color:#94a3b8; font-size:0.8rem;">${escapeHtml(product.category)}</span>
          </div>
        </td>
        <td><span class="price-tag" style="font-weight:700; color:#fbbf24;">₹${product.price}</span></td>
        <td>
          ${isPublished 
            ? `<span style="background:rgba(34,197,94,0.15); color:#22c55e; border:1px solid rgba(34,197,94,0.3); font-size:0.75rem; font-weight:700; padding:3px 8px; border-radius:12px;">🟢 Published</span>`
            : `<span style="background:rgba(148,163,184,0.15); color:#94a3b8; border:1px solid rgba(148,163,184,0.3); font-size:0.75rem; font-weight:600; padding:3px 8px; border-radius:12px;">⚪ Draft</span>`}
        </td>
        <td>${getPerSizeStockBadge(product)}</td>
        <td>
          <div style="display:flex; gap:6px; flex-wrap:wrap;">
            <button class="edit-btn" onclick="editProduct('${escapeHtml(product.id)}')" style="background:#0284c7; color:white; border:none; padding:5px 9px; border-radius:4px; cursor:pointer; font-size:0.8rem;">✏ Edit</button>
            <button onclick="togglePublish('${escapeHtml(product.id)}', ${isPublished})" style="background:${isPublished ? '#d97706' : '#16a34a'}; color:white; border:none; padding:5px 9px; border-radius:4px; cursor:pointer; font-size:0.8rem;">
              ${isPublished ? '👁 Unpublish' : '🚀 Publish'}
            </button>
            <button class="delete-btn" onclick="deleteProduct('${escapeHtml(product.id)}')" style="background:#ef4444; color:white; border:none; padding:5px 9px; border-radius:4px; cursor:pointer; font-size:0.8rem;">🗑 Delete</button>
          </div>
        </td>
      </tr>
    `;
  });

  const countEl = document.getElementById("product-count");
  if (countEl) countEl.textContent = `${productList.length} Products`;
}

function getPerSizeStockBadge(product) {
  const map = product.sizeStock || { S: 0, M: 0, L: Number(product.stock || 0), XL: 0, XXL: 0 };
  const total = Object.values(map).reduce((a, b) => a + Number(b), 0);

  if (total === 0) return `<span class="stock-badge out" style="color:#ef4444; font-weight:700;">Out of Stock (0)</span>`;

  let details = [];
  ["S", "M", "L", "XL", "XXL"].forEach(sz => {
    const qty = Number(map[sz] || 0);
    if (qty > 0) details.push(`${sz}:${qty}`);
  });

  const detailText = details.length > 0 ? details.join(", ") : `Total: ${total}`;
  return `<span class="stock-badge available" style="font-size:0.82rem; color:#22c55e; font-weight:700;">${total} units<br><small style="color:#94a3b8;">(${detailText})</small></span>`;
}

// ── 3. IMAGE UPLOAD & PERSISTENT STORAGE ──────────────────────────────────────
async function uploadImageToStorage(file, angleKey) {
  if (!file) return null;
  if (!window.supabaseClient || !window.supabaseClient.storage) return null;

  try {
    const ext = file.name.split('.').pop() || 'jpeg';
    const cleanBase = file.name.split('.')[0].replace(/[^a-zA-Z0-9_-]/g, '') || 'product';
    const fileName = `prod_${Date.now()}_${angleKey}_${cleanBase}.${ext}`;

    const { data, error } = await window.supabaseClient.storage
      .from('products')
      .upload(fileName, file, { cacheControl: '3600', upsert: true });

    if (error) {
      console.warn(`[Products Storage] Upload notice for ${angleKey}:`, error.message);
      return null;
    }

    const { data: { publicUrl } } = window.supabaseClient.storage
      .from('products')
      .getPublicUrl(fileName);

    return publicUrl;
  } catch (err) {
    console.warn(`[Products Storage] Upload exception for ${angleKey}:`, err.message);
    return null;
  }
}

function setupAngleFileInput(angleKey, fileInputId, urlInputId) {
  const fileInput = document.getElementById(fileInputId);
  const urlInput = document.getElementById(urlInputId);
  const ALLOWED_MIME = ['image/jpeg', 'image/png', 'image/webp'];

  if (fileInput) {
    fileInput.addEventListener("change", function (e) {
      const file = e.target.files[0];
      if (file) {
        if (!ALLOWED_MIME.includes(file.type)) {
          alert(`Invalid image format for ${angleKey} view. Allowed: JPG, PNG, WebP`);
          fileInput.value = "";
          return;
        }

        if (file.size > 5 * 1024 * 1024) {
          alert(`Image too large for ${angleKey} view. Maximum allowed size is 5MB.`);
          fileInput.value = "";
          return;
        }

        pendingFiles[angleKey] = file;
        currentImageUrls[angleKey] = URL.createObjectURL(file);
        if (urlInput) urlInput.value = "";
        updatePreview();
      }
    });
  }

  if (urlInput) {
    urlInput.addEventListener("input", function () {
      pendingFiles[angleKey] = null;
      currentImageUrls[angleKey] = this.value.trim();
      updatePreview();
    });
  }
}

setupAngleFileInput("front", "product-image-file-front", "product-image-url-front");
setupAngleFileInput("back", "product-image-file-back", "product-image-url-back");
setupAngleFileInput("side", "product-image-file-side", "product-image-url-side");

window.switchPreviewAngle = function(angle, btn) {
  currentPreviewAngle = angle;
  document.querySelectorAll(".preview-angle-btn").forEach(b => {
    b.style.background = "#1e293b";
    b.style.color = "#cbd5e1";
    b.style.borderColor = "#334155";
  });

  if (btn) {
    btn.style.background = "#38bdf8";
    btn.style.color = "#0f172a";
    btn.style.borderColor = "#38bdf8";
  }
  updatePreview();
};

function getImageForAngle(angleKey) {
  const localUrl = currentImageUrls[angleKey];
  const urlInput = document.getElementById(`product-image-url-${angleKey}`);
  const urlVal = urlInput ? urlInput.value.trim() : "";

  if (localUrl) return localUrl;
  if (urlVal) return urlVal;

  if (angleKey === "front") return "images/Product 1.jpeg";
  if (angleKey === "back") return "images/Product 2.jpeg";
  if (angleKey === "side") return "images/Product 3.jpeg";
  return "images/Product 1.jpeg";
}

function updatePreview() {
  const nameInput = document.getElementById("product-name");
  const priceInput = document.getElementById("product-price");
  const categoryInput = document.getElementById("product-category");
  const descriptionInput = document.getElementById("product-description");

  const previewName = document.getElementById("preview-name");
  const previewPrice = document.getElementById("preview-price");
  const previewCategory = document.getElementById("preview-category");
  const previewImage = document.getElementById("preview-image");
  const previewDesc = document.getElementById("preview-description");

  if (previewName) previewName.textContent = nameInput?.value.trim() || "Product Name";
  if (previewPrice) previewPrice.textContent = "₹" + (priceInput?.value || "0");
  if (previewCategory) previewCategory.textContent = categoryInput?.value || "Category";
  if (previewDesc) previewDesc.textContent = descriptionInput?.value.trim() || "Product description will appear here.";

  if (previewImage) {
    previewImage.src = getImageForAngle(currentPreviewAngle);
  }
}

// Bind live preview listeners
const nameInput = document.getElementById("product-name");
const priceInput = document.getElementById("product-price");
const categoryInput = document.getElementById("product-category");
const descriptionInput = document.getElementById("product-description");
const productForm = document.getElementById("product-form");

if (nameInput) nameInput.addEventListener("input", updatePreview);
if (priceInput) priceInput.addEventListener("input", updatePreview);
if (categoryInput) categoryInput.addEventListener("change", updatePreview);
if (descriptionInput) descriptionInput.addEventListener("input", updatePreview);

// ── 4. FORM SUBMIT: PERSIST TO CENTRAL SUPABASE DATABASE ──────────────────────
if (productForm) {
  productForm.addEventListener("submit", async function (e) {
    e.preventDefault();

    const name = nameInput ? nameInput.value.trim() : "";
    const price = priceInput ? Number(priceInput.value) : 0;
    const category = categoryInput ? categoryInput.value : "";
    const description = descriptionInput ? descriptionInput.value.trim() : "";

    if (!name || name.length < 3) {
      alert("Product name must be at least 3 characters.");
      return;
    }

    if (price <= 0) {
      alert("Price must be greater than 0.");
      return;
    }

    if (!category) {
      alert("Please select a category.");
      return;
    }

    // Per-size stocks
    const sizeStock = {
      S: Math.max(0, Number(document.getElementById("size-stock-S")?.value || 0)),
      M: Math.max(0, Number(document.getElementById("size-stock-M")?.value || 0)),
      L: Math.max(0, Number(document.getElementById("size-stock-L")?.value || 0)),
      XL: Math.max(0, Number(document.getElementById("size-stock-XL")?.value || 0)),
      XXL: Math.max(0, Number(document.getElementById("size-stock-XXL")?.value || 0))
    };
    const totalStock = Object.values(sizeStock).reduce((a, b) => a + b, 0);

    const saveBtn = productForm.querySelector("button[type='submit']");
    if (saveBtn) {
      saveBtn.disabled = true;
      saveBtn.textContent = "⏳ Uploading Images & Saving to Database...";
    }

    // ── Upload images to persistent storage if files were selected ──
    let frontImg = getImageForAngle("front");
    let backImg = getImageForAngle("back");
    let sideImg = getImageForAngle("side");

    if (pendingFiles.front) {
      const up = await uploadImageToStorage(pendingFiles.front, "front");
      if (up) frontImg = up;
    }
    if (pendingFiles.back) {
      const up = await uploadImageToStorage(pendingFiles.back, "back");
      if (up) backImg = up;
    }
    if (pendingFiles.side) {
      const up = await uploadImageToStorage(pendingFiles.side, "side");
      if (up) sideImg = up;
    }

    // Do NOT allow blob URLs in database
    if (frontImg.startsWith('blob:')) frontImg = 'images/Product 1.jpeg';
    if (backImg.startsWith('blob:')) backImg = frontImg;
    if (sideImg.startsWith('blob:')) sideImg = frontImg;

    const productId = editingProductId || ("prod_" + Date.now());
    const slug = name.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");

    const dbPayload = {
      id: productId,
      name: name,
      title: name,
      slug: slug,
      price: price,
      original_price: Math.round(price * 1.35),
      category: category,
      image: frontImg,
      secondary_image: backImg,
      images: [frontImg, backImg, sideImg],
      stock: totalStock,
      size_stock: sizeStock,
      description: description,
      is_featured: false,
      is_active: true,
      updated_at: new Date().toISOString()
    };

    let saveSuccess = false;
    let errorDetail = "";

    // ── Primary Save: Central Supabase Database ──────────────────────────────
    if (window.supabaseClient) {
      // Method A: Try authoritative admin_save_product RPC
      try {
        const { data: rpcRes, error: rpcErr } = await window.supabaseClient.rpc('admin_save_product', {
          p_id: productId,
          p_name: name,
          p_title: name,
          p_slug: slug,
          p_price: price,
          p_original_price: Math.round(price * 1.35),
          p_category: category,
          p_image: frontImg,
          p_secondary_image: backImg,
          p_images: [frontImg, backImg, sideImg],
          p_stock: totalStock,
          p_size_stock: sizeStock,
          p_description: description,
          p_is_featured: false,
          p_is_active: true
        });

        if (!rpcErr && rpcRes && rpcRes.success) {
          saveSuccess = true;
        } else if (rpcErr) {
          console.warn('[Admin Products] RPC save notice:', rpcErr.message);
          errorDetail = rpcErr.message;
        }
      } catch (e) {
        console.warn('[Admin Products] RPC call exception:', e.message);
      }

      // Method B: Direct Supabase Upsert
      if (!saveSuccess) {
        try {
          const { data, error } = await window.supabaseClient
            .from('products')
            .upsert(dbPayload, { onConflict: 'id' })
            .select()
            .single();

          if (!error && data) {
            saveSuccess = true;
          } else if (error) {
            errorDetail = error.message;
            console.error('[Admin Products] Supabase upsert error:', error);
          }
        } catch (e) {
          errorDetail = e.message;
        }
      }
    }

    if (saveBtn) {
      saveBtn.disabled = false;
      saveBtn.textContent = editingProductId ? "✏ Update Product" : "💾 Save Product";
    }

    // BLOCKING RESULT: Only show success if database operation succeeded!
    if (!saveSuccess) {
      alert(`❌ Failed to save product to central database!\n\nError: ${errorDetail || 'Check Supabase connection and admin authentication.'}\n\nPlease try again.`);
      return;
    }

    if (typeof showToast === "function") {
      showToast(editingProductId ? "✏ Product Updated in Central Database!" : "🎉 Product Saved to Central Database!");
    } else {
      alert(editingProductId ? "✏ Product Updated Successfully!" : "🎉 Product Added Successfully!");
    }

    // Clear form state
    editingProductId = null;
    productForm.reset();
    resetSizeStockInputs();
    pendingFiles.front = null;
    pendingFiles.back = null;
    pendingFiles.side = null;
    currentImageUrls.front = "";
    currentImageUrls.back = "";
    currentImageUrls.side = "";

    const formTitle = document.getElementById("form-title");
    if (formTitle) formTitle.textContent = "➕ Add Product";

    // Reload list from database
    await loadAdminProducts();
    updatePreview();
  });
}

function resetSizeStockInputs() {
  ["S", "M", "L", "XL", "XXL"].forEach(sz => {
    const el = document.getElementById(`size-stock-${sz}`);
    if (el) el.value = "0";
  });
}

function editProduct(id) {
  const product = products.find(p => String(p.id) === String(id));
  if (!product) return;

  editingProductId = id;

  if (nameInput) nameInput.value = product.name;
  if (priceInput) priceInput.value = product.price;
  if (categoryInput) categoryInput.value = product.category;

  const map = product.sizeStock || { S: 0, M: 0, L: Number(product.stock || 0), XL: 0, XXL: 0 };
  ["S", "M", "L", "XL", "XXL"].forEach(sz => {
    const el = document.getElementById(`size-stock-${sz}`);
    if (el) el.value = map[sz] !== undefined ? map[sz] : 0;
  });

  const front = product.frontImage || product.image || "";
  const back = product.backImage || product.secondaryImage || "";
  const side = product.sideImage || "";

  const frontUrlInput = document.getElementById("product-image-url-front");
  const backUrlInput = document.getElementById("product-image-url-back");
  const sideUrlInput = document.getElementById("product-image-url-side");

  if (frontUrlInput) frontUrlInput.value = front.startsWith("blob:") ? "" : front;
  if (backUrlInput) backUrlInput.value = back.startsWith("blob:") ? "" : back;
  if (sideUrlInput) sideUrlInput.value = side.startsWith("blob:") ? "" : side;

  currentImageUrls.front = front;
  currentImageUrls.back = back;
  currentImageUrls.side = side;

  if (descriptionInput) descriptionInput.value = product.description;

  const formTitle = document.getElementById("form-title");
  if (formTitle) formTitle.textContent = "✏ Edit Product: " + product.name;

  const saveBtn = productForm?.querySelector("button[type='submit']");
  if (saveBtn) saveBtn.textContent = "✏ Update Product";

  updatePreview();
  window.scrollTo({ top: 0, behavior: "smooth" });
}

// ── 5. TOGGLE PUBLISH / UNPUBLISH (IS_ACTIVE) ─────────────────────────────────
async function togglePublish(id, currentPublished) {
  const newStatus = !currentPublished;
  const actionText = newStatus ? "publish" : "unpublish";

  if (!confirm(`Are you sure you want to ${actionText} this product?`)) return;

  let success = false;
  if (window.supabaseClient) {
    try {
      const { data: rpcData, error: rpcErr } = await window.supabaseClient.rpc('admin_toggle_product_status', {
        p_id: String(id),
        p_is_active: newStatus
      });
      if (!rpcErr && rpcData?.success) success = true;
    } catch (e) {}

    if (!success) {
      try {
        const { error } = await window.supabaseClient
          .from('products')
          .update({ is_active: newStatus, updated_at: new Date().toISOString() })
          .eq('id', String(id));
        if (!error) success = true;
      } catch (e) {}
    }
  }

  if (success) {
    if (typeof showToast === "function") {
      showToast(newStatus ? "🟢 Product Published to Collection!" : "⚪ Product Unpublished (Draft)");
    }
    await loadAdminProducts();
  } else {
    alert("❌ Failed to update publish status. Please check admin permissions.");
  }
}

// ── 6. DELETE PRODUCT PERMANENTLY ─────────────────────────────────────────────
async function deleteProduct(id) {
  if (!confirm("⚠️ Are you sure you want to permanently delete this product from the central database? This cannot be undone.")) return;

  let success = false;
  if (window.supabaseClient) {
    try {
      const { data: rpcData, error: rpcErr } = await window.supabaseClient.rpc('admin_delete_product', {
        p_id: String(id)
      });
      if (!rpcErr && rpcData?.success) success = true;
    } catch (e) {}

    if (!success) {
      try {
        const { error } = await window.supabaseClient
          .from('products')
          .delete()
          .eq('id', String(id));
        if (!error) success = true;
      } catch (e) {}
    }
  }

  if (success) {
    if (typeof showToast === "function") showToast("🗑 Product Deleted from Database");
    await loadAdminProducts();
  } else {
    alert("❌ Failed to delete product. Please check admin permissions.");
  }
}

// ── 7. INITIALIZE ─────────────────────────────────────────────────────────────
document.addEventListener("DOMContentLoaded", loadAdminProducts);

// Global exposure
window.loadAdminProducts = loadAdminProducts;
window.editProduct = editProduct;
window.deleteProduct = deleteProduct;
window.togglePublish = togglePublish;
