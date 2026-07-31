// Get Elements
const productList = document.getElementById("product-list");
const searchInput = document.getElementById("search-input");
const clearSearch = document.getElementById("clear-search");
const resultText =
    document.getElementById("search-result-text");

// Generate all product cards
function displayProducts(productArray) {

    productList.innerHTML = "";

    if (resultText) {

        resultText.innerHTML =
            `Showing ${productArray.length} Product${productArray.length != 1 ? "s" : ""}`;

    }

    // No Products Found
    if (productArray.length === 0) {

        productList.innerHTML = `

<div class="no-products">

    <div class="no-products-icon">

        😔

    </div>

    <h2>No Products Found</h2>

    <p>

        Try another keyword or browse our complete collection.

    </p>

</div>

`;

        return;

    }

    productArray.forEach(product => {

        const card = document.createElement("div");

        card.className = "product";

        card.innerHTML = `

<img src="${product.image}" alt="${product.name}">

<h3>${product.name}</h3>

<p class="price">₹${product.price}</p>

<p>${product.description}</p>

<button class="view-btn"
onclick="window.location.href='product.html?id=${product.id}'">

View Product

</button>

<div class="product-actions">

<button class="cart-btn"
onclick="addToCart(${product.id})">

Add to Cart

</button>

<button
class="wishlist-btn"
id="wishlist-${product.id}"
onclick="toggleWishlist(${product.id})">

${JSON.parse(localStorage.getItem("wishlist") || "[]")
                .some(item => item.id === product.id)

                ? "❤️"

                : "♡"}

</button>

</div>

`;

        productList.appendChild(card);

    });

}

// First Load
displayProducts(products);

// =========================
// LIVE SEARCH
// =========================

searchInput.addEventListener("input", function () {

    const keyword = this.value
        .toLowerCase()
        .trim();

    if (keyword === "") {

        clearSearch.style.display = "none";

    }

    else {

        clearSearch.style.display = "block";

    }

    const filteredProducts = products.filter(product => {

        return (

            product.name
                .toLowerCase()
                .includes(keyword)

            ||

            product.description
                .toLowerCase()
                .includes(keyword)

            ||

            product.category
                .toLowerCase()
                .includes(keyword)

        );

    });

    displayProducts(filteredProducts);

});

// =========================
// CLEAR SEARCH
// =========================

clearSearch.addEventListener("click", function () {

    searchInput.value = "";

    clearSearch.style.display = "none";

    displayProducts(products);

    searchInput.focus();

});

window.addEventListener("load", () => {

    searchInput.focus();

});