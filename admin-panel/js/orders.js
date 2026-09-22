// ===============================
// ADMIN ORDERS - SUPABASE-POWERED (RLS-AUTHENTICATED)
// ===============================
//
// DATA SOURCE PRIORITY:
//   1. Supabase (PRIMARY) — uses authenticated admin session so is_admin() = true in RLS
//   2. REST API backend (MongoDB) — fallback
//   3. localStorage — local device cache only
//
// The admin MUST be signed into Supabase (done via admin-auth.js) for
// Supabase queries to pass the is_admin() RLS check and return all orders.
//

let orders = [];

async function loadAdminOrders() {
  const tbody = document.getElementById("orders-body");
  if (tbody) {
    tbody.innerHTML = `<tr><td colspan="6" style="text-align:center; padding:20px; color:#94a3b8;">⏳ Loading orders from database...</td></tr>`;
  }

  let combinedOrders = [];

  // ── SOURCE 1: Supabase (PRIMARY — requires admin Supabase session) ──────────────
  try {
    if (!window.supabaseClient) {
      throw new Error('Supabase client not initialized');
    }

    // Verify admin has a Supabase session; if not, trigger sign-in
    const { data: { session } } = await window.supabaseClient.auth.getSession();
    if (!session) {
      console.warn('[Admin Orders] No Supabase session. Attempting admin sign-in...');
      // admin-auth.js exposes signAdminIntoSupabase, but it may not be loaded here
      // Try a direct sign-in as fallback
      if (typeof signAdminIntoSupabase === 'function') {
        await signAdminIntoSupabase();
      }
    }

    // Query orders — RLS is_admin() check will pass if admin is signed in
    const { data: sbOrders, error: sbErr } = await window.supabaseClient
      .from('orders')
      .select('*, order_items(*)')
      .order('created_at', { ascending: false });

    if (sbErr) {
      console.warn('[Admin Orders] Supabase query error:', sbErr.message, sbErr.code);
      if (sbErr.code === 'PGRST116' || sbErr.message?.includes('JWT')) {
        console.warn('[Admin Orders] Auth issue — ensure admin is signed into Supabase.');
      }
    } else if (Array.isArray(sbOrders)) {
      const mappedSb = sbOrders.map(o => ({
        id: o.order_number || o.id,
        _id: o.id,
        orderId: o.order_number || o.id,
        customer: o.customer_name || "Customer",
        email: o.customer_email || "",
        phone: o.customer_phone || (o.shipping_address && o.shipping_address.phone) || "",
        total: Number(o.total || 0),
        grandTotal: Number(o.total || 0),
        status: (o.order_status ? o.order_status.charAt(0).toUpperCase() + o.order_status.slice(1) : "Processing"),
        date: new Date(o.created_at).toLocaleDateString("en-IN"),
        payment: (o.payment_method || "COD").toUpperCase(),
        paymentStatus: o.payment_status || "Pending",
        address: typeof o.shipping_address === 'object' && o.shipping_address
          ? `${o.shipping_address.street || ''}, ${o.shipping_address.city || ''}, ${o.shipping_address.state || ''} - ${o.shipping_address.postalCode || ''}`
          : (o.shipping_address || 'N/A'),
        razorpayPaymentId: o.razorpay_payment_id || "",
        items: Array.isArray(o.order_items) ? o.order_items.map(item => ({
          name: item.name || "Product",
          size: item.size || "M",
          quantity: item.quantity || 1,
          price: item.price || 0
        })) : []
      }));

      // Merge Supabase orders — deduplicate by ID
      mappedSb.forEach(so => {
        if (!combinedOrders.some(co => String(co.id) === String(so.id) || String(co._id) === String(so._id))) {
          combinedOrders.push(so);
        }
      });

      console.log(`[Admin Orders] ✅ Loaded ${mappedSb.length} orders from Supabase`);
    }
  } catch (sbErr) {
    console.warn("[Admin Orders] Supabase fetch error:", sbErr.message);
  }

  // ── SOURCE 2: REST API backend (MongoDB) — supplement ──────────────────────────
  try {
    const res = await API.get('/orders', { isAdmin: true });
    if (res.success && Array.isArray(res.data?.orders || res.data)) {
      const serverOrderList = res.data?.orders || res.data;
      const serverOrders = serverOrderList.map(o => ({
        id: o.orderNumber || o.orderId || o._id,
        _id: o._id,
        orderId: o.orderNumber || o.orderId || o._id,
        customer: o.user?.name || o.shippingAddress?.fullName || o.customerName || "Customer",
        email: o.customerEmail || "",
        phone: o.shippingAddress?.phone || o.customerPhone || "",
        total: o.totalPrice || o.total || 0,
        grandTotal: o.totalPrice || o.total || 0,
        status: (o.orderStatus ? o.orderStatus.charAt(0).toUpperCase() + o.orderStatus.slice(1) : "Processing"),
        date: new Date(o.createdAt || Date.now()).toLocaleDateString("en-IN"),
        payment: (o.paymentMethod || "COD").toUpperCase(),
        paymentStatus: o.paymentStatus || "Pending",
        address: `${o.shippingAddress?.street || ""}, ${o.shippingAddress?.city || ""}`,
        items: Array.isArray(o.orderItems) ? o.orderItems.map(item => ({
          name: item.title || item.name || "Product",
          size: item.size || "M",
          quantity: item.quantity || item.qty || 1,
          price: item.price || 0
        })) : []
      }));

      serverOrders.forEach(so => {
        if (!combinedOrders.some(co => String(co.id) === String(so.id) || String(co._id) === String(so._id))) {
          combinedOrders.push(so);
        }
      });
    }
  } catch (err) {
    // REST API offline — continue with Supabase data
  }

  // ── SOURCE 3: localStorage (local device orders only — not shared across devices) ──
  const localOrders = JSON.parse(localStorage.getItem("orders")) || [];
  localOrders.forEach(lo => {
    if (!combinedOrders.some(co => String(co.id) === String(lo.id) || String(co.orderId) === String(lo.orderId))) {
      combinedOrders.push(lo);
    }
  });

  // Sort combined orders by date (newest first)
  combinedOrders.sort((a, b) => {
    const da = new Date(a.orderDate || a.date || 0);
    const db = new Date(b.orderDate || b.date || 0);
    return db - da;
  });

  orders = combinedOrders;
  renderOrders();
  setupOrdersRealtime();
}

let ordersSubscription = null;

function setupOrdersRealtime() {
  if (ordersSubscription || !window.supabaseClient) return;

  try {
    ordersSubscription = window.supabaseClient
      .channel('admin-orders-realtime')
      .on(
        'postgres_changes',
        { event: 'INSERT', schema: 'public', table: 'orders' },
        async (payload) => {
          console.log('[Admin Orders] ⚡ Realtime order received:', payload.new);
          if (payload.new) {
            const o = payload.new;
            let items = [];
            try {
              const { data: itemData } = await window.supabaseClient
                .from('order_items')
                .select('*')
                .eq('order_id', o.id);
              if (Array.isArray(itemData)) items = itemData;
            } catch (e) {}

            const newMapped = {
              id: o.order_number || o.id,
              _id: o.id,
              orderId: o.order_number || o.id,
              customer: o.customer_name || "Customer",
              email: o.customer_email || "",
              phone: o.customer_phone || (o.shipping_address && o.shipping_address.phone) || "",
              total: Number(o.total || 0),
              grandTotal: Number(o.total || 0),
              status: (o.order_status ? o.order_status.charAt(0).toUpperCase() + o.order_status.slice(1) : "Processing"),
              date: new Date(o.created_at || Date.now()).toLocaleDateString("en-IN"),
              payment: (o.payment_method || "COD").toUpperCase(),
              paymentStatus: o.payment_status || "Pending",
              address: typeof o.shipping_address === 'object' && o.shipping_address
                ? `${o.shipping_address.street || ''}, ${o.shipping_address.city || ''}, ${o.shipping_address.state || ''} - ${o.shipping_address.postalCode || ''}`
                : (o.shipping_address || 'N/A'),
              razorpayPaymentId: o.razorpay_payment_id || "",
              items: items.map(item => ({
                name: item.name || "Product",
                size: item.size || "M",
                quantity: item.quantity || 1,
                price: item.price || 0
              }))
            };

            if (!orders.some(ex => String(ex.id) === String(newMapped.id) || String(ex._id) === String(newMapped._id))) {
              orders.unshift(newMapped);
              renderOrders();
              if (typeof showToast === 'function') {
                showToast(`🔔 New Order: #${newMapped.id} by ${newMapped.customer}!`);
              }
            }
          }
        }
      )
      .on(
        'postgres_changes',
        { event: 'UPDATE', schema: 'public', table: 'orders' },
        (payload) => {
          if (payload.new) {
            const o = payload.new;
            const target = orders.find(ex => String(ex.id) === String(o.order_number) || String(ex._id) === String(o.id));
            if (target) {
              const formattedStatus = o.order_status ? o.order_status.charAt(0).toUpperCase() + o.order_status.slice(1) : target.status;
              target.status = formattedStatus;
              target.orderStatus = formattedStatus;
              renderOrders();
            }
          }
        }
      )
      .subscribe((status) => {
        console.log('[Admin Orders] Realtime subscription status:', status);
      });
  } catch (e) {
    console.warn('[Admin Orders] Realtime subscription error:', e);
  }
}

function renderOrders(filteredOrders = orders) {
  const ordersBody = document.getElementById("orders-body");
  if (!ordersBody) return;

  let html = "";
  filteredOrders.forEach(order => {
    const orderIdentifier = order._id || order.id || order.orderId;
    const currentStatus = order.status || order.orderStatus || "Processing";
    const formattedStatus = currentStatus.charAt(0).toUpperCase() + currentStatus.slice(1).toLowerCase();

    html += `
      <tr>
        <td><strong>${order.id || order.orderId}</strong></td>
        <td>
          <div>${order.customer}</div>
          <small style="color:#94a3b8;">${order.email || ''}</small>
        </td>
        <td>₹${order.total || order.grandTotal || 0}</td>
        <td>
          <select class="status-select ${formattedStatus.toLowerCase()}" onchange="updateOrderStatus('${orderIdentifier}', this.value)">
            <option value="Processing" ${formattedStatus === "Processing" ? "selected" : ""}>Processing</option>
            <option value="Pending" ${formattedStatus === "Pending" ? "selected" : ""}>Pending</option>
            <option value="Confirmed" ${formattedStatus === "Confirmed" ? "selected" : ""}>Confirmed</option>
            <option value="Packed" ${formattedStatus === "Packed" ? "selected" : ""}>Packed</option>
            <option value="Shipped" ${formattedStatus === "Shipped" ? "selected" : ""}>Shipped</option>
            <option value="Delivered" ${formattedStatus === "Delivered" ? "selected" : ""}>Delivered</option>
            <option value="Cancelled" ${formattedStatus === "Cancelled" ? "selected" : ""}>Cancelled</option>
          </select>
        </td>
        <td>${order.date || "Today"}</td>
        <td>
          <div class="action-buttons" style="display:flex; gap:6px;">
            <button class="view-btn" onclick="viewOrder('${orderIdentifier}')">👁 View</button>
            <button class="cancel-btn" onclick="cancelOrder('${orderIdentifier}')" style="background:#ef4444; color:white;">❌ Cancel</button>
            <button class="delete-btn" onclick="deleteSingleOrder('${orderIdentifier}')" style="background:#dc2626; color:white; padding:4px 8px; border-radius:6px; border:none; cursor:pointer;" title="Delete Order">🗑 Delete</button>
          </div>
        </td>
      </tr>
    `;
  });

  if (filteredOrders.length === 0) {
    html = `<tr><td colspan="6" class="empty-orders">📦 No Orders Found</td></tr>`;
  }

  ordersBody.innerHTML = html;
  updateOrderStatistics();
}

async function updateOrderStatus(id, status) {
  const normalizedStatus = status.charAt(0).toUpperCase() + status.slice(1).toLowerCase();

  // ── Update in-memory list ──
  const order = orders.find(o => String(o.id) === String(id) || String(o._id) === String(id) || String(o.orderId) === String(id));
  if (order) {
    order.status = normalizedStatus;
    order.orderStatus = normalizedStatus;
  }

  // ── Update localStorage cache ──
  const localOrders = JSON.parse(localStorage.getItem("orders")) || [];
  const localIdx = localOrders.findIndex(lo => String(lo.id) === String(id) || String(lo._id) === String(id) || String(lo.orderId) === String(id));
  if (localIdx > -1) {
    localOrders[localIdx].status = normalizedStatus;
    localOrders[localIdx].orderStatus = normalizedStatus;
    localStorage.setItem("orders", JSON.stringify(localOrders));
  }

  const lastOrder = JSON.parse(localStorage.getItem("lastOrder"));
  if (lastOrder && (String(lastOrder.id) === String(id) || String(lastOrder.orderId) === String(id) || String(lastOrder._id) === String(id))) {
    lastOrder.status = normalizedStatus;
    lastOrder.orderStatus = normalizedStatus;
    localStorage.setItem("lastOrder", JSON.stringify(lastOrder));
  }

  // ── Update in Supabase (PRIMARY — uses admin Supabase session) ──
  try {
    if (window.supabaseClient) {
      // Try update by order_number first, then by UUID
      const sbOrderRef = order?._id || id;
      const isUUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(sbOrderRef);

      let updateQuery;
      if (isUUID) {
        updateQuery = window.supabaseClient
          .from('orders')
          .update({ order_status: normalizedStatus, updated_at: new Date().toISOString() })
          .eq('id', sbOrderRef);
      } else {
        updateQuery = window.supabaseClient
          .from('orders')
          .update({ order_status: normalizedStatus, updated_at: new Date().toISOString() })
          .eq('order_number', id);
      }

      const { error: updateErr } = await updateQuery;
      if (updateErr) {
        console.warn('[Admin Orders] Supabase status update error:', updateErr.message);
      } else {
        console.log('[Admin Orders] ✅ Status updated in Supabase:', id, '→', normalizedStatus);
      }
    }
  } catch (sbErr) {
    console.warn('[Admin Orders] Supabase status update exception:', sbErr.message);
  }

  // ── Update on REST API backend (MongoDB) ──
  try {
    const idForApi = order?._id || id;
    await API.put(`/orders/${idForApi}/status`, { orderStatus: normalizedStatus.toLowerCase() }, { isAdmin: true });
  } catch (err) {
    // Silently handled
  }

  renderOrders();
  if (typeof showToast === "function") {
    showToast(`✅ Order Status updated to ${normalizedStatus}${normalizedStatus === 'Cancelled' ? ' (Revenue Deducted)' : ''}`);
  }
}

async function cancelOrder(id) {
  if (!confirm("Are you sure you want to cancel this order? It will be marked as Cancelled and its amount will be deducted from total revenue.")) return;
  await updateOrderStatus(id, "Cancelled");
}

async function deleteSingleOrder(id) {
  if (!confirm("Delete this order permanently from Supabase and local cache?")) return;

  // Remove from in-memory list
  orders = orders.filter(o => String(o.id) !== String(id) && String(o._id) !== String(id) && String(o.orderId) !== String(id));

  // Remove from localStorage
  const localOrders = JSON.parse(localStorage.getItem("orders")) || [];
  const updated = localOrders.filter(o => String(o.id) !== String(id) && String(o._id) !== String(id) && String(o.orderId) !== String(id));
  localStorage.setItem("orders", JSON.stringify(updated));

  const lastOrder = JSON.parse(localStorage.getItem("lastOrder"));
  if (lastOrder && (String(lastOrder.id) === String(id) || String(lastOrder.orderId) === String(id))) {
    localStorage.removeItem("lastOrder");
  }

  // Delete from Supabase
  try {
    if (window.supabaseClient) {
      const targetOrder = orders.find(o => String(o._id) === String(id)) || { _id: id };
      const isUUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(targetOrder._id || id);
      if (isUUID) {
        await window.supabaseClient.from('orders').delete().eq('id', targetOrder._id || id);
      } else {
        await window.supabaseClient.from('orders').delete().eq('order_number', id);
      }
    }
  } catch (sbErr) {
    console.warn('[Admin Orders] Supabase delete notice:', sbErr.message);
  }

  renderOrders();
  if (typeof showToast === "function") showToast("🗑 Order deleted");
  else alert("Order deleted.");
}

function clearAllOrders() {
  if (!confirm("⚠️ ARE YOU SURE? This will clear all LOCAL orders from this device only.\nOrders in Supabase database will NOT be deleted.")) return;
  orders = orders.filter(o => o._id); // Keep only Supabase-sourced orders (those with _id)
  localStorage.removeItem("orders");
  localStorage.removeItem("lastOrder");
  renderOrders();
  if (typeof showToast === "function") showToast("🗑 Local device orders cleared.");
  else alert("Local device orders cleared.");
}

function viewOrder(id) {
  const order = orders.find(o => String(o.id) === String(id) || String(o._id) === String(id) || String(o.orderId) === String(id));
  if (!order) return;

  let itemsHTML = "";
  const items = order.items || order.cart || [];
  items.forEach(item => {
    itemsHTML += `
      <li>
        <strong>${item.name || item.title}</strong><br>
        Size : ${item.size || 'M'} | Qty : ${item.quantity || item.qty || 1} | Price : ₹${item.price}
      </li>
      <hr>
    `;
  });

  const detailsContainer = document.getElementById("order-details");
  if (detailsContainer) {
    detailsContainer.innerHTML = `
      <h2>Order ${order.id || order.orderId}</h2><br>
      <p><strong>Customer:</strong> ${order.customer || order.name}</p>
      <p><strong>Email:</strong> ${order.email || "N/A"}</p>
      <p><strong>Phone:</strong> ${order.phone || "N/A"}</p>
      <p><strong>Payment:</strong> ${order.payment || "COD"} — <em>${order.paymentStatus || 'Pending'}</em></p>
      ${order.razorpayPaymentId ? `<p><strong>Razorpay ID:</strong> ${order.razorpayPaymentId}</p>` : ''}
      <p><strong>Address:</strong> ${order.address || "N/A"}</p>
      <p><strong>Current Status:</strong> <span class="badge ${order.status ? order.status.toLowerCase() : 'processing'}">${order.status || 'Processing'}</span></p><br>
      <h3>Ordered Items</h3>
      <ul>${itemsHTML || '<li>No item details available</li>'}</ul>
      <h2>Total : ₹${order.total || order.grandTotal || 0}</h2>
    `;
  }
  const modal = document.getElementById("order-modal");
  if (modal) modal.style.display = "flex";
}

function updateOrderStatistics() {
  const totalOrders = orders.length;
  const pendingOrders = orders.filter(o => (o.status || "").toLowerCase() === "pending" || (o.status || "").toLowerCase() === "processing").length;
  const shippedOrders = orders.filter(o => (o.status || "").toLowerCase() === "shipped" || (o.status || "").toLowerCase() === "delivered").length;

  // Only sum non-cancelled orders for revenue
  const validOrders = orders.filter(o => (o.status || "").toLowerCase() !== "cancelled");
  const revenue = validOrders.reduce((sum, o) => sum + Number(o.total || o.grandTotal || 0), 0);

  const totalEl = document.getElementById("stat-total-orders");
  const pendingEl = document.getElementById("stat-pending-orders");
  const shippedEl = document.getElementById("stat-shipped-orders");
  const revEl = document.getElementById("stat-total-revenue");

  if (totalEl) totalEl.textContent = totalOrders;
  if (pendingEl) pendingEl.textContent = pendingOrders;
  if (shippedEl) shippedEl.textContent = shippedOrders;
  if (revEl) revEl.textContent = "₹" + revenue.toLocaleString();
}

// Search and filter
function filterOrders() {
  const searchVal = (document.getElementById("order-search")?.value || "").toLowerCase();
  const statusVal = (document.getElementById("status-filter")?.value || "all").toLowerCase();

  let filtered = orders;

  if (statusVal !== "all") {
    filtered = filtered.filter(o => (o.status || "").toLowerCase() === statusVal);
  }

  if (searchVal) {
    filtered = filtered.filter(o =>
      (o.id || "").toLowerCase().includes(searchVal) ||
      (o.orderId || "").toLowerCase().includes(searchVal) ||
      (o.customer || "").toLowerCase().includes(searchVal) ||
      (o.email || "").toLowerCase().includes(searchVal) ||
      (o.phone || "").includes(searchVal)
    );
  }

  renderOrders(filtered);
}

function closeOrderModal() {
  const modal = document.getElementById("order-modal");
  if (modal) modal.style.display = "none";
}

window.closeOrderModal = closeOrderModal;
window.clearAllOrders = clearAllOrders;
window.deleteSingleOrder = deleteSingleOrder;
window.updateOrderStatus = updateOrderStatus;
window.cancelOrder = cancelOrder;
window.viewOrder = viewOrder;
window.filterOrders = filterOrders;

document.addEventListener("DOMContentLoaded", () => {
  loadAdminOrders();

  const searchInput = document.getElementById("order-search");
  if (searchInput) searchInput.addEventListener("input", filterOrders);

  const statusFilter = document.getElementById("status-filter");
  if (statusFilter) statusFilter.addEventListener("change", filterOrders);

  const closeModalBtn = document.getElementById("close-modal");
  if (closeModalBtn) {
    closeModalBtn.addEventListener("click", closeOrderModal);
  }

  const modal = document.getElementById("order-modal");
  if (modal) {
    window.addEventListener("click", (event) => {
      if (event.target === modal) {
        closeOrderModal();
      }
    });
  }
});