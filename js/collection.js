// Get the container where products will be displayed
const productList = document.getElementById("product-list");

// Generate all product cards
products.forEach(product => {

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

        <button class="cart-btn"
            onclick="addToCart(${product.id})">
            Add to Cart
        </button>
    `;

    productList.appendChild(card);

});