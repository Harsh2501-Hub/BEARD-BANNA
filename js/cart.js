// ===============================
// BEARD BANNA CART SYSTEM
// ===============================

// Load cart from localStorage
let cart = JSON.parse(localStorage.getItem("cart")) || [];

// ----------------------------
// Save Cart
// ----------------------------
function saveCart() {

    localStorage.setItem("cart", JSON.stringify(cart));

    updateCartCount();

}

// ----------------------------
// Update Cart Count
// ----------------------------
function updateCartCount() {

    const cartCount = document.getElementById("cart-count");

    if (!cartCount) return;

    // Always read the latest cart
    const latestCart = JSON.parse(localStorage.getItem("cart")) || [];

    cartCount.textContent = latestCart.length;

}

// ----------------------------
// Add Product
// ----------------------------
function addToCart(productId) {

    const product = products.find(p => p.id === productId);

    // Check if same product with same size already exists
    const existingItem = cart.find(item =>
        item.id === productId && item.size === "M"
    );

    if (existingItem) {

        existingItem.qty++;

    } else {

        cart.push({
            ...product,
            qty: 1,
            size: "M"
        });

    }

    saveCart();

    showToast(product.name + " added to cart");
}

// ----------------------------
// Remove Product
// ----------------------------
function removeItem(index) {

    cart.splice(index, 1);

    saveCart();

    displayCart();

    updateCartCount();

}

// ----------------------------
// Display Cart
// ----------------------------
function displayCart() {

    const container = document.getElementById("cart-items");

    if (!container) return;

    container.innerHTML = "";

    let total = 0;

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

<p>₹${item.price}</p>

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

// ----------------------------
// Toast Message
// ----------------------------
function showToast(message) {

    const toast = document.createElement("div");

    toast.className = "toast";

    toast.innerText = message;

    document.body.appendChild(toast);

    setTimeout(() => {

        toast.classList.add("show");

    }, 100);

    setTimeout(() => {

        toast.remove();

    }, 2500);

}

// ----------------------------

displayCart();

updateCartCount();

window.addEventListener("cartUpdated", updateCartCount);

window.addEventListener("storage", () => {

    if (typeof updateWishlistCount === "function") {

        updateWishlistCount();

    }

});

// ----------------------------
// GO TO CHECKOUT
// ----------------------------

function goToCheckout() {

    if (cart.length === 0) {

        alert("Your cart is empty!");

        return;

    }

    window.location.href = "checkout.html";

}