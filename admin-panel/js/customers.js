// ===============================
// ADMIN CUSTOMERS - SUPABASE PROFILES & LIVE ORDERS
// ===============================

let customers = [];

async function loadAdminCustomers() {
  const tbody = document.getElementById("customers-body");
  if (tbody) {
    tbody.innerHTML = `<tr><td colspan="6" style="text-align:center; padding:25px; color:#94a3b8;">⏳ Loading customer directory from database...</td></tr>`;
  }

  // ── Step 1: Ensure active Supabase Admin Session ──
  if (typeof window.signAdminIntoSupabase === "function") {
    try {
      await window.signAdminIntoSupabase();
    } catch (e) {
      console.warn("[Admin Customers] Sign-in notice:", e);
    }
  }

  let dbProfiles = [];
  let dbOrders = [];

  let dbOrdersLoaded = false;

  // ── Step 2: Fetch Profiles & Orders from Supabase ──
  if (window.supabaseClient) {
    try {
      const [profilesRes, ordersRes] = await Promise.all([
        window.supabaseClient.from('profiles').select('*').order('created_at', { ascending: false }),
        window.supabaseClient.from('orders').select('id, order_number, customer_name, customer_email, customer_phone, total, order_status, shipping_address, created_at')
      ]);

      if (Array.isArray(profilesRes.data)) dbProfiles = profilesRes.data;
      if (Array.isArray(ordersRes.data)) {
        dbOrders = ordersRes.data;
        dbOrdersLoaded = true;
      }
    } catch (sbErr) {
      console.warn("[Admin Customers] Supabase query notice:", sbErr);
    }
  }

  // Fallback to local storage if DB is unreachable
  const localUsers = JSON.parse(localStorage.getItem("users")) || [];
  const localOrders = JSON.parse(localStorage.getItem("orders")) || [];
  const deletedCustomers = JSON.parse(localStorage.getItem("deleted_customers")) || [];

  if (dbOrdersLoaded) {
    try {
      localStorage.removeItem("orders");
      localStorage.removeItem("lastOrder");
    } catch (e) {}
  }

  // Merge orders: exclude Cancelled orders from spending
  const allOrders = (dbOrdersLoaded ? dbOrders : localOrders).map(o => ({
    id: o.order_number || o.id,
    customer: o.customer_name || o.customer || "Customer",
    email: (o.customer_email || o.email || "").toLowerCase(),
    phone: o.customer_phone || o.phone || "",
    total: Number(o.total || o.grandTotal || 0),
    status: o.order_status || o.status || "Pending",
    date: o.created_at ? new Date(o.created_at).toLocaleDateString("en-IN") : (o.date || "Today"),
    address: typeof o.shipping_address === 'object' && o.shipping_address
      ? `${o.shipping_address.street || ''}, ${o.shipping_address.city || ''}, ${o.shipping_address.state || ''} - ${o.shipping_address.postalCode || ''}`
      : (o.shipping_address || o.address || "Default Address")
  })).filter(o => !deletedCustomers.includes(o.email));

  const activeOrders = allOrders.filter(o => (o.status || "").toLowerCase() !== "cancelled");

  const combinedMap = new Map();

  // 1. Process Supabase Profiles (Registered customers)
  dbProfiles.forEach(p => {
    const email = (p.email || "").toLowerCase();
    if (p.role === 'admin' && email === 'beardbanna07773@gmail.com') return; // Hide primary admin account
    if (deletedCustomers.includes(String(p.id)) || (email && deletedCustomers.includes(email))) return;

    const userOrders = activeOrders.filter(o => (email && o.email === email) || (p.full_name && o.customer.toLowerCase() === p.full_name.toLowerCase()));
    const spent = userOrders.reduce((sum, o) => sum + (o.total || 0), 0);

    combinedMap.set(email || p.id, {
      id: p.id,
      _dbProfile: true,
      name: p.full_name || p.email?.split('@')[0] || "Customer",
      email: p.email || "N/A",
      phone: p.phone || (userOrders[0]?.phone) || "N/A",
      orders: userOrders.length,
      spent: spent,
      joined: p.created_at ? new Date(p.created_at).toLocaleDateString("en-IN") : "Recent",
      status: "Active",
      address: userOrders[0]?.address || "Default Address"
    });
  });

  // 2. Process Local Registered Users (Fallback/Local accounts)
  localUsers.forEach(u => {
    const email = (u.email || "").toLowerCase();
    if (deletedCustomers.includes(String(u.id)) || (email && deletedCustomers.includes(email))) return;
    if (email && combinedMap.has(email)) return;

    const userOrders = activeOrders.filter(o => (email && o.email === email) || (u.name && o.customer.toLowerCase() === u.name.toLowerCase()));
    const spent = userOrders.reduce((sum, o) => sum + (o.total || 0), 0);

    combinedMap.set(email || u.id, {
      id: u.id || String(Date.now()),
      name: u.name || "Customer",
      email: u.email || "N/A",
      phone: u.phone || (userOrders[0]?.phone) || "N/A",
      orders: userOrders.length,
      spent: spent,
      joined: u.joined || "Recent",
      status: u.status || "Active",
      address: userOrders[0]?.address || "Default Address"
    });
  });

  // 3. Process Guest Checkout Customers from Orders
  allOrders.forEach(o => {
    const email = (o.email || "").toLowerCase();
    if (email && !deletedCustomers.includes(email) && !combinedMap.has(email)) {
      const userOrders = activeOrders.filter(ord => ord.email === email);
      const spent = userOrders.reduce((sum, ord) => sum + (ord.total || 0), 0);

      combinedMap.set(email, {
        id: "guest_" + (email || Date.now()),
        name: o.customer || "Guest Customer",
        email: email || "N/A",
        phone: o.phone || "N/A",
        orders: userOrders.length,
        spent: spent,
        joined: o.date || "Recent",
        status: "Active",
        address: o.address || "Order Address"
      });
    }
  });

  customers = Array.from(combinedMap.values());
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
  const target = customers.find(c => String(c.id) === String(id));
  const email = target ? target.email : null;
  const name = target ? target.name : id;

  if (!confirm(`Are you sure you want to permanently delete customer "${name}"?\nThis action will remove their record from database.`)) return;

  if (typeof showToast === "function") showToast("⏳ Deleting customer from database...");

  // 1. Ensure active Supabase Admin Session
  if (typeof window.signAdminIntoSupabase === "function") {
    try {
      await window.signAdminIntoSupabase();
    } catch (e) {}
  }

  // 2. Delete from Supabase profiles if UUID or email matches
  if (window.supabaseClient) {
    try {
      const isUUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(id);
      if (isUUID) {
        await window.supabaseClient.from('profiles').delete().eq('id', id);
      } else if (email && email !== "N/A") {
        await window.supabaseClient.from('profiles').delete().eq('email', email);
      }
    } catch (sbErr) {
      console.warn("[Admin Customers] Supabase profile delete notice:", sbErr);
    }
  }

  // 3. Add ID & Email to persistent deleted_customers registry
  const deletedCustomers = JSON.parse(localStorage.getItem("deleted_customers")) || [];
  if (id && !deletedCustomers.includes(String(id))) deletedCustomers.push(String(id));
  if (email && email !== "N/A" && !deletedCustomers.includes(email.toLowerCase())) deletedCustomers.push(email.toLowerCase());
  localStorage.setItem("deleted_customers", JSON.stringify(deletedCustomers));

  // 4. Remove from localStorage.users
  let localUsers = JSON.parse(localStorage.getItem("users")) || [];
  localUsers = localUsers.filter(u => String(u.id) !== String(id) && (email ? u.email?.toLowerCase() !== email.toLowerCase() : true));
  localStorage.setItem("users", JSON.stringify(localUsers));

  // 5. Try REST API Backend Delete
  try {
    await API.delete(`/users/${id}`, { isAdmin: true });
  } catch (err) {}

  // 6. Update in-memory array & re-render
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