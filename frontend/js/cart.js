// ===============================
// BEARD BANNA CART SYSTEM - STRICT STOCK LIMITS
// ===============================

let cart = JSON.parse(localStorage.getItem("cart")) || [];

// Save Cart to LocalStorage
async function saveCart() {
  localStorage.setItem("cart", JSON.stringify(cart));
  updateCartCount();
}

// Sync cart with backend API if logged in
async function syncCartWithBackend() {
  const token = API.getToken();
  if (!token) return;

  try {
    const res = await API.get('/cart');
    if (res.success && res.data?.cart?.items) {
      const serverItems = res.data.cart.items.map(item => ({
        id: item.product?._id || item.product,
        name: item.product?.title || item.title || 'Product',
        price: item.price,
        image: item.product?.images?.[0] || item.image || 'images/Product 1.jpeg',
        size: item.size || 'M',
        qty: item.quantity,
        cartItemId: item._id
      }));
      if (serverItems.length > 0) {
        cart = serverItems;
        localStorage.setItem("cart", JSON.stringify(cart));
        updateCartCount();
        displayCart();
      }
    }
  } catch (err) {
    console.warn("Using local cart cache");
  }
}

// Update Cart Count UI
function updateCartCount() {
  const cartCount = document.getElementById("cart-count");
  if (!cartCount) return;
  const latestCart = JSON.parse(localStorage.getItem("cart")) || [];
  cartCount.textContent = latestCart.reduce((total, item) => total + (item.qty || 1), 0);
}

// Add Product to Cart with Stock Limits
async function addToCart(productId, size = "M", qty = 1) {
  // Support both (productId, size, qty) and (productId, qty, size) parameter signatures
  if (typeof size === "number") {
    const tempQty = size;
    const tempSize = typeof qty === "string" ? qty : "M";
    qty = tempQty;
    size = tempSize;
  }
  if (!size || typeof size !== "string") size = "M";
  if (!qty || isNaN(qty) || qty < 1) qty = 1;

  if (typeof fetchProductsFromAPI === "function") {
    await fetchProductsFromAPI();
  }

  let product = products.find(p => String(p.id) === String(productId) || String(p._id) === String(productId));

  if (!product && typeof window !== "undefined" && window.currentProduct && (String(window.currentProduct.id) === String(productId) || String(window.currentProduct._id) === String(productId))) {
    product = window.currentProduct;
  }

  if (!product && typeof window !== "undefined" && window.currentProduct) {
    product = window.currentProduct;
  }

  if (!product) {
    console.warn("Product not found:", productId);
    return;
  }

  if (!products.some(p => String(p.id) === String(product.id))) {
    products.push(product);
  }

  const availableStock = typeof product.stock === 'number' ? product.stock : 50;

  if (availableStock === 0) {
    if (typeof showToast === "function") showToast("⚠️ Sorry, this product is out of stock!");
    else alert("⚠️ Sorry, this product is out of stock!");
    return;
  }

  const existingItem = cart.find(item => String(item.id) === String(productId) && item.size === size);

  if (existingItem) {
    const newQty = existingItem.qty + qty;
    if (newQty > availableStock) {
      existingItem.qty = availableStock;
      if (typeof showToast === "function") {
        showToast(`⚠️ Stock limit reached! Only ${availableStock} items in stock.`);
      } else {
        alert(`⚠️ Stock limit reached! Only ${availableStock} items in stock.`);
      }
    } else {
      existingItem.qty = newQty;
      if (typeof showToast === "function") showToast(product.name + " updated in cart");
    }
  } else {
    const finalQty = Math.min(qty, availableStock);
    cart.push({
      ...product,
      size,
      qty: finalQty
    });
    if (typeof showToast === "function") showToast(product.name + " added to cart");
  }

  saveCart();

  const token = API.getToken();
  if (token) {
    try {
      await API.post('/cart', {
        productId: product.id,
        size,
        color: 'Default',
        quantity: Math.min(qty, availableStock)
      });
    } catch (err) {
      console.warn("Failed to sync item addition to backend cart:", err.message);
    }
  }
}

// Remove Product from Cart
async function removeItem(index) {
  const item = cart[index];
  cart.splice(index, 1);
  saveCart();
  displayCart();
  updateCartCount();

  const token = API.getToken();
  if (token && item?.cartItemId) {
    try {
      await API.delete(`/cart/${item.cartItemId}`);
    } catch (err) {
      console.warn("Failed to sync item deletion with backend cart");
    }
  }
}

// Display Cart UI
function displayCart() {
  const container = document.getElementById("cart-items");
  if (!container) return;

  container.innerHTML = "";
  let total = 0;

  if (cart.length === 0) {
    container.innerHTML = "<h2>Your cart is empty.</h2>";
    const grandTotalEl = document.getElementById("grand-total");
    if (grandTotalEl) grandTotalEl.innerHTML = "";
    return;
  }

  cart.forEach((item, index) => {
    total += item.price * (item.qty || 1);
    const displayImg = item.image || "images/Product 1.jpeg";

    container.innerHTML += `
      <div class="cart-card">
        <img src="${displayImg}" onerror="this.onerror=null; this.src='images/Product 1.jpeg';">
        <div class="cart-info">
          <h3>${item.name}</h3>
          <p>₹${item.price}</p>
          <p>Size : ${item.size}</p>
          <p>Quantity : ${item.qty}</p>
          <p><b>Total : ₹${item.price * (item.qty || 1)}</b></p>
          <button onclick="removeItem(${index})">Remove</button>
        </div>
      </div>
    `;
  });

  const grandTotalEl = document.getElementById("grand-total");
  if (grandTotalEl) {
    grandTotalEl.innerHTML = `Grand Total : ₹${total}`;
  }
}

function goToCheckout() {
  if (cart.length === 0) {
    alert("Your cart is empty!");
    return;
  }
  window.location.href = "checkout.html";
}

document.addEventListener("DOMContentLoaded", () => {
  displayCart();
  updateCartCount();
  syncCartWithBackend();
});