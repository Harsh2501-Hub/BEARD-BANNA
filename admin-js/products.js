// ===============================
// PRODUCT LIVE PREVIEW
// ===============================

const nameInput = document.getElementById("product-name");

const priceInput = document.getElementById("product-price");

const categoryInput = document.getElementById("product-category");

const imageInput = document.getElementById("product-image");

const descriptionInput = document.getElementById("product-description");

nameInput.addEventListener("input", updatePreview);

priceInput.addEventListener("input", updatePreview);

categoryInput.addEventListener("change", updatePreview);

imageInput.addEventListener(

    "change",

    previewSelectedImage

);

descriptionInput.addEventListener("input", updatePreview);

function updatePreview() {

    document.getElementById("preview-name").textContent =
        nameInput.value || "Product Name";

    document.getElementById("preview-price").textContent =
        "₹" + (priceInput.value || "0");

    document.getElementById("preview-category").textContent =
        categoryInput.value || "Category";

    document.getElementById("preview-description").textContent =
        descriptionInput.value || "Product description will appear here.";

}

// ===============================
// IMAGE PREVIEW
// ===============================

function previewSelectedImage() {

    const file = imageInput.files[0];

    if (!file) {

        return;

    }

    const reader = new FileReader();

    reader.onload = function (e) {

        document.getElementById(

            "preview-image"

        ).src = e.target.result;

    };

    reader.readAsDataURL(file);

}

// ===============================
// PRODUCT STORAGE
// ===============================

let products = JSON.parse(

    localStorage.getItem("products")

) || [];

// ===============================
// EDIT MODE
// ===============================

let editingProductId = null;

let currentEditingImage = "";

const productForm =

    document.getElementById("product-form");

productForm.addEventListener(

    "submit",

    saveProduct

);

function saveProduct(e) {

    e.preventDefault();

    const file = imageInput.files[0];

    const saveBtn =

        productForm.querySelector("button");

    saveBtn.disabled = true;

    saveBtn.textContent = "Saving...";

    if (!validateProduct(file)) {

        return;

    }

    // Editing without selecting a new image
    if (editingProductId && !file) {

        finishSaving(currentEditingImage);

        return;

    }

    // New product must have an image
    if (!editingProductId && !file) {

        showToast("📷 Please choose a product image.");

        return;
    }

    const reader = new FileReader();

    reader.onload = function (event) {

        finishSaving(event.target.result);

    };

    if (file) {

        reader.readAsDataURL(file);

    }

}

function finishSaving(imageData) {

    const product = {

        id: editingProductId || Date.now(),

        name: nameInput.value.trim(),

        price: Number(priceInput.value),

        category: categoryInput.value,

        stock: Number(

            document.getElementById("product-stock").value

        ),

        sizes: document

            .getElementById("product-sizes")

            .value

            .split(",")

            .map(size => size.trim()),

        image: imageData,

        description: descriptionInput.value

    };

    if (editingProductId) {

        const index = products.findIndex(

            p => p.id === editingProductId

        );

        products[index] = product;

        editingProductId = null;

        currentEditingImage = "";

    }

    else {

        products.push(product);

    }

    localStorage.setItem(

        "products",

        JSON.stringify(products)

    );

    if (isEditing) {

        showToast("✅ Product Updated");

    }
    else {

        showToast("🎉 Product Added");

    }

    renderProducts();

    productForm.reset();

    document.getElementById(

        "form-title"

    ).textContent =

        "➕ Add Product";

    resetPreview();

    productForm.querySelector(

        "button"

    ).textContent = "💾 Save Product";

    saveBtn.disabled = false;

    saveBtn.textContent = "💾 Save Product";

}

// ===============================
// PRODUCT VALIDATION
// ===============================

function validateProduct(file) {

    if (nameInput.value.trim().length < 3) {

        nameInput.classList.add("input-error");

        showToast("🏷 Product name must be at least 3 characters.");

        return false;

    }

    if (Number(priceInput.value) <= 0) {

        showToast("💰 Price must be greater than 0.");

        return false;

    }

    if (categoryInput.value === "") {

        alert("Please select a category.");

        return false;

    }

    const stock = Number(

        document.getElementById("product-stock").value

    );

    if (stock < 0) {

        alert("Stock cannot be negative.");

        return false;

    }

    const sizes = document

        .getElementById("product-sizes")

        .value

        .trim();

    if (sizes === "") {

        showToast("📏 Please enter at least one size.");

        return false;

    }

    if (descriptionInput.value.trim().length < 10) {

        showToast("📝 Description must be at least 10 characters.");

        return false;

    }

    if (!editingProductId && !file) {

        alert("Please choose a product image.");

        return false;

    }

    return true;

}

function renderProducts(productList = products) {

    const tbody =

        document.getElementById(

            "products-table-body"

        );

    tbody.innerHTML = "";

    if (productList.length === 0) {

        tbody.innerHTML = `

    <tr>

        <td colspan="7"

            style="text-align:center;
                   padding:30px;">

            <tbody>

<tr>

<td colspan="5">

<div class="empty-products">

📦

<h3>No Products Found</h3>

<p>

Add your first product to begin.

</p>

</div>

</td>

</tr>

</tbody>

        </td>

    </tr>

    `;

        return;

    }

    productList.forEach(product => {

        tbody.innerHTML += `

<tr>

    <td>

        <img
            src="${product.image}"
            class="product-thumbnail">

    </td>

    <td>

        <div class="product-info">

            <h4>${product.name}</h4>

            <span>${product.category}</span>

        </div>

    </td>

    <td>

        <span class="price-tag">

            ₹${product.price}

        </span>

    </td>

    <td>

        ${getStockBadge(product.stock)}

    </td>

    <td>

        <button
            class="edit-btn"
            onclick="editProduct(${product.id})">

            ✏

        </button>

        <button
            class="delete-btn"
            onclick="deleteProduct(${product.id})">

            🗑

        </button>

    </td>

</tr>

`;

    });

    document.getElementById(

        "product-count"

    ).textContent =

        `${productList.length} Products`;

}

function getStockBadge(stock) {

    if (stock === 0) {

        return `

        <span class="stock-badge out">

            Out of Stock

        </span>

        `;

    }

    if (stock <= 5) {

        return `

        <span class="stock-badge low">

            Low (${stock})

        </span>

        `;

    }

    return `

    <span class="stock-badge available">

        ${stock} In Stock

    </span>

    `;

}

function editProduct(id) {

    const product = products.find(

        p => p.id === id

    );

    if (!product) return;

    editingProductId = id;

    currentEditingImage = product.image;

    productForm.querySelector(

        "button"

    ).textContent = "✏ Update Product";

    nameInput.value = product.name;

    priceInput.value = product.price;

    categoryInput.value = product.category;

    imageInput.value = product.image;

    descriptionInput.value = product.description;

    document.getElementById("preview-image").src = product.image;

    imageInput.value = "";

    document.getElementById(

        "product-stock"

    ).value = product.stock;

    document.getElementById(

        "product-sizes"

    ).value = product.sizes.join(",");

    document.getElementById(

        "form-title"

    ).textContent =

        "✏ Edit Product";

    updatePreview();

    window.scrollTo({

        top: 0,

        behavior: "smooth"

    });

}

// ===============================
// DELETE PRODUCT
// ===============================

function deleteProduct(id) {

    const confirmDelete = confirm(

        "Are you sure you want to delete this product?"

    );

    if (!confirmDelete) {

        return;

    }

    products = products.filter(

        product => product.id !== id

    );

    localStorage.setItem(

        "products",

        JSON.stringify(products)

    );

    showToast("🗑 Product Deleted");

    renderProducts();

}

function resetPreview() {

    document.getElementById(

        "preview-name"

    ).textContent = "Product Name";

    document.getElementById(

        "preview-price"

    ).textContent = "₹0";

    document.getElementById(

        "preview-category"

    ).textContent = "Category";

    document.getElementById(

        "preview-description"

    ).textContent =

        "Product description will appear here.";

    document.getElementById(

        "preview-image"

    ).src =

        "../images/Product 1.jpeg";

    imageInput.value = "";

}

renderProducts();

// ===============================
// FILTER PRODUCTS
// ===============================

function filterProducts() {

    const search = document

        .getElementById("search-product")

        .value

        .toLowerCase();

    const category = document

        .getElementById("category-filter")

        .value;

    const filteredProducts = products.filter(product => {

        const matchesSearch = product.name

            .toLowerCase()

            .includes(search);

        const matchesCategory =

            category === "all" ||

            product.category === category;

        return matchesSearch && matchesCategory;

    });

    renderProducts(filteredProducts);

}

document

    .querySelectorAll(

        "#product-form input, #product-form textarea, #product-form select"

    )

    .forEach(field => {

        field.addEventListener("input", () => {

            field.classList.remove("input-error");

        });

    });

function showToast(message) {

    const toast = document.createElement("div");

    toast.className = "toast";

    toast.textContent = message;

    document.body.appendChild(toast);

    setTimeout(() => {

        toast.classList.add("show");

    }, 100);

    setTimeout(() => {

        toast.remove();

    }, 3000);

}