// ===============================
// WISHLIST PAGE DISPLAY
// ===============================

function displayWishlist() {
  const container = document.getElementById("wishlist-items");
  if (!container) return;

  let localWishlist = JSON.parse(localStorage.getItem("wishlist")) || [];
  container.innerHTML = "";

  if (localWishlist.length === 0) {
    container.innerHTML = `
      <div class="empty-message">
        <div class="wishlist-empty-icon">🤍</div>
        <h2>Your Wishlist is Empty</h2>
        <p>Save products you love and they'll appear here.</p>
        <a href="collection.html" class="collection-btn">Explore Collection</a>
      </div>
    `;
    return;
  }

  localWishlist.forEach((item, index) => {
    container.innerHTML += `
      <div class="wishlist-card fade-card">
        <img src="${item.image}" alt="${item.name}">
        <div class="wishlist-info">
          <h3>${item.name}</h3>
          <p>₹${item.price}</p>
          <p>${item.description || ''}</p>
          <button class="cart-btn" onclick="moveToCart('${item.id}')">
            Move To Cart
          </button>
          <button class="view-btn" onclick="removeWishlist(${index})">
            Remove
          </button>
        </div>
      </div>
    `;
  });
}

document.addEventListener("DOMContentLoaded", displayWishlist);