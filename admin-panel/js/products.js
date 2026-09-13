// ===============================
// ADMIN PRODUCTS - 3-ANGLE IMAGE GALLERY & REST API INTEGRATION
// ===============================

let products = [];
let editingProductId = null;

let imageDataUrls = {
  front: "",
  back: "",
  side: ""
};

let currentPreviewAngle = "front";

async function loadAdminProducts() {
  const localProducts = JSON.parse(localStorage.getItem("products")) || [];

  try {
    const res = await API.get('/products');
    const apiProductList = res.data?.products || res.data || [];
    if (res.success && Array.isArray(apiProductList) && apiProductList.length > 0) {
      products = apiProductList.map(p => {
        const sizeStockMap = { S: 0, M: 0, L: 0, XL: 0, XXL: 0 };
        if (p.sizeStock) {
          const raw = (p.sizeStock instanceof Map) ? Object.fromEntries(p.sizeStock) : p.sizeStock;
          Object.keys(sizeStockMap).forEach(s => { sizeStockMap[s] = Number(raw[s]) || 0; });
        }
        if (Array.isArray(p.variants)) {
          p.variants.forEach(v => {
            if (v.size && sizeStockMap.hasOwnProperty(v.size.toUpperCase())) {
              sizeStockMap[v.size.toUpperCase()] = v.stock || 0;
            }
          });
        }
        const totalStock = p.stock !== undefined ? Number(p.stock) : Object.values(sizeStockMap).reduce((a, b) => a + b, 0);

        const front = p.frontImage || p.image || (Array.isArray(p.images) && p.images[0]) || "images/Product 1.jpeg";
        const back = p.backImage || p.secondaryImage || (Array.isArray(p.images) && p.images[1]) || front;
        const side = p.sideImage || (Array.isArray(p.images) && p.images[2]) || front;

        return {
          id: String(p._id || p.id),
          _id: String(p._id || p.id),
          name: p.title || p.name,
          title: p.title || p.name,
          price: Number(p.price) || 0,
          category: p.category?.name || p.category || "T-Shirts",
          stock: totalStock,
          sizeStock: sizeStockMap,
          image: front,
          secondaryImage: back,
          frontImage: front,
          backImage: back,
          sideImage: side,
          images: [front, back, side],
          description: p.description || "",
          sizes: Object.keys(sizeStockMap).filter(s => sizeStockMap[s] > 0),
          ratingsAverage: p.ratingsAverage || p.rating || 4.8,
          ratingsCount: p.ratingsCount || p.reviewsCount || 12
        };
      });

      localStorage.setItem("products", JSON.stringify(products));
      renderProducts();
      return;
    }
  } catch (err) {
    console.warn("Using local products list fallback:", err.message);
  }

  products = localProducts.length > 0 ? localProducts : [
    {
      id: "1",
      name: "Royal Warrior Embroidered Tee",
      price: 999,
      category: "Round Neck T-Shirts",
      stock: 25,
      sizeStock: { S: 0, M: 5, L: 15, XL: 5, XXL: 0 },
      image: "images/Product 1.jpeg",
      secondaryImage: "images/Product 2.jpeg",
      frontImage: "images/Product 1.jpeg",
      backImage: "images/Product 2.jpeg",
      sideImage: "images/Product 3.jpeg",
      images: ["images/Product 1.jpeg", "images/Product 2.jpeg", "images/Product 3.jpeg"],
      description: "Royal warrior tee with gold Rajputana scriptures.",
      sizes: ["M", "L", "XL"],
      ratingsAverage: 4.9,
      ratingsCount: 28
    },
    {
      id: "2",
      name: "Imperial Heritage Polo Shirt",
      price: 1299,
      category: "Collar T-Shirts",
      stock: 18,
      sizeStock: { S: 2, M: 8, L: 8, XL: 0, XXL: 0 },
      image: "images/Product 2.jpeg",
      secondaryImage: "images/Product 3.jpeg",
      frontImage: "images/Product 2.jpeg",
      backImage: "images/Product 3.jpeg",
      sideImage: "images/Product 1.jpeg",
      images: ["images/Product 2.jpeg", "images/Product 3.jpeg", "images/Product 1.jpeg"],
      description: "Classic polo shirt with royal crest logo.",
      sizes: ["S", "M", "L"],
      ratingsAverage: 4.8,
      ratingsCount: 19
    },
    {
      id: "3",
      name: "Rajputana Valor Heavyweight Hoodie",
      price: 1999,
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
      ratingsAverage: 5.0,
      ratingsCount: 34
    }
  ];

  localStorage.setItem("products", JSON.stringify(products));
  renderProducts();
}

function renderProducts(productList = products) {
  const tbody = document.getElementById("products-table-body");
  if (!tbody) return;
  tbody.innerHTML = "";

  if (productList.length === 0) {
    tbody.innerHTML = `
      <tr>
        <td colspan="6">
          <div class="empty-products" style="text-align:center; padding: 20px;">
            📦 <h3>No Products Found</h3>
            <p>Add your first product using the form.</p>
          </div>
        </td>
      </tr>
    `;
    return;
  }

  productList.forEach(product => {
    const front = product.frontImage || product.image || (product.images && product.images[0]) || "images/Product 1.jpeg";
    const back = product.backImage || product.secondaryImage || (product.images && product.images[1]) || front;
    const side = product.sideImage || (product.images && product.images[2]) || front;

    const avgRating = product.ratingsAverage || product.rating || 4.8;
    const revCount = product.ratingsCount || product.reviewsCount || 0;

    tbody.innerHTML += `
      <tr>
        <td>
          <div style="display:flex; gap:4px;">
            <img src="${front}" title="Front View" style="width:36px; height:36px; object-fit:cover; border-radius:4px; border:1px solid #38bdf8;" onerror="this.onerror=null; this.src='images/Product 1.jpeg';">
            <img src="${back}" title="Back View" style="width:36px; height:36px; object-fit:cover; border-radius:4px; border:1px solid #475569;" onerror="this.onerror=null; this.src='images/Product 1.jpeg';">
            <img src="${side}" title="Side View" style="width:36px; height:36px; object-fit:cover; border-radius:4px; border:1px solid #475569;" onerror="this.onerror=null; this.src='images/Product 1.jpeg';">
          </div>
        </td>
        <td>
          <div class="product-info">
            <h4 style="margin:0;">${product.name}</h4>
            <span style="color:#94a3b8; font-size:0.8rem;">${product.category}</span>
          </div>
        </td>
        <td><span class="price-tag" style="font-weight:700; color:#fbbf24;">₹${product.price}</span></td>
        <td><strong style="color:#f59e0b;">⭐ ${avgRating}</strong> <small style="color:#94a3b8;">(${revCount})</small></td>
        <td>${getPerSizeStockBadge(product)}</td>
        <td>
          <div style="display:flex; gap:6px;">
            <button class="edit-btn" onclick="editProduct('${product.id}')" style="background:#0284c7; color:white; border:none; padding:4px 8px; border-radius:4px; cursor:pointer;">✏ Edit</button>
            <button class="delete-btn" onclick="deleteProduct('${product.id}')" style="background:#ef4444; color:white; border:none; padding:4px 8px; border-radius:4px; cursor:pointer;">🗑 Delete</button>
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
    if (qty > 0) {
      details.push(`${sz}:${qty}`);
    }
  });

  const detailText = details.length > 0 ? details.join(", ") : `Total: ${total}`;
  return `<span class="stock-badge available" style="font-size:0.82rem; color:#22c55e; font-weight:700;">${total} units<br><small style="color:#94a3b8;">(${detailText})</small></span>`;
}

// Bind 3 Multi-Angle File Upload Readers
function setupAngleFileInput(angleKey, fileInputId, urlInputId) {
  const fileInput = document.getElementById(fileInputId);
  const urlInput = document.getElementById(urlInputId);

  if (fileInput) {
    fileInput.addEventListener("change", function (e) {
      const file = e.target.files[0];
      if (file) {
        const reader = new FileReader();
        reader.onload = function (evt) {
          imageDataUrls[angleKey] = evt.target.result;
          if (urlInput) urlInput.value = "";
          updatePreview();
        };
        reader.readAsDataURL(file);
      }
    });
  }

  if (urlInput) {
    urlInput.addEventListener("input", function () {
      imageDataUrls[angleKey] = "";
      updatePreview();
    });
  }
}

setupAngleFileInput("front", "product-image-file-front", "product-image-url-front");
setupAngleFileInput("back", "product-image-file-back", "product-image-url-back");
setupAngleFileInput("side", "product-image-file-side", "product-image-url-side");

// Live Preview Toggle for Admin
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
  const fileData = imageDataUrls[angleKey];
  const urlInput = document.getElementById(`product-image-url-${angleKey}`);
  const urlVal = urlInput ? urlInput.value.trim() : "";

  if (fileData) return fileData;
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

// Bind input change events
const nameInput = document.getElementById("product-name");
const priceInput = document.getElementById("product-price");
const categoryInput = document.getElementById("product-category");
const descriptionInput = document.getElementById("product-description");
const productForm = document.getElementById("product-form");

if (nameInput) nameInput.addEventListener("input", updatePreview);
if (priceInput) priceInput.addEventListener("input", updatePreview);
if (categoryInput) categoryInput.addEventListener("change", updatePreview);
if (descriptionInput) descriptionInput.addEventListener("input", updatePreview);

// Handle Form Submit
if (productForm) {
  productForm.addEventListener("submit", async function (e) {
    e.preventDefault();

    const name = nameInput ? nameInput.value.trim() : "";
    const price = priceInput ? Number(priceInput.value) : 0;
    const category = categoryInput ? categoryInput.value : "";
    const description = descriptionInput ? descriptionInput.value.trim() : "";

    // Read per-size stocks
    const sizeStock = {
      S: Math.max(0, Number(document.getElementById("size-stock-S")?.value || 0)),
      M: Math.max(0, Number(document.getElementById("size-stock-M")?.value || 0)),
      L: Math.max(0, Number(document.getElementById("size-stock-L")?.value || 0)),
      XL: Math.max(0, Number(document.getElementById("size-stock-XL")?.value || 0)),
      XXL: Math.max(0, Number(document.getElementById("size-stock-XXL")?.value || 0))
    };

    const totalStock = Object.values(sizeStock).reduce((a, b) => a + b, 0);
    const availableSizes = Object.keys(sizeStock).filter(s => sizeStock[s] > 0);

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

    const frontImg = getImageForAngle("front");
    const backImg = getImageForAngle("back");
    const sideImg = getImageForAngle("side");

    const saveBtn = productForm.querySelector("button[type='submit']");
    if (saveBtn) {
      saveBtn.disabled = true;
      saveBtn.textContent = "Saving Product...";
    }

    let createdId = editingProductId || ("PROD" + Date.now());

    const variantsPayload = ["S", "M", "L", "XL", "XXL"].map(s => ({
      size: s,
      color: "Default",
      sku: `${name.toLowerCase().replace(/[^a-z0-9]+/g, "-")}-${s}`,
      stock: sizeStock[s]
    }));

    const slug = name.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
    const productPayload = {
      name,
      title: name,
      slug,
      description: description || name,
      price,
      category: category || "T-Shirts",
      sizeStock,           // plain { S, M, L, XL, XXL } object
      variants: variantsPayload,
      stock: totalStock,
      sizes: availableSizes,
      image: frontImg,
      secondaryImage: backImg,
      frontImage: frontImg,
      backImage: backImg,
      sideImage: sideImg,
      images: [frontImg, backImg, sideImg]
    };

    try {
      let res;
      if (editingProductId) {
        // UPDATE existing product via PUT
        res = await API.put(`/products/${editingProductId}`, productPayload, { isAdmin: true });
      } else {
        // CREATE new product via POST
        res = await API.post('/products', productPayload, { isAdmin: true });
      }

      if (res && res.success && res.data) {
        const p = res.data.product || res.data;
        createdId = p._id || p.id || createdId;
        // Reload stock from server response to make sure sizeStock is fresh
        if (p.sizeStock) {
          const sizes = ['S', 'M', 'L', 'XL', 'XXL'];
          sizes.forEach(s => {
            const serverVal = Number((p.sizeStock instanceof Map ? Object.fromEntries(p.sizeStock) : p.sizeStock)[s]);
            if (!isNaN(serverVal)) sizeStock[s] = serverVal;
          });
        }
      }
    } catch (err) {
      console.warn("Backend API warning, saved product locally:", err.message);
    }

    const newProduct = {
      id: createdId,
      _id: createdId,
      name,
      price,
      category,
      stock: totalStock,
      sizeStock,
      sizes: availableSizes.length > 0 ? availableSizes : ["M"],
      image: frontImg,
      secondaryImage: backImg,
      frontImage: frontImg,
      backImage: backImg,
      sideImage: sideImg,
      images: [frontImg, backImg, sideImg],
      description,
      ratingsAverage: 5.0,
      ratingsCount: 1
    };

    if (editingProductId) {
      const idx = products.findIndex(p => String(p.id) === String(editingProductId));
      if (idx > -1) {
        products[idx] = { ...products[idx], ...newProduct };
      }
      editingProductId = null;
      if (typeof showToast === "function") showToast("✏ Product Updated Successfully!");
      else alert("✏ Product Updated Successfully!");
    } else {
      products.unshift(newProduct);
      if (typeof showToast === "function") showToast("🎉 Product Added Successfully!");
      else alert("🎉 Product Added Successfully!");
    }

    localStorage.setItem("products", JSON.stringify(products));
    renderProducts();

    // Reset Form & Preview
    productForm.reset();
    resetSizeStockInputs();
    imageDataUrls = { front: "", back: "", side: "" };
    const formTitle = document.getElementById("form-title");
    if (formTitle) formTitle.textContent = "➕ Add Product";
    if (saveBtn) {
      saveBtn.disabled = false;
      saveBtn.textContent = "💾 Save Product";
    }

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

  const front = product.frontImage || product.image || (product.images && product.images[0]) || "";
  const back = product.backImage || product.secondaryImage || (product.images && product.images[1]) || "";
  const side = product.sideImage || (product.images && product.images[2]) || "";

  const frontUrlInput = document.getElementById("product-image-url-front");
  const backUrlInput = document.getElementById("product-image-url-back");
  const sideUrlInput = document.getElementById("product-image-url-side");

  if (frontUrlInput) frontUrlInput.value = front.startsWith("data:") ? "" : front;
  if (backUrlInput) backUrlInput.value = back.startsWith("data:") ? "" : back;
  if (sideUrlInput) sideUrlInput.value = side.startsWith("data:") ? "" : side;

  imageDataUrls.front = front.startsWith("data:") ? front : "";
  imageDataUrls.back = back.startsWith("data:") ? back : "";
  imageDataUrls.side = side.startsWith("data:") ? side : "";

  if (descriptionInput) descriptionInput.value = product.description;

  const formTitle = document.getElementById("form-title");
  if (formTitle) formTitle.textContent = "✏ Edit Product";

  const saveBtn = productForm?.querySelector("button[type='submit']");
  if (saveBtn) saveBtn.textContent = "✏ Update Product";

  updatePreview();
  window.scrollTo({ top: 0, behavior: "smooth" });
}

async function deleteProduct(id) {
  if (!confirm("Are you sure you want to delete this product?")) return;

  try {
    await API.delete(`/products/${id}`, { isAdmin: true });
    if (typeof showToast === "function") showToast("🗑 Product Deleted");
  } catch (err) {
    console.warn("Product deleted locally");
  }

  products = products.filter(p => String(p.id) !== String(id));
  localStorage.setItem("products", JSON.stringify(products));
  renderProducts();
}

document.addEventListener("DOMContentLoaded", loadAdminProducts);