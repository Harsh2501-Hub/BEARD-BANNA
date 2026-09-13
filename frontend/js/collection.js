// ===============================
// COLLECTION PAGE - 3-ANGLE HOVER PREVIEW & BACKEND SYNCED
// ===============================

const productList = document.getElementById("product-list");
const searchInput = document.getElementById("search-input");
const clearSearch = document.getElementById("clear-search");
const resultText = document.getElementById("search-result-text");

function displayProducts(productArray) {
  if (!productList) return;
  productList.innerHTML = "";

  if (resultText) {
    resultText.innerHTML = `Collection Preview • ${productArray.length} Concept Piece${productArray.length !== 1 ? "s" : ""}`;
  }

  if (productArray.length === 0) {
    productList.innerHTML = `
      <div class="no-products">
        <div class="no-products-icon">😔</div>
        <h2>No Products Found</h2>
        <p>Try another keyword or browse our complete collection.</p>
      </div>
    `;
    return;
  }

  const wishlist = JSON.parse(localStorage.getItem("wishlist") || "[]");

  productArray.forEach(product => {
    const card = document.createElement("div");
    card.className = "product";
    const isWishlisted = wishlist.some(item => (item.id || item._id) === product.id);

    const frontImg = product.frontImage || product.image || (product.images && product.images[0]) || "images/Product 1.jpeg";
    const backImg = product.backImage || product.secondaryImage || (product.images && product.images[1]) || frontImg;

    card.innerHTML = `
      <div class="card-img-container" style="position:relative; overflow:hidden; border-radius:8px; cursor:pointer;" onclick="window.location.href='product.html?id=${product.id}'">
        <img src="${frontImg}" class="card-img-front" alt="${product.name}" onerror="this.onerror=null; this.src='images/Product 1.jpeg';" style="width:100%; height:320px; object-fit:cover; transition:transform 0.4s ease, opacity 0.3s ease;">
        ${backImg !== frontImg ? `
          <img src="${backImg}" class="card-img-back" alt="${product.name} Back" onerror="this.onerror=null; this.src='${frontImg}';" style="position:absolute; top:0; left:0; width:100%; height:320px; object-fit:cover; opacity:0; transition:opacity 0.4s ease, transform 0.4s ease;">
        ` : ''}
        <span class="concept-preview-badge">CONCEPT PREVIEW</span>
        <span class="view-angle-badge" style="position:absolute; top:8px; right:8px; background:rgba(15, 23, 42, 0.75); color:#fbbf24; font-size:0.7rem; font-weight:700; padding:3px 8px; border-radius:12px; backdrop-filter:blur(4px);">
          📸 3 Views
        </span>
      </div>

      <h3>${product.name}</h3>
      <p class="price">₹${product.price}</p>
      <p>${product.description || 'Premium royal Rajputana apparel.'}</p>
      
      <button class="view-btn" onclick="window.location.href='product.html?id=${product.id}'">
        View Details & Angles
      </button>
      <div class="product-actions">
        <button class="cart-btn" onclick="addToCart('${product.id}')">
          Add to Cart
        </button>
        <button class="wishlist-btn" id="wishlist-${product.id}" onclick="toggleWishlist('${product.id}')">
          ${isWishlisted ? "❤️" : "♡"}
        </button>
      </div>
    `;

    // Dynamic Hover Flip Setup
    const imgContainer = card.querySelector(".card-img-container");
    const backImgEl = card.querySelector(".card-img-back");
    const frontImgEl = card.querySelector(".card-img-front");

    if (imgContainer && backImgEl && frontImgEl) {
      imgContainer.addEventListener("mouseenter", () => {
        backImgEl.style.opacity = "1";
        backImgEl.style.transform = "scale(1.04)";
        frontImgEl.style.transform = "scale(1.04)";
      });

      imgContainer.addEventListener("mouseleave", () => {
        backImgEl.style.opacity = "0";
        backImgEl.style.transform = "scale(1)";
        frontImgEl.style.transform = "scale(1)";
      });
    }

    productList.appendChild(card);
  });
}

async function initCollection() {
  if (typeof fetchProductsFromAPI === "function") {
    const loadedProducts = await fetchProductsFromAPI();
    displayProducts(loadedProducts);
  } else {
    displayProducts(products);
  }
}

if (searchInput) {
  searchInput.addEventListener("input", function () {
    const keyword = this.value.toLowerCase().trim();

    if (clearSearch) {
      clearSearch.style.display = keyword === "" ? "none" : "block";
    }

    const filteredProducts = products.filter(product => {
      return (
        (product.name && product.name.toLowerCase().includes(keyword)) ||
        (product.description && product.description.toLowerCase().includes(keyword)) ||
        (product.category && product.category.toLowerCase().includes(keyword))
      );
    });

    displayProducts(filteredProducts);
  });
}

if (clearSearch) {
  clearSearch.addEventListener("click", function () {
    if (searchInput) searchInput.value = "";
    clearSearch.style.display = "none";
    displayProducts(products);
    if (searchInput) searchInput.focus();
  });
}

document.addEventListener("DOMContentLoaded", () => {
  initCollection();
  if (searchInput) searchInput.focus();
});