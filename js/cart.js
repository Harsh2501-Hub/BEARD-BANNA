// ----------------------
// CART STORAGE
// ----------------------

let cart = JSON.parse(localStorage.getItem("cart")) || [];

// ----------------------
// ADD TO CART
// ----------------------

function addToCart(productId) {

    const product = products.find(p => p.id === productId);

    const item = {
        ...product,
        qty: 1,
        size: "M"
    };

    cart.push(item);

    saveCart();

    alert(product.name + " added to cart!");
}

// ----------------------
// SAVE
// ----------------------

function saveCart() {

    localStorage.setItem("cart", JSON.stringify(cart));

}

// ----------------------
// DISPLAY CART
// ----------------------

function displayCart() {

    const container = document.getElementById("cart-items");

    if (!container) return;

    let total = 0;

    container.innerHTML = "";

    if (cart.length === 0) {

        container.innerHTML = "<h2>Your cart is empty.</h2>";

        document.getElementById("grand-total").innerHTML = "";

        return;

    }

    cart.forEach((item, index) => {

        total += item.price * item.qty;

        container.innerHTML += `

<div class="cart-card">

<img src="${item.image}">

<div class="cart-info">

<h3>${item.name}</h3>

<p>Price : ₹${item.price}</p>

<p>Size : ${item.size}</p>

<p>Quantity : ${item.qty}</p>

<p><b>Total : ₹${item.price * item.qty}</b></p>

<button onclick="removeItem(${index})">

Remove

</button>

</div>

</div>

`;

    });

    document.getElementById("grand-total").innerHTML =

        `Grand Total : ₹${total}`;

}

// ----------------------
// REMOVE
// ----------------------

function removeItem(index) {

    cart.splice(index, 1);

    saveCart();

    displayCart();

    updateCartCount();

}

// ----------------------
// CART COUNT
// ----------------------

function updateCartCount() {

    const cartCount = document.getElementById("cart-count");

    if (cartCount) {

        cartCount.innerHTML = cart.length;

    }

}

displayCart();

updateCartCount();