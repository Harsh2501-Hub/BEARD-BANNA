// ===============================
// ADMIN ANALYTICS - REAL-TIME LIVE DATA SYNC
// ===============================

let currentOrders = [];

async function loadAnalytics() {
  let orders = [];
  let dbLoaded = false;

  // ── SOURCE 1: Supabase (PRIMARY — live database) ──
  try {
    if (window.supabaseClient) {
      if (typeof signAdminIntoSupabase === 'function') {
        await signAdminIntoSupabase();
      }

      const { data: sbOrders, error: sbErr } = await window.supabaseClient
        .from('orders')
        .select('*, order_items(*)')
        .order('created_at', { ascending: false });

      if (sbErr) {
        console.warn("[Admin Analytics] Supabase query notice:", sbErr.message);
      } else if (Array.isArray(sbOrders)) {
        dbLoaded = true;
        orders = sbOrders.map(o => ({
          id: o.order_number || o.id,
          customer: o.customer_name || "Customer",
          total: Number(o.total || 0),
          grandTotal: Number(o.total || 0),
          status: o.order_status ? o.order_status.charAt(0).toUpperCase() + o.order_status.slice(1) : "Pending",
          date: new Date(o.created_at).toLocaleDateString("en-IN"),
          items: Array.isArray(o.order_items) ? o.order_items.map(i => ({
            name: i.name || "Product",
            quantity: i.quantity || 1,
            price: i.price || 0,
            category: i.category || 'Apparel'
          })) : []
        }));
      }
    }
  } catch (sbEx) {
    console.warn("[Admin Analytics] Supabase fetch exception:", sbEx.message);
  }

  // ── SOURCE 2: REST API backend ──
  if (!dbLoaded) {
    try {
      const res = await API.get('/orders', { isAdmin: true });
      if (res.success && Array.isArray(res.data?.orders)) {
        dbLoaded = true;
        res.data.orders.forEach(so => {
          orders.push({
            id: so.orderNumber || so._id,
            customer: so.customerName || "Customer",
            total: so.totalPrice || 0,
            grandTotal: so.totalPrice || 0,
            status: so.orderStatus || "Pending",
            date: new Date(so.createdAt).toLocaleDateString("en-IN"),
            items: so.orderItems || []
          });
        });
      }
    } catch (err) {
      console.warn("Using local analytics data");
    }
  }

  // ── SOURCE 3: localStorage (ONLY as emergency offline fallback) ──
  if (!dbLoaded) {
    const localOrders = JSON.parse(localStorage.getItem("orders")) || [];
    orders = [...localOrders];
  } else {
    try {
      localStorage.removeItem("orders");
      localStorage.removeItem("lastOrder");
    } catch (e) {}
  }

  currentOrders = orders;

  // Filter out cancelled orders for real analytics metrics
  const activeOrders = orders.filter(o => (o.status || "").toLowerCase() !== "cancelled");
  const totalRevenue = activeOrders.reduce((sum, o) => sum + Number(o.total || o.grandTotal || 0), 0);
  const totalOrders = activeOrders.length;
  const avgOrderValue = totalOrders > 0 ? Math.round(totalRevenue / totalOrders) : 0;
  const completedOrders = activeOrders.filter(o => (o.status || "").toLowerCase() === "delivered" || (o.status || "").toLowerCase() === "shipped").length;
  const conversionRate = totalOrders > 0 ? ((completedOrders / totalOrders) * 100).toFixed(1) : "0.0";

  const totalRevenueEl = document.getElementById("analytics-revenue");
  const totalOrdersEl = document.getElementById("analytics-orders");
  const avgOrderEl = document.getElementById("analytics-avg-order");
  const conversionEl = document.getElementById("analytics-conversion");

  if (totalRevenueEl) totalRevenueEl.textContent = "₹" + totalRevenue.toLocaleString();
  if (totalOrdersEl) totalOrdersEl.textContent = totalOrders;
  if (avgOrderEl) avgOrderEl.textContent = "₹" + avgOrderValue.toLocaleString();
  if (conversionEl) conversionEl.textContent = conversionRate + "%";

  renderCategorySalesBreakdown(activeOrders, totalRevenue);
  renderGrowthInsights(activeOrders);
}

function renderCategorySalesBreakdown(activeOrders, totalRevenue) {
  const tbody = document.getElementById("category-sales-body");
  if (!tbody) return;

  if (activeOrders.length === 0) {
    tbody.innerHTML = `<tr><td colspan="4" style="text-align:center; padding:25px; color:#94a3b8; font-size:1.05rem;">📊 No sales data available yet. Place an order to generate category sales breakdown.</td></tr>`;
    return;
  }

  // Aggregate sales by category from order items
  const catStats = {};

  activeOrders.forEach(o => {
    const items = o.items || o.cart || [];
    items.forEach(i => {
      const cat = i.category || 'Round Neck T-Shirts';
      const qty = Number(i.quantity || i.qty || 1);
      const rev = Number(i.price || 0) * qty;

      if (!catStats[cat]) {
        catStats[cat] = { units: 0, revenue: 0 };
      }
      catStats[cat].units += qty;
      catStats[cat].revenue += rev;
    });
  });

  const categories = Object.keys(catStats);
  if (categories.length === 0) {
    tbody.innerHTML = `<tr><td colspan="4" style="text-align:center; padding:25px; color:#94a3b8;">📊 No item sales data available yet.</td></tr>`;
    return;
  }

  let html = "";
  categories.forEach(cat => {
    const stat = catStats[cat];
    const share = totalRevenue > 0 ? Math.round((stat.revenue / totalRevenue) * 100) : 0;

    html += `
      <tr>
        <td><b>${cat}</b></td>
        <td><span class="badge active">${share}%</span></td>
        <td>${stat.units} units</td>
        <td><b>₹${stat.revenue.toLocaleString()}</b></td>
      </tr>
    `;
  });

  tbody.innerHTML = html;
}

function renderGrowthInsights(activeOrders) {
  const container = document.getElementById("growth-insights-container");
  if (!container) return;

  if (activeOrders.length === 0) {
    container.innerHTML = `
      <p style="color:#94a3b8; font-size:0.9rem; margin-bottom:15px;">
        No sales insights available yet. Place test orders to generate real-time product insights.
      </p>
    `;
    return;
  }

  // Determine top selling product item
  const productSales = {};
  activeOrders.forEach(o => {
    const items = o.items || o.cart || [];
    items.forEach(i => {
      const name = i.name || i.title || "Product";
      const qty = Number(i.quantity || i.qty || 1);
      productSales[name] = (productSales[name] || 0) + qty;
    });
  });

  let topProduct = "Royal Apparel";
  let topQty = 0;
  Object.keys(productSales).forEach(p => {
    if (productSales[p] > topQty) {
      topQty = productSales[p];
      topProduct = p;
    }
  });

  container.innerHTML = `
    <p style="color:#cbd5e1; font-size:0.9rem; margin-bottom:12px;">
      🔥 Top Seller: <strong>${topProduct}</strong> (${topQty} units ordered).
    </p>
    <p style="color:#cbd5e1; font-size:0.9rem; margin-bottom:12px;">
      🛒 Order Fulfillment Rate: <strong>${activeOrders.length} active order(s)</strong>.
    </p>
  `;
}

function exportAnalyticsReport() {
  const activeOrders = (currentOrders || []).filter(o => (o.status || "").toLowerCase() !== "cancelled");

  if (activeOrders.length === 0) {
    alert("No active order data to export.");
    return;
  }

  let csvContent = "data:text/csv;charset=utf-8,Order ID,Customer,Total Amount,Status,Date\n";

  activeOrders.forEach(o => {
    csvContent += `"${o.id || o.orderId}","${o.customer || 'Customer'}","${o.total || o.grandTotal || 0}","${o.status || 'Pending'}","${o.date || 'Today'}"\n`;
  });

  const encodedUri = encodeURI(csvContent);
  const link = document.createElement("a");
  link.setAttribute("href", encodedUri);
  link.setAttribute("download", `BEARD_BANNA_Sales_Report_${Date.now()}.csv`);
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);

  if (typeof showToast === "function") showToast("📊 Sales Report Downloaded!");
}

document.addEventListener("DOMContentLoaded", loadAnalytics);
