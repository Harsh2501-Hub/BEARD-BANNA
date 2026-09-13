// ===============================
// BEARD BANNA WISHLIST SYSTEM - BACKEND CONNECTED
// ===============================

let wishlist = JSON.parse(localStorage.getItem("wishlist")) || [];

function saveWishlist() {
  localStorage.setItem("wishlist", JSON.stringify(wishlist));
  updateWishlistCount();
}

function updateWishlistCount() {
  const count = document.getElementById("wishlist-count");
  if (!count) return;
  const latestWishlist = JSON.parse(localStorage.getItem("wishlist")) || [];
  count.innerHTML = latestWishlist.length;
}

async function toggleWishlist(productId) {
  if (typeof fetchProductsFromAPI === "function") {
    await fetchProductsFromAPI();
  }

  const product = products.find(p => String(p.id) === String(productId));
  const button = document.getElementById("wishlist-" + productId);

  if (button) {
    if (button.disabled) return;
    button.disabled = true;
    setTimeout(() => { button.disabled = false; }, 300);
  }

  const exists = wishlist.find(item => String(item.id) === String(productId));

  if (exists) {
    wishlist = wishlist.filter(item => String(item.id) !== String(productId));
    if (button) button.innerHTML = "🤍";
    if (typeof showToast === "function") showToast((product?.name || "Product") + " removed from wishlist");
  } else if (product) {
    wishlist.push({
      ...product,
      addedAt: Date.now()
    });
    if (button) {
      button.innerHTML = "❤️";
      button.classList.add("wishlist-pop");
      setTimeout(() => { button.classList.remove("wishlist-pop"); }, 300);
    }
    createHeartAnimation();
    if (typeof showToast === "function") showToast(product.name + " added to wishlist");
  }

  saveWishlist();

  const token = API.getToken();
  if (token && productId) {
    try {
      await API.post(`/users/wishlist/${productId}`, {});
    } catch (err) {
      console.warn("Failed to sync wishlist to backend:", err.message);
    }
  }
}

async function syncWishlistWithBackend() {
  const token = API.getToken();
  if (!token) return;

  try {
    const res = await API.get('/users/wishlist');
    if (res.success && Array.isArray(res.data?.wishlist)) {
      const serverWishlist = res.data.wishlist.map(p => ({
        id: p._id || p.id,
        name: p.title || p.name,
        price: p.price,
        image: Array.isArray(p.images) && p.images.length > 0 ? p.images[0] : 'images/Product 1.jpeg',
        description: p.description || '',
        category: p.category?.name || p.category || 'T-Shirts',
        addedAt: Date.now()
      }));
      if (serverWishlist.length > 0) {
        wishlist = serverWishlist;
        saveWishlist();
        if (typeof displayWishlist === "function") displayWishlist();
      }
    }
  } catch (err) {
    console.warn("Using local wishlist cache");
  }
}

function removeWishlist(index) {
  const product = wishlist[index];
  wishlist.splice(index, 1);
  saveWishlist();
  if (typeof displayWishlist === "function") displayWishlist();
  if (typeof showToast === "function") showToast((product?.name || "Item") + " removed from wishlist ❤️");
}

function moveToCart(productId) {
  if (typeof addToCart === "function") {
    addToCart(productId);
  }
  wishlist = wishlist.filter(item => String(item.id) !== String(productId));
  saveWishlist();
  if (typeof displayWishlist === "function") displayWishlist();
  const product = products.find(p => String(p.id) === String(productId));
  if (typeof showToast === "function") showToast((product?.name || "Item") + " moved to cart 🛒");
}

function createHeartAnimation() {
  const heart = document.createElement("div");
  heart.className = "floating-heart";
  heart.innerHTML = "❤️";
  document.body.appendChild(heart);
  setTimeout(() => { heart.remove(); }, 1000);
}

document.addEventListener("DOMContentLoaded", () => {
  updateWishlistCount();
  syncWishlistWithBackend();
});