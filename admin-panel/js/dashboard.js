// ===============================
// ADMIN DASHBOARD - REAL-TIME LIVE METRICS & ZERO MOCK FALLBACKS
// ===============================

async function loadDashboardMetrics() {
  let stats = {
    totalRevenue: 0,
    totalOrders: 0,
    totalProducts: 0,
    totalUsers: 0,
    totalReviews: 0,
    recentOrders: [],
    recentUsers: []
  };

  // Sync GST Toggle Status
  const gstCheckbox = document.getElementById("gst-toggle-checkbox");
  const gstBadge = document.getElementById("gst-status-badge");
  const gstEnabled = typeof isGSTEnabled === "function" ? isGSTEnabled() : true;

  if (gstCheckbox) gstCheckbox.checked = gstEnabled;
  if (gstBadge) {
    gstBadge.textContent = gstEnabled ? "ENABLED" : "DISABLED";
    gstBadge.style.background = gstEnabled ? "#22c55e" : "#ef4444";
  }

  // 1. Load Orders from localStorage
  const localOrders = JSON.parse(localStorage.getItem("orders")) || [];
  let combinedOrders = [...localOrders];

  // 1.1 Load Orders from Supabase using authenticated admin session
  // (Using supabaseClient so is_admin() RLS check passes with admin JWT)
  try {
    if (!window.supabaseClient) {
      throw new Error('Supabase client not initialized');
    }

    const { data: sbOrders, error: sbErr } = await window.supabaseClient
      .from('orders')
      .select('id, order_number, customer_name, total, order_status, created_at')
      .order('created_at', { ascending: false })
      .limit(50);

    if (sbErr) {
      console.warn('[Dashboard] Supabase query notice:', sbErr.message);
    } else if (Array.isArray(sbOrders)) {
      sbOrders.forEach(o => {
        const so = {
          id: o.order_number || o.id,
          _id: o.id,
          orderId: o.order_number || o.id,
          customer: o.customer_name || "Customer",
          amount: "₹" + (o.total || 0),
          total: Number(o.total || 0),
          status: (o.order_status ? o.order_status.charAt(0).toUpperCase() + o.order_status.slice(1) : "Pending"),
          date: new Date(o.created_at).toLocaleDateString("en-IN")
        };
        if (!combinedOrders.some(lo => String(lo.id) === String(so.id) || String(lo._id) === String(so._id))) {
          combinedOrders.push(so);
        }
      });
      console.log('[Dashboard] Loaded', sbOrders.length, 'orders from Supabase');
    }
  } catch (sbErr) {
    console.warn('[Dashboard] Supabase metrics notice:', sbErr.message);
  }

  // 2. Load Inquiries from localStorage
  const inquiries = JSON.parse(localStorage.getItem("inquiries")) || [];

  // 3. Try loading backend dashboard stats
  try {
    const res = await API.get('/admin/dashboard-stats', { isAdmin: true });
    if (res.success && res.data?.metrics) {
      stats.totalUsers = res.data.metrics.totalUsers || 0;
      stats.totalProducts = res.data.metrics.totalProducts || 0;
      stats.totalOrders = res.data.metrics.totalOrders || 0;
      stats.totalRevenue = res.data.metrics.totalRevenue || 0;
    }
  } catch (err) {
    // Silently continue to use aggregated orders
  }

  try {
    const orderRes = await API.get('/orders', { isAdmin: true });
    if (orderRes.success && Array.isArray(orderRes.data?.orders)) {
      const serverOrders = orderRes.data.orders.map(o => ({
        id: o.orderNumber || o._id,
        _id: o._id,
        customer: o.user?.name || o.shippingAddress?.fullName || "Customer",
        amount: "₹" + (o.totalPrice || 0),
        total: o.totalPrice || 0,
        status: (o.orderStatus ? o.orderStatus.charAt(0).toUpperCase() + o.orderStatus.slice(1) : "Pending"),
        date: new Date(o.createdAt).toLocaleDateString("en-IN")
      }));

      serverOrders.forEach(so => {
        if (!combinedOrders.some(lo => lo.id === so.id || lo._id === so._id)) {
          combinedOrders.push(so);
        }
      });
    }
  } catch (e) {}

  // 4. Compute Products Count
  const localProducts = JSON.parse(localStorage.getItem("products")) || [];
  stats.totalProducts = localProducts.length > 0 ? localProducts.length : (stats.totalProducts || 0);

  // 5. Compute Customers Count dynamically (excluding deleted customers)
  const localUsers = JSON.parse(localStorage.getItem("users")) || [];
  const deletedCustomers = JSON.parse(localStorage.getItem("deleted_customers")) || [];
  const activeUsers = localUsers.filter(u => !deletedCustomers.includes(String(u.id)) && (!u.email || !deletedCustomers.includes(u.email.toLowerCase())));
  
  // Also collect customer count from active non-deleted guest orders
  const validOrders = combinedOrders.filter(o => (o.status || "").toLowerCase() !== "cancelled");
  const guestEmails = new Set();
  validOrders.forEach(o => {
    const email = o.email || o.customer?.email;
    if (email && !deletedCustomers.includes(email.toLowerCase()) && !activeUsers.some(u => u.email?.toLowerCase() === email.toLowerCase())) {
      guestEmails.add(email.toLowerCase());
    }
  });

  stats.totalUsers = activeUsers.length + guestEmails.size;
  stats.totalOrders = combinedOrders.length;
  
  // Deduct Cancelled orders from Total Revenue
  stats.totalRevenue = validOrders.reduce((sum, o) => sum + (Number(o.total || o.grandTotal || 0)), 0);

  // 6. Compute Reviews Count dynamically
  const isClearedReviews = localStorage.getItem("admin_cleared_all_reviews") === "true";
  const deletedReviewIds = JSON.parse(localStorage.getItem("deleted_reviews")) || [];
  let totalReviewsCount = 0;

  if (!isClearedReviews) {
    let reviewList = [];
    for (let i = 0; i < localStorage.length; i++) {
      const key = localStorage.key(i);
      if (key.startsWith("reviews_")) {
        try {
          const items = JSON.parse(localStorage.getItem(key)) || [];
          reviewList = reviewList.concat(items);
        } catch (e) {}
      }
    }
    // Filter deleted review IDs
    reviewList = reviewList.filter(r => !deletedReviewIds.includes(String(r.id)) && !deletedReviewIds.includes(String(r._id)));
    totalReviewsCount = reviewList.length;
  }
  stats.totalReviews = totalReviewsCount;

  // DOM Updates
  const totalProductsEl = document.getElementById("total-products");
  const totalCustomersEl = document.getElementById("total-customers");
  const totalOrdersEl = document.getElementById("total-orders");
  const totalRevenueEl = document.getElementById("total-revenue");
  const totalInquiriesEl = document.getElementById("total-inquiries");
  const totalReviewsEl = document.getElementById("total-reviews");

  if (totalProductsEl) totalProductsEl.textContent = stats.totalProducts;
  if (totalCustomersEl) totalCustomersEl.textContent = stats.totalUsers;
  if (totalOrdersEl) totalOrdersEl.textContent = stats.totalOrders;
  if (totalRevenueEl) totalRevenueEl.textContent = "₹" + Math.round(stats.totalRevenue).toLocaleString();
  if (totalInquiriesEl) totalInquiriesEl.textContent = inquiries.length;
  if (totalReviewsEl) totalReviewsEl.textContent = stats.totalReviews;

  // Render Recent Orders Table
  const ordersBody = document.getElementById("recent-orders-body");
  if (ordersBody) {
    ordersBody.innerHTML = "";
    if (combinedOrders.length === 0) {
      ordersBody.innerHTML = `<tr><td colspan="5" style="text-align:center; padding:15px; color:#94a3b8;">🛒 No recent orders found.</td></tr>`;
    } else {
      combinedOrders.slice(0, 5).forEach(o => {
        ordersBody.innerHTML += `
          <tr>
            <td>${o.id || o.orderId || "#1001"}</td>
            <td>${o.customer || "Customer"}</td>
            <td>₹${Math.round(o.total || o.grandTotal || 0)}</td>
            <td><span class="badge ${o.status ? o.status.toLowerCase() : 'pending'}">${o.status || "Pending"}</span></td>
            <td>${o.date || "Today"}</td>
          </tr>
        `;
      });
    }
  }

  // Render Recent Customers Table (ZERO MOCK FALLBACKS)
  const customerBody = document.getElementById("recent-customers-body");
  if (customerBody) {
    customerBody.innerHTML = "";
    if (activeUsers.length === 0) {
      customerBody.innerHTML = `<tr><td colspan="3" style="text-align:center; padding:15px; color:#94a3b8;">👥 No registered customer accounts.</td></tr>`;
    } else {
      activeUsers.slice(0, 5).forEach(c => {
        customerBody.innerHTML += `
          <tr>
            <td><b>${c.name}</b></td>
            <td>${c.email}</td>
            <td>${c.phone || "N/A"}</td>
          </tr>
        `;
      });
    }
  }

  // Render Recent Inquiries Table
  const inquiryBody = document.getElementById("recent-inquiries-body");
  if (inquiryBody) {
    inquiryBody.innerHTML = "";
    if (inquiries.length === 0) {
      inquiryBody.innerHTML = `<tr><td colspan="7" style="text-align:center; padding:15px; color:#94a3b8;">📩 No customer inquiries received yet.</td></tr>`;
    } else {
      inquiries.slice(0, 5).forEach(inq => {
        inquiryBody.innerHTML += `
          <tr>
            <td><strong>${inq.id}</strong></td>
            <td>${inq.name}</td>
            <td>
              <div><strong>Email:</strong> ${inq.email}</div>
              <div><strong>Phone:</strong> ${inq.phone}</div>
            </td>
            <td><span class="badge pending">${inq.orderNumber || 'N/A'}</span></td>
            <td>
              <div><strong>${inq.subject}</strong></div>
              <small style="color:#94a3b8;">${inq.message}</small>
            </td>
            <td>${inq.date}</td>
            <td><span class="badge ${inq.status === 'Resolved' ? 'shipped' : 'active'}">${inq.status || 'New'}</span></td>
          </tr>
        `;
      });
    }
  }
}

// Quick action buttons
const addProductBtn = document.getElementById("add-product-btn");
if (addProductBtn) addProductBtn.addEventListener("click", () => { window.location.href = "products.html"; });

const viewOrdersBtn = document.getElementById("view-orders-btn");
if (viewOrdersBtn) viewOrdersBtn.addEventListener("click", () => { window.location.href = "orders.html"; });

const customersBtn = document.getElementById("customers-btn");
if (customersBtn) customersBtn.addEventListener("click", () => { window.location.href = "customers.html"; });

const settingsBtn = document.getElementById("settings-btn");
if (settingsBtn) settingsBtn.addEventListener("click", () => { window.location.href = "settings.html"; });

document.addEventListener("DOMContentLoaded", loadDashboardMetrics);