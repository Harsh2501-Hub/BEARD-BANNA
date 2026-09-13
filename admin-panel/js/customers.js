// ===============================
// ADMIN CUSTOMERS - REAL-TIME ORDER & PERMANENT DELETE SYNC
// ===============================

let customers = [];

async function loadAdminCustomers() {
  const localUsers = JSON.parse(localStorage.getItem("users")) || [];
  const localOrders = JSON.parse(localStorage.getItem("orders")) || [];
  const deletedCustomers = JSON.parse(localStorage.getItem("deleted_customers")) || [];
  
  // Filter out cancelled orders for accurate spending metrics
  const activeOrders = localOrders.filter(o => (o.status || "").toLowerCase() !== "cancelled");

  let combinedCustomers = [];

  // 1. Process local registered users
  localUsers.forEach(u => {
    const isDeleted = deletedCustomers.includes(String(u.id)) || (u.email && deletedCustomers.includes(u.email.toLowerCase()));
    if (!isDeleted) {
      const userOrders = activeOrders.filter(o => (
        (o.customer && typeof o.customer === "string" && o.customer.toLowerCase() === u.name.toLowerCase()) ||
        (o.email && o.email.toLowerCase() === u.email.toLowerCase())
      ));
      const spent = userOrders.reduce((sum, o) => sum + Number(o.total || o.grandTotal || 0), 0);

      combinedCustomers.push({
        id: u.id || String(Date.now()),
        name: u.name,
        email: u.email,
        phone: u.phone || "N/A",
        orders: userOrders.length,
        spent: spent,
        joined: u.joined || new Date().toLocaleDateString("en-IN"),
        status: u.status || "Active",
        address: userOrders[0]?.address || "Default Address"
      });
    }
  });

  // 2. Process orders from localStorage to capture any guest checkout users
  activeOrders.forEach(o => {
    const name = typeof o.customer === "string" ? o.customer : o.customer?.name;
    const email = o.email || o.customer?.email;

    if (name && email) {
      const isDeleted = deletedCustomers.includes(email.toLowerCase());
      if (!isDeleted && !combinedCustomers.some(c => c.email.toLowerCase() === email.toLowerCase())) {
        const userOrders = activeOrders.filter(ord => (
          (ord.email && ord.email.toLowerCase() === email.toLowerCase()) ||
          (ord.customer && typeof ord.customer === "string" && ord.customer.toLowerCase() === name.toLowerCase())
        ));
        const spent = userOrders.reduce((sum, ord) => sum + Number(ord.total || ord.grandTotal || 0), 0);

        combinedCustomers.push({
          id: String(Date.now()),
          name: name,
          email: email,
          phone: o.phone || o.customer?.phone || "N/A",
          orders: userOrders.length,
          spent: spent,
          joined: o.date || new Date().toLocaleDateString("en-IN"),
          status: "Active",
          address: o.address || "Order Address"
        });
      }
    }
  });

  customers = combinedCustomers;
  renderCustomers();
  updateCustomerStats();
  updateCustomerAnalytics();
}

function renderCustomers(filteredCustomers = customers) {
  const customersBody = document.getElementById("customers-body");
  if (!customersBody) return;

  let html = "";
  filteredCustomers.forEach(customer => {
    html += `
      <tr>
        <td>
          <div class="customer-name">
            <div class="customer-avatar">${customer.name ? customer.name.charAt(0).toUpperCase() : '👤'}</div>
            <span>${customer.name}</span>
          </div>
        </td>
        <td>${customer.email}</td>
        <td>${customer.phone}</td>
        <td>${customer.orders}</td>
        <td><span class="status ${customer.status ? customer.status.toLowerCase() : 'active'}">${customer.status || 'Active'}</span></td>
        <td>
          <div style="display:flex; gap:6px;">
            <button class="view-btn" onclick="viewCustomer('${customer.id}')">👁 View</button>
            <button class="block-btn ${customer.status === 'Active' ? 'danger' : 'success'}" onclick="toggleCustomerStatus('${customer.id}')">
              ${customer.status === "Active" ? "🚫 Block" : "✅ Unblock"}
            </button>
            <button class="delete-btn" onclick="deleteCustomer('${customer.id}')" style="background:#dc2626; color:white;">🗑 Delete</button>
          </div>
        </td>
      </tr>
    `;
  });

  if (filteredCustomers.length === 0) {
    html = `<tr><td colspan="6" class="empty-customers">❌ No customer records found.</td></tr>`;
  }

  customersBody.innerHTML = html;
}

function updateCustomerStats() {
  const totalEl = document.getElementById("customer-total");
  const activeEl = document.getElementById("customer-active");
  const blockedEl = document.getElementById("customer-blocked");
  const revEl = document.getElementById("customer-revenue");

  if (totalEl) totalEl.textContent = customers.length;
  if (activeEl) activeEl.textContent = customers.filter(c => c.status === "Active").length;
  if (blockedEl) blockedEl.textContent = customers.filter(c => c.status === "Blocked").length;
  if (revEl) {
    const revenue = customers.reduce((sum, c) => sum + (c.spent || 0), 0);
    revEl.textContent = "₹" + revenue.toLocaleString();
  }
}

function viewCustomer(id) {
  const customer = customers.find(c => String(c.id) === String(id));
  if (!customer) return;

  const detailsContainer = document.getElementById("customer-details");
  if (detailsContainer) {
    detailsContainer.innerHTML = `
      <div class="customer-info">
        <div><strong>Name:</strong> ${customer.name}</div>
        <div><strong>Email:</strong> ${customer.email}</div>
        <div><strong>Phone:</strong> ${customer.phone}</div>
        <div><strong>Orders:</strong> ${customer.orders}</div>
        <div><strong>Total Spent:</strong> ₹${(customer.spent || 0).toLocaleString()}</div>
        <div><strong>Status:</strong> ${customer.status}</div>
        <div><strong>Joined:</strong> ${customer.joined}</div>
        <div><strong>Address:</strong> ${customer.address}</div>
      </div>
    `;
  }

  const modal = document.getElementById("customer-modal");
  if (modal) modal.style.display = "flex";
}

function toggleCustomerStatus(id) {
  const customer = customers.find(c => String(c.id) === String(id));
  if (!customer) return;

  customer.status = customer.status === "Active" ? "Blocked" : "Active";
  
  // Persist status change to localStorage
  const localUsers = JSON.parse(localStorage.getItem("users")) || [];
  const idx = localUsers.findIndex(u => String(u.id) === String(id) || u.email === customer.email);
  if (idx > -1) {
    localUsers[idx].status = customer.status;
    localStorage.setItem("users", JSON.stringify(localUsers));
  }

  renderCustomers();
  updateCustomerStats();
  if (typeof showToast === "function") showToast(customer.status === "Active" ? "✅ Customer Unblocked" : "🚫 Customer Blocked");
}

async function deleteCustomer(id) {
  if (!confirm("Are you sure you want to permanently delete this customer account?")) return;

  const target = customers.find(c => String(c.id) === String(id));
  const email = target ? target.email : null;

  // 1. Add ID & Email to persistent deleted_customers registry
  const deletedCustomers = JSON.parse(localStorage.getItem("deleted_customers")) || [];
  if (id && !deletedCustomers.includes(String(id))) deletedCustomers.push(String(id));
  if (email && !deletedCustomers.includes(email.toLowerCase())) deletedCustomers.push(email.toLowerCase());
  localStorage.setItem("deleted_customers", JSON.stringify(deletedCustomers));

  // 2. Remove from localStorage.users
  let localUsers = JSON.parse(localStorage.getItem("users")) || [];
  localUsers = localUsers.filter(u => String(u.id) !== String(id) && (email ? u.email.toLowerCase() !== email.toLowerCase() : true));
  localStorage.setItem("users", JSON.stringify(localUsers));

  // 3. Try REST API Backend Delete
  try {
    await API.delete(`/users/${id}`, { isAdmin: true });
  } catch (err) {}

  // 4. Update in-memory array & re-render
  customers = customers.filter(c => String(c.id) !== String(id));
  renderCustomers();
  updateCustomerStats();
  updateCustomerAnalytics();

  if (typeof showToast === "function") showToast("🗑 Customer Permanently Deleted");
  else alert("Customer Permanently Deleted!");
}

function clearAllCustomers() {
  if (!confirm("⚠️ ARE YOU SURE? This will delete ALL customer records from test data!")) return;

  localStorage.removeItem("users");
  localStorage.removeItem("deleted_customers");
  customers = [];

  renderCustomers();
  updateCustomerStats();
  updateCustomerAnalytics();

  if (typeof showToast === "function") showToast("🗑 All customer records cleared!");
  else alert("All customer records cleared!");
}

function searchCustomers() {
  const searchInput = document.getElementById("customer-search");
  if (!searchInput) return;
  const search = searchInput.value.toLowerCase().trim();

  const filtered = customers.filter(c =>
    c.name.toLowerCase().includes(search) ||
    c.email.toLowerCase().includes(search) ||
    c.phone.includes(search)
  );
  renderCustomers(filtered);
}

function updateCustomerAnalytics() {
  const topEl = document.getElementById("top-customer");
  const avgEl = document.getElementById("average-spending");
  const avgOrdersEl = document.getElementById("average-orders");
  const newestEl = document.getElementById("newest-customer");

  if (customers.length === 0) {
    if (topEl) topEl.textContent = "--";
    if (avgEl) avgEl.textContent = "₹0";
    if (avgOrdersEl) avgOrdersEl.textContent = "0.0";
    if (newestEl) newestEl.textContent = "--";
    return;
  }

  const topCustomer = customers.reduce((a, b) => ((a.spent || 0) >= (b.spent || 0) ? a : b));
  if (topEl) topEl.textContent = topCustomer.spent > 0 ? topCustomer.name : "--";

  const totalSpent = customers.reduce((sum, c) => sum + (c.spent || 0), 0);
  if (avgEl) avgEl.textContent = "₹" + Math.round(totalSpent / customers.length).toLocaleString();

  const totalOrders = customers.reduce((sum, c) => sum + (c.orders || 0), 0);
  if (avgOrdersEl) avgOrdersEl.textContent = (totalOrders / customers.length).toFixed(1);

  if (newestEl) newestEl.textContent = customers[0].name;
}

window.deleteCustomer = deleteCustomer;
window.clearAllCustomers = clearAllCustomers;

const searchInputEl = document.getElementById("customer-search");
if (searchInputEl) searchInputEl.addEventListener("input", searchCustomers);

const closeModalBtn = document.querySelector(".close-modal");
if (closeModalBtn) {
  closeModalBtn.onclick = () => {
    const modal = document.getElementById("customer-modal");
    if (modal) modal.style.display = "none";
  };
}

window.onclick = function (event) {
  const modal = document.getElementById("customer-modal");
  if (event.target === modal) modal.style.display = "none";
};

document.addEventListener("DOMContentLoaded", loadAdminCustomers);