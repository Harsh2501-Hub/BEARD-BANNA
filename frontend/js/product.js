// ===============================
// PRODUCT DETAIL PAGE - 3-ANGLE IMAGE GALLERY & PER-SIZE STOCK ENFORCED
// ===============================

let currentProduct = null;

// Helper to get stock for a specific size reliably — must be at TOP LEVEL scope
function getEffectiveSizeStock(product, size) {
  if (!product) return 0;
  const cleanSize = (size || "M").split(" ")[0].toUpperCase();

  if (product.sizeStock && typeof product.sizeStock === 'object') {
    const val = product.sizeStock[cleanSize];
    if (val !== undefined) return Number(val);
  }

  // Fallback: if the product has a total stock number, distribute to available sizes
  const totalStock = Number(product.stock !== undefined ? product.stock : 0);
  if (totalStock === 0) return 0;

  const sizes = Array.isArray(product.sizes) && product.sizes.length > 0
    ? product.sizes.map(s => s.toUpperCase())
    : ["S", "M", "L", "XL", "XXL"];

  if (sizes.includes(cleanSize)) return totalStock;
  return 0;
}

async function loadProductDetail() {
  const params = new URLSearchParams(window.location.search);
  const productId = params.get("id");
  const container = document.getElementById("product-details");
  if (!container) return;

  if (typeof fetchProductsFromAPI === "function") {
    await fetchProductsFromAPI();
  }

  currentProduct = products.find(p => String(p.id) === String(productId) || p.slug === productId);

  if (!currentProduct && productId) {
    try {
      const res = await API.get(`/products/${productId}`);
      if (res.success && res.data?.product) {
        const p = res.data.product;
        const sizeMap = { S: 0, M: 0, L: 0, XL: 0, XXL: 0 };

        // Map variants if they exist
        if (Array.isArray(p.variants)) {
          p.variants.forEach(v => {
            if (v.size && sizeMap.hasOwnProperty(v.size.toUpperCase())) {
              sizeMap[v.size.toUpperCase()] = v.stock || 0;
            }
          });
        }

        // If no variants, check sizeStock field directly
        if (p.sizeStock && typeof p.sizeStock === 'object') {
          Object.keys(p.sizeStock).forEach(s => {
            const key = s.toUpperCase();
            if (sizeMap.hasOwnProperty(key)) {
              sizeMap[key] = Number(p.sizeStock[s]) || 0;
            }
          });
        }

        // If still all zeros, distribute stock equally among listed sizes
        const totalFromVariants = Object.values(sizeMap).reduce((a, b) => a + b, 0);
        const totalStock = p.stock || totalFromVariants || 0;
        if (totalFromVariants === 0 && totalStock > 0) {
          const availableSizes = Array.isArray(p.sizes) && p.sizes.length > 0
            ? p.sizes.map(s => s.toUpperCase())
            : ["S", "M", "L", "XL", "XXL"];
          availableSizes.forEach(s => {
            if (sizeMap.hasOwnProperty(s)) sizeMap[s] = totalStock;
          });
        }

        const front = p.frontImage || p.image || (Array.isArray(p.images) && p.images[0]) || 'images/Product 1.jpeg';
        const back = p.backImage || p.secondaryImage || (Array.isArray(p.images) && p.images[1]) || front;
        const side = p.sideImage || (Array.isArray(p.images) && p.images[2]) || front;

        currentProduct = {
          id: p._id || p.id,
          name: p.title || p.name,
          price: p.price,
          stock: totalStock,
          sizeStock: sizeMap,
          image: front,
          secondaryImage: back,
          frontImage: front,
          backImage: back,
          sideImage: side,
          images: [front, back, side],
          description: p.description || '',
          category: p.category?.name || p.category || 'T-Shirts',
          sizes: Object.keys(sizeMap).filter(s => sizeMap[s] > 0)
        };
      }
    } catch (err) {
      console.warn("Product not found on backend:", err.message);
    }
  }

  if (!currentProduct) {
    currentProduct = products[0];
  }

  if (!currentProduct) {
    container.innerHTML = '<p style="color:#ef4444; text-align:center; padding:40px;">Product not found.</p>';
    return;
  }

  // Register product globally and in catalog
  window.currentProduct = currentProduct;
  if (Array.isArray(products) && !products.some(p => String(p.id) === String(currentProduct.id))) {
    products.push(currentProduct);
  }

  const frontImg = currentProduct.frontImage || currentProduct.image || (currentProduct.images && currentProduct.images[0]) || "images/Product 1.jpeg";
  const backImg = currentProduct.backImage || currentProduct.secondaryImage || (currentProduct.images && currentProduct.images[1]) || frontImg;
  const sideImg = currentProduct.sideImage || (currentProduct.images && currentProduct.images[2]) || frontImg;

  // Build sizeMap from product — ensure all standard sizes are present
  const sizeMap = currentProduct.sizeStock || {};
  const allSizes = ["S", "M", "L", "XL", "XXL"];
  allSizes.forEach(s => {
    if (sizeMap[s] === undefined) sizeMap[s] = 0;
  });
  currentProduct.sizeStock = sizeMap;

  // Default to first size with stock > 0, or first available size
  const defaultSize = allSizes.find(s => (sizeMap[s] || 0) > 0) || "L";
  const initialStock = sizeMap[defaultSize] || 0;
  const isInitiallyOut = initialStock === 0;

  container.innerHTML = `
    <div class="product-page">
      <!-- 3-ANGLE IMAGE GALLERY CONTAINER -->
      <div class="product-gallery-wrapper" style="flex:1; max-width:550px;">
        <div class="main-image-container" style="position:relative; overflow:hidden; border-radius:12px; border:2px solid #520F16; background:#0f172a; cursor:zoom-in;" onclick="openZoomLightbox(document.getElementById('large-product-img').src)">
          <img id="large-product-img" src="${frontImg}" class="product-image-large" alt="${currentProduct.name}" onerror="this.onerror=null; this.src='images/Product 1.jpeg';" style="width:100%; height:480px; object-fit:cover; display:block; transition:transform 0.3s ease;">
          <div style="position:absolute; bottom:12px; right:12px; background:rgba(0,0,0,0.75); color:#fbbf24; padding:6px 12px; border-radius:20px; font-size:0.78rem; font-weight:700; backdrop-filter:blur(4px); pointer-events:none;">
            🔍 Click for High-Res Detail Zoom
          </div>
        </div>

        <!-- THUMBNAILS (FRONT, BACK, SIDE) -->
        <div class="product-thumbnails-grid" style="display:grid; grid-template-columns: repeat(3, 1fr); gap:10px; margin-top:12px;">
          <div class="thumb-card active" onclick="switchProductAngle('${frontImg}', 'Front View', this)" style="border:2px solid #fbbf24; border-radius:8px; overflow:hidden; cursor:pointer; background:#1e293b; padding:4px; text-align:center;">
            <img src="${frontImg}" alt="Front View" style="width:100%; height:80px; object-fit:cover; border-radius:4px;" onerror="this.onerror=null; this.src='images/Product 1.jpeg';">
            <span style="display:block; font-size:0.75rem; font-weight:700; color:#fbbf24; margin-top:4px;">📸 Front View</span>
          </div>

          <div class="thumb-card" onclick="switchProductAngle('${backImg}', 'Back View', this)" style="border:2px solid #334155; border-radius:8px; overflow:hidden; cursor:pointer; background:#1e293b; padding:4px; text-align:center;">
            <img src="${backImg}" alt="Back View" style="width:100%; height:80px; object-fit:cover; border-radius:4px;" onerror="this.onerror=null; this.src='images/Product 2.jpeg';">
            <span style="display:block; font-size:0.75rem; font-weight:700; color:#94a3b8; margin-top:4px;">🔄 Back View</span>
          </div>

          <div class="thumb-card" onclick="switchProductAngle('${sideImg}', 'Side View', this)" style="border:2px solid #334155; border-radius:8px; overflow:hidden; cursor:pointer; background:#1e293b; padding:4px; text-align:center;">
            <img src="${sideImg}" alt="Side View" style="width:100%; height:80px; object-fit:cover; border-radius:4px;" onerror="this.onerror=null; this.src='images/Product 3.jpeg';">
            <span style="display:block; font-size:0.75rem; font-weight:700; color:#94a3b8; margin-top:4px;">📐 Side View</span>
          </div>
        </div>
      </div>

      <!-- PRODUCT INFO SECTION -->
      <div class="product-info">
        <h1>${currentProduct.name}</h1>
        <h2>₹${currentProduct.price}</h2>
        <div style="margin-bottom: 12px;" id="stock-tag-container">
          ${isInitiallyOut
            ? `<span class="stock-tag out" style="background:#ef4444; color:white; padding:4px 10px; border-radius:4px; font-size:0.85rem; font-weight:700;">Out of Stock (${defaultSize})</span>`
            : `<span class="stock-tag in" style="color:#22c55e; font-size:0.85rem; font-weight:700;">In Stock (${initialStock} available for size ${defaultSize})</span>`
          }
        </div>
        <p>${currentProduct.description || 'Premium royal Rajputana apparel.'}</p>
        
        <label for="size">Choose Size</label>
        <select id="size" onchange="onSizeSelected(this.value)">
          ${allSizes.map(size => {
            const qty = sizeMap[size] || 0;
            return `<option value="${size}" ${size === defaultSize ? 'selected' : ''}>${size} ${qty === 0 ? '(Out of Stock)' : `(${qty} in stock)`}</option>`;
          }).join("")}
        </select>
        
        <label for="qty" id="qty-label">Quantity (Max: ${initialStock})</label>
        <input type="number" id="qty" value="${isInitiallyOut ? 0 : 1}" min="${isInitiallyOut ? 0 : 1}" max="${initialStock}" ${isInitiallyOut ? "disabled" : ""}>
        <br><br>
        
        <button class="cart-btn" id="add-to-cart-btn" onclick="addProductToCart()" ${isInitiallyOut ? "disabled style='opacity:0.5; cursor:not-allowed;'" : ""}>
          ${isInitiallyOut ? "Out of Stock" : "Add To Cart"}
        </button>
        <button class="view-btn" id="buy-now-btn" onclick="buyNow()" ${isInitiallyOut ? "disabled style='opacity:0.5; cursor:not-allowed;'" : ""}>
          ${isInitiallyOut ? "Unavailable" : "Buy Now"}
        </button>
      </div>
    </div>
  `;

  // Attach Stock Guard Listener to Quantity Input
  const qtyInput = document.getElementById("qty");
  if (qtyInput) {
    qtyInput.addEventListener("input", function () {
      const selectedSizeVal = document.getElementById("size")?.value || "M";
      const cleanSize = selectedSizeVal.split(" ")[0];
      const sizeStockVal = getEffectiveSizeStock(currentProduct, cleanSize);
      let val = Number(this.value);
      if (val > sizeStockVal) {
        this.value = sizeStockVal;
        if (typeof showToast === "function") {
          showToast(`Only ${sizeStockVal} items available for size ${cleanSize}`, "warning");
        }
      }
      if (val < 1 && sizeStockVal > 0) {
        this.value = 1;
      }
    });
  }
}

// ===============================
// IMAGE GALLERY CONTROLS
// ===============================

window.switchProductAngle = function(imgSrc, label, thumbCard) {
  const largeImg = document.getElementById("large-product-img");
  if (largeImg) {
    largeImg.style.opacity = "0.3";
    setTimeout(() => {
      largeImg.src = imgSrc;
      largeImg.style.opacity = "1";
    }, 150);
  }

  document.querySelectorAll(".thumb-card").forEach(tc => {
    tc.style.borderColor = "#334155";
    const span = tc.querySelector("span");
    if (span) span.style.color = "#94a3b8";
  });

  if (thumbCard) {
    thumbCard.style.borderColor = "#fbbf24";
    const span = thumbCard.querySelector("span");
    if (span) span.style.color = "#fbbf24";
  }
};

// Fullscreen Detail Lightbox Zoom Modal
window.openZoomLightbox = function(imgSrc) {
  let modal = document.getElementById("zoom-lightbox-modal");
  if (!modal) {
    modal = document.createElement("div");
    modal.id = "zoom-lightbox-modal";
    modal.style.cssText = `
      position: fixed;
      top: 0; left: 0;
      width: 100vw; height: 100vh;
      background: rgba(15, 23, 42, 0.95);
      backdrop-filter: blur(8px);
      z-index: 99999;
      display: flex;
      align-items: center;
      justify-content: center;
      cursor: zoom-out;
    `;
    modal.onclick = function() { modal.style.display = "none"; };
    modal.innerHTML = `
      <div style="position:relative; max-width:90vw; max-height:90vh; text-align:center;">
        <span style="position:absolute; top:-40px; right:0; color:#fbbf24; font-size:2rem; font-weight:700; cursor:pointer;">✕</span>
        <img id="lightbox-zoom-img" src="" style="max-width:100%; max-height:85vh; object-fit:contain; border-radius:12px; box-shadow:0 25px 50px -12px rgba(0,0,0,0.8); border:2px solid #fbbf24;">
        <p style="color:#cbd5e1; font-weight:600; margin-top:10px; font-size:0.9rem;">🔎 Detailed View — High-Resolution Fabric & Embroidery Preview</p>
      </div>
    `;
    document.body.appendChild(modal);
  }
  const zoomImg = document.getElementById("lightbox-zoom-img");
  if (zoomImg) zoomImg.src = imgSrc;
  modal.style.display = "flex";
};

// ===============================
// SIZE SELECTION HANDLER
// ===============================

window.onSizeSelected = function (selectedSize) {
  if (!currentProduct) return;
  const cleanSize = selectedSize ? selectedSize.split(" ")[0] : "M";
  const sizeStock = getEffectiveSizeStock(currentProduct, cleanSize);

  const tagContainer = document.getElementById("stock-tag-container");
  const qtyLabel = document.getElementById("qty-label");
  const qtyInput = document.getElementById("qty");
  const addCartBtn = document.getElementById("add-to-cart-btn");
  const buyNowBtn = document.getElementById("buy-now-btn");

  if (sizeStock === 0) {
    if (tagContainer) tagContainer.innerHTML = `<span class="stock-tag out" style="background:#ef4444; color:white; padding:4px 10px; border-radius:4px; font-size:0.85rem; font-weight:700;">Out of Stock (${cleanSize})</span>`;
    if (qtyLabel) qtyLabel.textContent = `Quantity (Out of Stock for ${cleanSize})`;
    if (qtyInput) { qtyInput.value = 0; qtyInput.disabled = true; qtyInput.max = 0; }
    if (addCartBtn) { addCartBtn.disabled = true; addCartBtn.textContent = "Out of Stock"; addCartBtn.style.opacity = "0.5"; addCartBtn.style.cursor = "not-allowed"; }
    if (buyNowBtn) { buyNowBtn.disabled = true; buyNowBtn.textContent = "Unavailable"; buyNowBtn.style.opacity = "0.5"; buyNowBtn.style.cursor = "not-allowed"; }
  } else {
    if (tagContainer) tagContainer.innerHTML = `<span class="stock-tag in" style="color:#22c55e; font-size:0.85rem; font-weight:700;">In Stock (${sizeStock} available for size ${cleanSize})</span>`;
    if (qtyLabel) qtyLabel.textContent = `Quantity (Max: ${sizeStock})`;
    if (qtyInput) {
      qtyInput.disabled = false;
      qtyInput.min = 1;
      qtyInput.max = sizeStock;
      if (Number(qtyInput.value) <= 0 || Number(qtyInput.value) > sizeStock) qtyInput.value = 1;
    }
    if (addCartBtn) { addCartBtn.disabled = false; addCartBtn.textContent = "Add To Cart"; addCartBtn.style.opacity = "1"; addCartBtn.style.cursor = "pointer"; }
    if (buyNowBtn) { buyNowBtn.disabled = false; buyNowBtn.textContent = "Buy Now"; buyNowBtn.style.opacity = "1"; buyNowBtn.style.cursor = "pointer"; }
  }
};

// ===============================
// CART ACTIONS
// ===============================

window.addProductToCart = async function () {
  const prod = window.currentProduct || currentProduct;
  if (!prod) {
    alert("Product info not loaded yet. Please wait.");
    return;
  }

  const rawSizeVal = document.getElementById("size")?.value || "M";
  const selectedSize = rawSizeVal.split(" ")[0];
  const qtyInput = document.getElementById("qty");
  const qty = qtyInput ? Number(qtyInput.value) : 1;

  const sizeStock = getEffectiveSizeStock(prod, selectedSize);

  // Check qty is valid
  if (qty < 1) {
    alert("Please select a valid quantity.");
    return;
  }

  if (sizeStock > 0 && qty > sizeStock) {
    alert(`Only ${sizeStock} items available for size ${selectedSize}.`);
    return;
  }

  // Ensure product is in global catalog
  if (Array.isArray(products) && !products.some(p => String(p.id) === String(prod.id))) {
    products.push(prod);
  }
  window.currentProduct = prod;

  if (typeof addToCart === "function") {
    await addToCart(prod.id, selectedSize, qty);
  } else {
    alert(`Added ${qty} x ${prod.name} (Size: ${selectedSize}) to cart!`);
  }
};

window.buyNow = async function () {
  await addProductToCart();
  setTimeout(() => {
    window.location.href = "cart.html";
  }, 300);
};

document.addEventListener("DOMContentLoaded", loadProductDetail);