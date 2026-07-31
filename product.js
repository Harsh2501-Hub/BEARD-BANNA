const params = new URLSearchParams(window.location.search);

const id = Number(params.get("id"));

const product = products.find(p => p.id === id);

const container = document.getElementById("product-details");

container.innerHTML = `

<div class="product-page">

<img src="${product.image}" class="product-image-large">

<div class="product-info">

<h1>${product.name}</h1>

<h2>₹${product.price}</h2>

<p>${product.description}</p>

<label>Choose Size</label>

<select id="size">

${product.sizes.map(size => `
<option>${size}</option>
`).join("")}

</select>

<label>Quantity</label>

<input
type="number"
id="qty"
value="1"
min="1"
>

<br><br>

<button
class="cart-btn"
onclick="addProductToCart()">

Add To Cart

</button>

<button
class="view-btn"
onclick="buyNow()">

Buy Now

</button>

</div>

</div>

`;

function addProductToCart() {

    const size = document.getElementById("size").value;
    const qty = Number(document.getElementById("qty").value);

    let cart = JSON.parse(localStorage.getItem("cart")) || [];

    const existingItem = cart.find(item =>
        item.id === product.id && item.size === size
    );

    if (existingItem) {

        existingItem.qty += qty;

    } else {

        cart.push({
            ...product,
            size,
            qty
        });

    }

    localStorage.setItem("cart", JSON.stringify(cart));

    updateCartCount();

    showToast(product.name + " added to cart");
}