// ===============================
// BEARD BANNA WISHLIST SYSTEM
// ===============================

let wishlist =
    JSON.parse(localStorage.getItem("wishlist")) || [];

// Save Wishlist
function saveWishlist() {

    localStorage.setItem(
        "wishlist",
        JSON.stringify(wishlist)
    );

    updateWishlistCount();

}

// Update Wishlist Count
function updateWishlistCount() {

    const count =
        document.getElementById("wishlist-count");

    if (!count) return;

    const latestWishlist =
        JSON.parse(localStorage.getItem("wishlist")) || [];

    count.innerHTML =
        latestWishlist.length;

}

// Add / Remove Wishlist
function toggleWishlist(productId) {

    const product =
        products.find(p => p.id === productId);

    const button =
        document.getElementById(
            "wishlist-" + productId
        );

    if (button.disabled) return;

    button.disabled = true;

    setTimeout(() => {

        button.disabled = false;

    }, 300);

    const exists =
        wishlist.find(item => item.id === productId);

    if (exists) {

        wishlist =
            wishlist.filter(item =>
                item.id !== productId
            );

        button.innerHTML = "🤍";

        showToast(product.name + " removed from wishlist");

    }

    else {

        wishlist.push({

            ...product,

            addedAt: Date.now()

        });

        button.innerHTML = "❤️";

        button.classList.add("wishlist-pop");

        setTimeout(() => {

            button.classList.remove("wishlist-pop");

        }, 300);

        createHeartAnimation();

        showToast(product.name + " added to wishlist");

    }

    saveWishlist();

    updateWishlistCount();

}

updateWishlistCount();

function removeWishlist(index) {

    const product = wishlist[index];

    wishlist.splice(index, 1);

    saveWishlist();

    displayWishlist();

    updateWishlistCount();

    showToast(product.name + " removed from wishlist ❤️");

}

function moveToCart(productId) {

    addToCart(productId);

    wishlist =
        wishlist.filter(item => item.id !== productId);

    saveWishlist();

    displayWishlist();

    updateWishlistCount();

    updateCartCount();

    const product =
        products.find(p => p.id === productId);

    showToast(product.name + " moved to cart 🛒");

}

function createHeartAnimation() {

    const heart = document.createElement("div");

    heart.className = "floating-heart";

    heart.innerHTML = "❤️";

    document.body.appendChild(heart);

    setTimeout(() => {

        heart.remove();

    }, 1000);

}