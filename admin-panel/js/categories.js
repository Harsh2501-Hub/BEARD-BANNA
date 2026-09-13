// ===============================
// ADMIN CATEGORIES - REAL-TIME DYNAMIC PRODUCT COUNT & STATS
// ===============================

let editingCategoryId = null;
let categories = [];

async function loadAdminCategories() {
  const localProducts = JSON.parse(localStorage.getItem("products")) || [];

  let loadedCats = [];
  try {
    const res = await API.get('/categories');
    if (res.success && Array.isArray(res.data?.categories)) {
      loadedCats = res.data.categories.map(c => ({
        id: c._id || c.id,
        _id: c._id,
        name: c.name,
        status: "Active",
        image: getCategoryIcon(c.name)
      }));
    }
  } catch (err) {
    console.warn("Using default category list");
  }

  if (loadedCats.length === 0) {
    loadedCats = [
      { id: "1", name: "Round Neck T-Shirts", status: "Active", image: "👕" },
      { id: "2", name: "Collar T-Shirts", status: "Active", image: "👔" },
      { id: "3", name: "Hoodies", status: "Active", image: "🧥" },
      { id: "4", name: "Jeans & Denim", status: "Active", image: "👖" }
    ];
  }

  // Dynamically count real products belonging to each category
  categories = loadedCats.map(cat => {
    const matchingProductsCount = localProducts.filter(p => (
      (p.category && p.category.toLowerCase() === cat.name.toLowerCase()) ||
      (p.category?.name && p.category.name.toLowerCase() === cat.name.toLowerCase())
    )).length;

    return {
      ...cat,
      products: matchingProductsCount
    };
  });

  renderCategories();
  updateCategoryStats();
}

function getCategoryIcon(name) {
  const n = (name || "").toLowerCase();
  if (n.includes("round") || n.includes("t-shirt")) return "👕";
  if (n.includes("collar") || n.includes("polo")) return "👔";
  if (n.includes("hoodie") || n.includes("jacket")) return "🧥";
  if (n.includes("jeans") || n.includes("pant") || n.includes("denim")) return "👖";
  if (n.includes("cap")) return "🧢";
  return "📂";
}

function updateCategoryStats() {
  const totalEl = document.getElementById("total-categories");
  const productsEl = document.getElementById("category-products");
  const activeEl = document.getElementById("active-categories");
  const largestEl = document.getElementById("largest-category");

  const totalProds = categories.reduce((sum, c) => sum + (c.products || 0), 0);

  if (totalEl) totalEl.textContent = categories.length;
  if (productsEl) productsEl.textContent = totalProds;
  if (activeEl) activeEl.textContent = categories.filter(c => c.status === "Active").length;

  if (largestEl) {
    if (categories.length === 0 || totalProds === 0) {
      largestEl.textContent = "--";
    } else {
      const topCat = [...categories].sort((a, b) => (b.products || 0) - (a.products || 0))[0];
      largestEl.textContent = topCat.products > 0 ? topCat.name : "--";
    }
  }
}

function renderCategories(filteredCategories = categories) {
  const tbody = document.getElementById("categories-body");
  if (!tbody) return;

  let html = "";
  filteredCategories.forEach(category => {
    html += `
      <tr>
        <td><div class="category-icon" style="font-size:1.4rem;">${category.image || "📂"}</div></td>
        <td><b>${category.name}</b></td>
        <td><strong>${category.products || 0}</strong> item(s)</td>
        <td><span class="status ${category.status ? category.status.toLowerCase() : 'active'}">${category.status || "Active"}</span></td>
        <td>
          <div style="display:flex; gap:6px;">
            <button class="view-btn" onclick="viewCategory('${category.id}')">👁 View</button>
            <button class="edit-btn" onclick="editCategory('${category.id}')">✏ Edit</button>
            <button class="delete-btn" onclick="deleteCategory('${category.id}')" style="background:#dc2626; color:white;">🗑 Delete</button>
          </div>
        </td>
      </tr>
    `;
  });

  if (filteredCategories.length === 0) {
    html = `<tr><td colspan="5" class="empty-categories" style="text-align:center; padding:20px; color:#94a3b8;">📂 No Categories Found</td></tr>`;
  }

  tbody.innerHTML = html;
}

async function addCategory() {
  const nameInput = document.getElementById("category-name");
  const iconInput = document.getElementById("category-icon");

  const name = nameInput ? nameInput.value.trim() : "";
  const icon = iconInput ? iconInput.value.trim() : "📂";

  if (!name) {
    if (typeof showToast === "function") showToast("⚠ Enter Category Name");
    else alert("Enter Category Name");
    return;
  }

  if (editingCategoryId) {
    const cat = categories.find(c => String(c.id) === String(editingCategoryId));
    if (cat) {
      cat.name = name;
      cat.image = icon;
    }
    editingCategoryId = null;
    if (typeof showToast === "function") showToast("✏ Category Updated");
  } else {
    const slug = name.toLowerCase().replace(/\s+/g, '-');
    let newId = String(Date.now());
    try {
      const res = await API.post('/categories', { name, slug, description: `${name} category` }, { isAdmin: true });
      if (res.success && res.data?.category) {
        newId = res.data.category._id || res.data.category.id;
      }
    } catch (err) {
      console.warn("Category created locally");
    }

    categories.push({
      id: newId,
      name,
      products: 0,
      status: "Active",
      image: icon || "📂"
    });
    if (typeof showToast === "function") showToast("✅ Category Added");
  }

  renderCategories();
  updateCategoryStats();

  const modal = document.getElementById("category-modal");
  if (modal) modal.style.display = "none";
}

function viewCategory(id) {
  const cat = categories.find(c => String(c.id) === String(id));
  if (cat && typeof showToast === "function") showToast(`👁 Category: ${cat.name} (${cat.products} products)`);
}

function editCategory(id) {
  const category = categories.find(c => String(c.id) === String(id));
  if (!category) return;

  editingCategoryId = id;
  const nameEl = document.getElementById("category-name");
  const iconEl = document.getElementById("category-icon");

  if (nameEl) nameEl.value = category.name;
  if (iconEl) iconEl.value = category.image;

  const modal = document.getElementById("category-modal");
  if (modal) modal.style.display = "flex";
}

async function deleteCategory(id) {
  if (!confirm("Delete this category?")) return;

  try {
    await API.delete(`/categories/${id}`, { isAdmin: true });
    if (typeof showToast === "function") showToast("🗑 Category Deleted");
  } catch (err) {
    console.warn("Category deleted locally");
  }

  categories = categories.filter(c => String(c.id) !== String(id));
  renderCategories();
  updateCategoryStats();
}

const addCategoryBtn = document.getElementById("add-category-btn");
const categoryModal = document.getElementById("category-modal");
const closeCategoryModal = document.getElementById("close-category-modal");

if (addCategoryBtn) {
  addCategoryBtn.onclick = () => {
    editingCategoryId = null;
    const nameEl = document.getElementById("category-name");
    if (nameEl) nameEl.value = "";
    if (categoryModal) categoryModal.style.display = "flex";
  };
}

if (closeCategoryModal) {
  closeCategoryModal.onclick = () => {
    if (categoryModal) categoryModal.style.display = "none";
  };
}

window.addEventListener("click", event => {
  if (event.target === categoryModal) {
    categoryModal.style.display = "none";
  }
});

document.addEventListener("DOMContentLoaded", loadAdminCategories);