console.log("Wishlist Page Loaded");

console.log(
    JSON.parse(localStorage.getItem("wishlist"))
);

const container =
    document.getElementById("wishlist-items");

let wishlist =
    JSON.parse(localStorage.getItem("wishlist")) || [];

// Show newest first
wishlist.sort((a, b) => b.addedAt - a.addedAt);

displayWishlist();

function displayWishlist() {

    container.innerHTML = "";

    // Empty Wishlist
    if (wishlist.length === 0) {

        container.innerHTML = `

<div class="empty-message">

    <div class="wishlist-empty-icon">
        🤍
    </div>

    <h2>Your Wishlist is Empty</h2>

    <p>
        Save products you love and they'll appear here.
    </p>

    <a href="collection.html" class="collection-btn">
        Explore Collection
    </a>

</div>

`;

        return;
    }

    // Display Wishlist Products
    wishlist.forEach((item, index) => {

        container.innerHTML += `

<div class="wishlist-card fade-card">

    <img src="${item.image}" alt="${item.name}">

    <div class="wishlist-info">

        <h3>${item.name}</h3>

        <p>₹${item.price}</p>

        <p>${item.description}</p>

        <button
            class="cart-btn"
            onclick="moveToCart(${item.id})">

            Move To Cart

        </button>

        <button
            class="view-btn"
            onclick="removeWishlist(${index})">

            Remove

        </button>

    </div>

</div>

`;

    });

}