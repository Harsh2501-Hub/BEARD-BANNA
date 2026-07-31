// ===============================
// DUMMY CATEGORIES
// ===============================

let categories = [

    // ===============================
    // EDIT MODE
    // ===============================

    let editingCategoryId = null;

{

    id: 1,

        name: "Round Neck T-Shirts",

            products: 12,

                status: "Active",

                    image: "👕"

},

{

    id: 2,

        name: "Collar T-Shirts",

            products: 8,

                status: "Active",

                    image: "👔"

},

{

    id: 3,

        name: "Hoodies",

            products: 5,

                status: "Active",

                    image: "🧥"

}

];

// ===============================
// CATEGORY STATISTICS
// ===============================

function updateCategoryStats() {

    document.getElementById(

        "total-categories"

    ).textContent = categories.length;

    const totalProducts =

        categories.reduce(

            (sum, category) =>

                sum + category.products,

            0

        );

    document.getElementById(

        "category-products"

    ).textContent = totalProducts;

    const activeCategories =

        categories.filter(

            category => category.status === "Active"

        );

    document.getElementById(

        "active-categories"

    ).textContent = activeCategories.length;

    const largestCategory =

        categories.reduce(

            (a, b) =>

                a.products > b.products ? a : b

        );

    document.getElementById(

        "largest-category"

    ).textContent = largestCategory.name;

}

// ===============================
// RENDER CATEGORIES
// ===============================

function renderCategories(filteredCategories = categories) {

    const tbody =

        document.getElementById(

            "categories-body"

        );

    if (!tbody) return;

    let html = "";

    filteredCategories.forEach(category => {

        html += `

        <tr>

            <td>

                <div class="category-icon">

                    ${category.image}

                </div>

            </td>

            <td>

                ${category.name}

            </td>

            <td>

                ${category.products}

            </td>

            <td>

                <span class="status ${category.status.toLowerCase()}">

                    ${category.status}

                </span>

            </td>

            <td>

                <button

                    class="view-btn"

                    onclick="viewCategory(${category.id})">

                    👁 View

                </button>

                <button

                    class="edit-btn"

                    onclick="editCategory(${category.id})">

                    ✏ Edit

                </button>

                <button

                    class="delete-btn"

                    onclick="deleteCategory(${category.id})">

                    🗑

                </button>

            </td>

        </tr>

        `;

    });

    if (filteredCategories.length === 0) {

        html = `

        <tr>

            <td colspan="5"

                class="empty-categories">

                📂 No Categories Found

            </td>

        </tr>

        `;

    }

    tbody.innerHTML = html;

}

// ===============================
// TEMP FUNCTIONS
// ===============================

function addCategory() {

    const name =

        document.getElementById(

            "category-name"

        ).value.trim();

    const products = parseInt(

        document.getElementById(

            "category-products"

        ).value

    ) || 0;

    const icon =

        document.getElementById(

            "category-icon"

        ).value.trim();

    if (name === "") {

        showToast(

            "⚠ Enter Category Name"

        );

        return;

    }

    if (editingCategoryId !== null) {

        const category =

            categories.find(

                c => c.id === editingCategoryId

            );

        category.name = name;

        category.products = products;

        category.image = icon;

        editingCategoryId = null;

        showToast(

            "✏ Category Updated"

        );

    } else {

        categories.push({

            id: Date.now(),

            name,

            products,

            status: "Active",

            image: icon || "📂"

        });

        showToast(

            "✅ Category Added"

        );

    }

    renderCategories();

    updateCategoryStats();

    closeCategoryModal();

}

function viewCategory(id) {

    showToast(

        "👁 View Category"

    );

}

function editCategory(id) {

    const category =

        categories.find(

            c => c.id === id

        );

    if (!category) return;

    editingCategoryId = id;

    document.getElementById(

        "category-name"

    ).value = category.name;

    document.getElementById(

        "category-products"

    ).value = category.products;

    document.getElementById(

        "category-icon"

    ).value = category.image;

    openCategoryModal();

}

function deleteCategory(id) {

    const confirmDelete =

        confirm(

            "Delete this category?"

        );

    if (!confirmDelete) {

        return;

    }

    categories = categories.filter(

        category => category.id !== id

    );

    renderCategories();

    updateCategoryStats();

    showToast(

        "🗑 Category Deleted"

    );

}

// ===============================
// MODAL OPEN/CLOSE
// ===============================

const addCategoryBtn =

    document.getElementById(

        "add-category-btn"

    );

const categoryModal =

    document.getElementById(

        "category-modal"

    );

const closeCategoryModal =

    document.getElementById(

        "close-category-modal"

    );

if (addCategoryBtn) {

    addCategoryBtn.onclick = () => {

        categoryModal.style.display = "flex";

    };

}

if (closeCategoryModal) {

    closeCategoryModal.onclick = () => {

        categoryModal.style.display = "none";

    };

}

window.addEventListener("click", event => {

    if (event.target === categoryModal) {

        categoryModal.style.display = "none";

    }

});

// ===============================
// ADD CATEGORY
// ===============================

const categoryForm =

    document.getElementById(

        "category-form"

    );

if (categoryForm) {

    categoryForm.addEventListener("submit", event => {

        event.preventDefault();

        const newCategory = {

            id: Date.now(),

            name: document.getElementById("category-name").value,

            products: parseInt(

                document.getElementById("category-products-input").value

            ),

            status: "Active",

            image: document.getElementById("category-icon").value

        };

        categories.push(newCategory);

        updateCategoryStats();

        categoryModal.style.display = "none";

        categoryForm.reset();

        showToast("📂 Category Added");

        console.log(categories);

    });

}

renderCategories();

updateCategoryStats();