// ===============================
// ADMIN ORDERS - CANCEL ANY ORDER & CLEAR TEST DATA
// ===============================

let orders = JSON.parse(localStorage.getItem("orders")) || [];

async function loadAdminOrders() {
  const localOrders = JSON.parse(localStorage.getItem("orders")) || [];
  let combinedOrders = [...localOrders];

  try {
    const res = await API.get('/orders', { isAdmin: true });
    if (res.success && Array.isArray(res.data?.orders)) {
      const serverOrders = res.data.orders.map(o => ({
        id: o.orderNumber || o._id,
        _id: o._id,
        orderId: o.orderNumber || o._id,
        customer: o.user?.name || o.shippingAddress?.fullName || "Customer",
        total: o.totalPrice || 0,
        status: (o.orderStatus ? o.orderStatus.charAt(0).toUpperCase() + o.orderStatus.slice(1) : "Pending"),
        date: new Date(o.createdAt).toLocaleDateString("en-IN"),
        phone: o.shippingAddress?.phone || "9876543210",
        payment: (o.paymentMethod || "COD").toUpperCase(),
        address: `${o.shippingAddress?.street || ""}, ${o.shippingAddress?.city || ""}`,
        items: Array.isArray(o.orderItems) ? o.orderItems.map(item => ({
          name: item.title || item.name || "Product",
          size: item.size || "M",
          quantity: item.quantity || item.qty || 1,
          price: item.price || 0
        })) : []
      }));

      serverOrders.forEach(so => {
        const idx = combinedOrders.findIndex(lo => String(lo.id) === String(so.id) || String(lo._id) === String(so._id));
        if (idx === -1) {
          combinedOrders.unshift(so);
        } else {
          if (combinedOrders[idx].status) {
            so.status = combinedOrders[idx].status;
          }
        }
      });
    }
  } catch (err) {
    console.warn("Using local orders list fallback");
  }

  orders = combinedOrders;
  localStorage.setItem("orders", JSON.stringify(orders));
  renderOrders();
}

function renderOrders(filteredOrders = orders) {
  const ordersBody = document.getElementById("orders-body");
  if (!ordersBody) return;

  let html = "";
  filteredOrders.forEach(order => {
    const orderIdentifier = order._id || order.id || order.orderId;
    const currentStatus = order.status || order.orderStatus || "Pending";
    const formattedStatus = currentStatus.charAt(0).toUpperCase() + currentStatus.slice(1).toLowerCase();

    html += `
      <tr>
        <td><strong>${order.id || order.orderId}</strong></td>
        <td>${order.customer}</td>
        <td>₹${order.total || order.grandTotal || 0}</td>
        <td>
          <select class="status-select ${formattedStatus.toLowerCase()}" onchange="updateOrderStatus('${orderIdentifier}', this.value)">
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
            <button class="delete-btn" onclick="deleteSingleOrder('${orderIdentifier}')" style="background:#dc2626; color:white; padding:4px 8px; border-radius:6px; border:none; cursor:pointer;" title="Delete Test Order">🗑 Delete</button>
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

  // 1. Update orders array in memory
  const order = orders.find(o => String(o.id) === String(id) || String(o._id) === String(id) || String(o.orderId) === String(id));
  if (order) {
    order.status = normalizedStatus;
    order.orderStatus = normalizedStatus;
  }

  // 2. Update orders in localStorage
  const localOrders = JSON.parse(localStorage.getItem("orders")) || [];
  const localIdx = localOrders.findIndex(lo => String(lo.id) === String(id) || String(lo._id) === String(id) || String(lo.orderId) === String(id));
  if (localIdx > -1) {
    localOrders[localIdx].status = normalizedStatus;
    localOrders[localIdx].orderStatus = normalizedStatus;
    localStorage.setItem("orders", JSON.stringify(localOrders));
  } else if (order) {
    localOrders.unshift(order);
    localStorage.setItem("orders", JSON.stringify(localOrders));
  }

  // 3. Update lastOrder if matching
  const lastOrder = JSON.parse(localStorage.getItem("lastOrder"));
  if (lastOrder && (String(lastOrder.id) === String(id) || String(lastOrder.orderId) === String(id) || String(lastOrder._id) === String(id))) {
    lastOrder.status = normalizedStatus;
    lastOrder.orderStatus = normalizedStatus;
    localStorage.setItem("lastOrder", JSON.stringify(lastOrder));
  }

  // 4. Try updating on REST API backend
  try {
    await API.put(`/orders/${id}/status`, { orderStatus: normalizedStatus.toLowerCase() }, { isAdmin: true });
  } catch (err) {
    console.warn("Updated status locally in Admin panel");
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

function deleteSingleOrder(id) {
  if (!confirm("Delete this test order permanently?")) return;
  orders = orders.filter(o => String(o.id) !== String(id) && String(o._id) !== String(id) && String(o.orderId) !== String(id));
  localStorage.setItem("orders", JSON.stringify(orders));

  const lastOrder = JSON.parse(localStorage.getItem("lastOrder"));
  if (lastOrder && (String(lastOrder.id) === String(id) || String(lastOrder.orderId) === String(id))) {
    localStorage.removeItem("lastOrder");
  }

  renderOrders();
  if (typeof showToast === "function") showToast("🗑 Test order deleted");
  else alert("Test order deleted successfully.");
}

function clearAllOrders() {
  if (!confirm("⚠️ ARE YOU SURE? This will delete ALL test order history and reset total revenue to ₹0 for testing!")) return;
  orders = [];
  localStorage.removeItem("orders");
  localStorage.removeItem("lastOrder");
  renderOrders();
  if (typeof showToast === "function") showToast("🗑 All test orders cleared! Revenue reset to ₹0.");
  else alert("All test orders cleared! Total revenue reset to ₹0.");
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
      <p><strong>Phone:</strong> ${order.phone || "N/A"}</p>
      <p><strong>Payment:</strong> ${order.payment || "COD"}</p>
      <p><strong>Address:</strong> ${order.address || "N/A"}</p>
      <p><strong>Current Status:</strong> <span class="badge ${order.status ? order.status.toLowerCase() : 'pending'}">${order.status || 'Pending'}</span></p><br>
      <h3>Ordered Items</h3>
      <ul>${itemsHTML}</ul>
      <h2>Total : ₹${order.total || order.grandTotal || 0}</h2>
    `;
  }
  const modal = document.getElementById("order-modal");
  if (modal) modal.style.display = "flex";
}

function updateOrderStatistics() {
  const totalOrders = orders.length;
  const pendingOrders = orders.filter(o => (o.status || "").toLowerCase() === "pending").length;
  const shippedOrders = orders.filter(o => (o.status || "").toLowerCase() === "shipped" || (o.status || "").toLowerCase() === "delivered").length;
  
  // DEDUCT CANCELLED ORDERS FROM REVENUE: Only sum non-cancelled orders!
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

function closeOrderModal() {
  const modal = document.getElementById("order-modal");
  if (modal) modal.style.display = "none";
}

window.closeOrderModal = closeOrderModal;
window.clearAllOrders = clearAllOrders;
window.deleteSingleOrder = deleteSingleOrder;

document.addEventListener("DOMContentLoaded", () => {
  loadAdminOrders();

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