// ===============================
// MY ORDERS / TRACK ORDER — PRODUCTION-HARDENED
// Primary data source: Supabase (uses auth.uid() for secure isolation)
// ===============================

let currentUser = null;
let currentOrder = null;
let allUserOrders = []; // Full list of all orders for this user

// Resolve authenticated user asynchronously
async function resolveUserSession() {
  if (window.supabaseClient && window.SupabaseAuth) {
    try {
      const { user, session } = await SupabaseAuth.getSession();
      if (user) {
        currentUser = {
          id: user.id,
          name: user.user_metadata?.full_name || user.user_metadata?.name || user.email.split('@')[0],
          email: user.email,
          phone: user.user_metadata?.phone || '',
          role: 'customer'
        };
        // Sync access token for REST API calls
        if (window.API && session?.access_token) {
          API.setToken(session.access_token);
          API.setCurrentUser(currentUser);
        }
        return currentUser;
      }
    } catch (e) {
      console.warn('[My Orders] Supabase session check notice:', e.message);
    }
  }

  // Fallback: legacy API storage
  if (window.API) {
    const legacyUser = API.getCurrentUser();
    if (legacyUser && (legacyUser.id || legacyUser.email)) {
      currentUser = legacyUser;
      return currentUser;
    }
  }

  return null;
}

async function loadOrderData() {
  const activeUser = await resolveUserSession();

  // Get search param
  const urlParams = new URLSearchParams(window.location.search);
  const queryOrderId = urlParams.get("orderId");
  const searchInput = document.getElementById("search-order-id");
  const targetId = (queryOrderId || (searchInput ? searchInput.value.trim() : null) || "").trim();

  // Not logged in and no specific order ID
  if (!activeUser && !targetId) {
    showNoOrders(`
      <div style="text-align:center; padding: 40px 20px;">
        <h2 style="color:#fbbf24; margin-bottom:12px;">Track Your Order</h2>
        <p style="color:#cbd5e1; max-width:480px; margin:0 auto 20px auto;">
          Please sign in to view all your orders automatically, or enter your Order ID in the search box above.
        </p>
        <a href="login.html?redirect=track-order.html" class="collection-btn" style="display:inline-block; padding:10px 24px;">Sign In to View My Orders</a>
      </div>
    `);
    return;
  }

  const userEmail = (activeUser?.email || "").toLowerCase();
  const userId = activeUser?.id || null;

  // ── FETCH ALL ORDERS FOR THIS USER FROM SUPABASE (PRIMARY) ──────────────────
  allUserOrders = [];

  if (window.supabaseClient) {
    try {
      let sbQuery = window.supabaseClient
        .from('orders')
        .select('*, order_items(*)')
        .order('created_at', { ascending: false });

      if (targetId) {
        // Searching for a specific order — allow by order_number or UUID
        sbQuery = sbQuery.or(`order_number.eq.${targetId},id.eq.${targetId}`);
      } else if (userId) {
        // Authenticated user: filter by user_id (most reliable — uses auth.uid() via RLS)
        // RLS policy ensures they can ONLY see their own orders regardless of query
        sbQuery = sbQuery.eq('user_id', userId);
      } else if (userEmail) {
        // Email fallback for legacy orders
        sbQuery = sbQuery.eq('customer_email', userEmail);
      }

      const { data: sbData, error: sbErr } = await sbQuery;

      if (sbErr) {
        console.warn('[My Orders] Supabase query error:', sbErr.message);
      } else if (Array.isArray(sbData)) {
        allUserOrders = sbData.map(s => ({
          id: s.order_number || s.id,
          orderId: s.order_number || s.id,
          _id: s.id,
          orderDate: s.created_at,
          status: s.order_status || 'Processing',
          total: s.total,
          grandTotal: s.total,
          paymentMethod: s.payment_method || 'COD',
          paymentStatus: s.payment_status || 'Pending',
          razorpayPaymentId: s.razorpay_payment_id || '',
          subtotal: s.subtotal,
          shipping: s.shipping,
          tax: s.tax,
          customer: {
            name: s.customer_name || activeUser?.name || 'Customer',
            email: s.customer_email || userEmail,
            phone: s.customer_phone || 'N/A',
            address: s.shipping_address?.street || '',
            city: s.shipping_address?.city || '',
            state: s.shipping_address?.state || '',
            pincode: s.shipping_address?.postalCode || ''
          },
          items: Array.isArray(s.order_items) ? s.order_items.map(i => ({
            name: i.name || 'Product',
            size: i.size || 'M',
            quantity: i.quantity || 1,
            price: i.price || 0
          })) : []
        }));
      }
    } catch (e) {
      console.warn('[My Orders] Supabase fetch exception:', e.message);
    }
  }

  // ── SUPPLEMENT WITH LOCAL ORDERS (same user, deduplicated) ──────────────────
  if (!targetId && userEmail) {
    const rawAllLocal = JSON.parse(localStorage.getItem("orders")) || [];
    const filteredLocal = rawAllLocal.filter(o => {
      const oEmail = (o.email || o.customerEmail || "").toLowerCase();
      return oEmail && oEmail === userEmail;
    });

    filteredLocal.forEach(lo => {
      if (!allUserOrders.some(o => String(o.id) === String(lo.id) || String(o.orderId) === String(lo.orderId))) {
        allUserOrders.push({
          ...lo,
          items: lo.items || lo.cart || []
        });
      }
    });
  }

  // ── SECURITY VERIFICATION: All returned orders must belong to this user ──────
  // (RLS handles this server-side, but double-check client-side as well)
  if (userEmail && !targetId) {
    allUserOrders = allUserOrders.filter(o => {
      const oEmail = (o.customer?.email || o.email || o.customerEmail || "").toLowerCase();
      const oUserId = o.userId || o.user_id;
      // Must match by email OR by user_id
      return oEmail === userEmail || (userId && oUserId === userId);
    });
  }

  // ── RENDER MY ORDERS LIST ───────────────────────────────────────────────────
  if (!targetId && allUserOrders.length > 0) {
    renderMyOrdersList(allUserOrders);
  } else if (targetId) {
    // Track specific order
    const matched = allUserOrders[0] || null;
    if (!matched) {
      showNoOrders(`
        <div style="text-align:center; padding: 40px 20px;">
          <h2 style="color:#fbbf24; margin-bottom:12px;">📦 Order Not Found</h2>
          <p style="color:#cbd5e1; max-width:480px; margin:0 auto 20px auto;">
            We couldn't find order #${targetId}. Please check the Order ID and try again.
          </p>
          <a href="collection.html" class="collection-btn" style="display:inline-block; padding:10px 24px;">Explore Collection</a>
        </div>
      `);
      return;
    }
    currentOrder = matched;
    showOrderDetails();
  } else if (allUserOrders.length === 0) {
    showNoOrders(`
      <div style="text-align:center; padding: 40px 20px;">
        <div style="font-size:3.5rem; margin-bottom:15px;">📦</div>
        <h2 style="color:#fbbf24; font-family:'Cinzel',serif; font-size:1.6rem; margin-bottom:10px;">No Orders Yet</h2>
        <p style="color:#cbd5e1; font-size:1rem; max-width:450px; margin:0 auto 25px auto;">
          You haven't placed any orders with this account yet. Explore our royal collection!
        </p>
        <a href="collection.html" class="checkout-btn" style="text-decoration:none; display:inline-block; padding:12px 28px;">👑 Explore Collection</a>
      </div>
    `);
  }
}

/**
 * Renders a list of all orders for the current user (the "My Orders" page).
 * Clicking an order shows full tracking details.
 */
function renderMyOrdersList(ordersList) {
  const noOrdersContainer = document.getElementById("no-orders-container");
  const orderDetailsContainer = document.getElementById("order-details-container");
  const progressBoxContainer = document.getElementById("progress-box-container");

  if (orderDetailsContainer) orderDetailsContainer.style.display = "none";
  if (progressBoxContainer) progressBoxContainer.style.display = "none";

  if (!noOrdersContainer) return;
  noOrdersContainer.style.display = "block";

  const listHTML = ordersList.map(o => {
    const status = o.status || o.orderStatus || 'Processing';
    const statusColor = {
      delivered: '#22c55e', shipped: '#3b82f6', cancelled: '#ef4444',
      processing: '#f59e0b', confirmed: '#6366f1', packed: '#8b5cf6', pending: '#94a3b8'
    }[status.toLowerCase()] || '#94a3b8';

    const itemCount = o.items?.length || 0;
    const total = o.total || o.grandTotal || 0;
    const date = o.orderDate ? new Date(o.orderDate).toLocaleDateString("en-IN") : (o.date || "");

    return `
      <div onclick="showOrderById('${o.id}')" style="
        background: rgba(15,23,42,0.8);
        border: 1px solid rgba(251,191,36,0.2);
        border-radius: 12px;
        padding: 18px 22px;
        margin-bottom: 16px;
        cursor: pointer;
        transition: border-color 0.2s, box-shadow 0.2s;
      " onmouseover="this.style.borderColor='rgba(251,191,36,0.5)'; this.style.boxShadow='0 4px 20px rgba(251,191,36,0.1)'"
         onmouseout="this.style.borderColor='rgba(251,191,36,0.2)'; this.style.boxShadow='none'">
        <div style="display:flex; justify-content:space-between; align-items:flex-start; flex-wrap:wrap; gap:10px;">
          <div>
            <div style="color:#fbbf24; font-weight:700; font-size:1rem; margin-bottom:4px;">${o.id || o.orderId}</div>
            <div style="color:#94a3b8; font-size:0.85rem;">${date} · ${itemCount} item${itemCount !== 1 ? 's' : ''}</div>
          </div>
          <div style="text-align:right;">
            <div style="color:#f5eedf; font-weight:700; font-size:1.05rem;">₹${total}</div>
            <div style="color:${statusColor}; font-weight:600; font-size:0.88rem; margin-top:3px;">${status}</div>
          </div>
        </div>
        ${o.customer?.name ? `<div style="color:#cbd5e1; font-size:0.88rem; margin-top:8px; border-top:1px solid rgba(255,255,255,0.05); padding-top:8px;">Deliver to: ${o.customer.name}</div>` : ''}
        <div style="color:#d4af37; font-size:0.8rem; margin-top:6px; text-align:right;">Click to track →</div>
      </div>
    `;
  }).join('');

  noOrdersContainer.innerHTML = `
    <div style="text-align:left; padding: 10px 0;">
      <h2 style="color:#fbbf24; margin-bottom:20px; font-family:'Cinzel',serif;">📦 My Orders (${ordersList.length})</h2>
      ${listHTML}
    </div>
  `;
}

/**
 * Show tracking details for a specific order from the list.
 */
window.showOrderById = function(orderId) {
  const order = allUserOrders.find(o => String(o.id) === String(orderId) || String(o.orderId) === String(orderId));
  if (!order) return;
  currentOrder = order;
  showOrderDetails();
};

function showOrderDetails() {
  const noOrdersContainer = document.getElementById("no-orders-container");
  const orderDetailsContainer = document.getElementById("order-details-container");
  const progressBoxContainer = document.getElementById("progress-box-container");

  if (noOrdersContainer) noOrdersContainer.style.display = "none";
  if (orderDetailsContainer) orderDetailsContainer.style.display = "block";
  if (progressBoxContainer) progressBoxContainer.style.display = "block";

  renderOrderInfo();
  updateProgressUI();
}

function showNoOrders(html) {
  const noOrdersContainer = document.getElementById("no-orders-container");
  const orderDetailsContainer = document.getElementById("order-details-container");
  const progressBoxContainer = document.getElementById("progress-box-container");

  if (orderDetailsContainer) orderDetailsContainer.style.display = "none";
  if (progressBoxContainer) progressBoxContainer.style.display = "none";
  if (noOrdersContainer) {
    noOrdersContainer.style.display = "block";
    noOrdersContainer.innerHTML = html;
  }
}

function renderOrderInfo() {
  if (!currentOrder) return;

  const trackOrderId = document.getElementById("track-order-id");
  const trackOrderDate = document.getElementById("track-order-date");
  const trackDeliveryDate = document.getElementById("track-delivery-date");
  const customerName = document.getElementById("customer-name");
  const customerEmail = document.getElementById("customer-email");
  const customerPhone = document.getElementById("customer-phone");
  const customerAddress = document.getElementById("customer-address");
  const trackingNumber = document.getElementById("tracking-number");

  const orderIdVal = currentOrder.orderId || currentOrder.id || "#1001";
  if (trackOrderId) trackOrderId.innerHTML = orderIdVal;
  if (trackOrderDate) trackOrderDate.innerHTML = new Date(currentOrder.orderDate || Date.now()).toLocaleDateString("en-IN");

  const delivery = new Date(currentOrder.orderDate || Date.now());
  delivery.setDate(delivery.getDate() + 5);
  if (trackDeliveryDate) trackDeliveryDate.innerHTML = delivery.toLocaleDateString("en-IN");

  const custObj = currentOrder.customer || {};
  if (customerName) customerName.innerHTML = custObj.name || currentOrder.customer || "Customer";
  if (customerEmail) customerEmail.innerHTML = custObj.email || currentOrder.email || "";
  if (customerPhone) customerPhone.innerHTML = custObj.phone || currentOrder.phone || "N/A";

  if (customerAddress) {
    if (currentOrder.address) {
      customerAddress.innerHTML = currentOrder.address;
    } else {
      customerAddress.innerHTML = [custObj.address, custObj.city, custObj.state, custObj.pincode].filter(Boolean).join(', ');
    }
  }

  if (trackingNumber) trackingNumber.innerHTML = "BBX" + String(orderIdVal).replace(/[^0-9]/g, "");
}

function getStageFromStatus(statusStr) {
  if (!statusStr) return 0;
  const s = statusStr.toLowerCase();
  if (s.includes("cancel")) return -1;
  if (s.includes("deliver")) return 4;
  if (s.includes("ship")) return 3;
  if (s.includes("pack")) return 2;
  if (s.includes("confirm")) return 1;
  return 0;
}

function updateProgressUI() {
  if (!currentOrder) return;

  const steps = [
    document.getElementById("step1"),
    document.getElementById("step2"),
    document.getElementById("step3"),
    document.getElementById("step4"),
    document.getElementById("step5")
  ].filter(Boolean);

  const progressFill = document.getElementById("progress-fill");
  const progressPercent = document.getElementById("progress-percent");
  const currentStatus = document.getElementById("current-status");
  const arrival = document.getElementById("arrival-time");
  const message = document.getElementById("delivery-message");

  const rawStatus = currentOrder.status || currentOrder.orderStatus || "Processing";
  const formattedStatus = rawStatus.charAt(0).toUpperCase() + rawStatus.slice(1).toLowerCase();
  const stage = getStageFromStatus(formattedStatus);

  if (stage === -1) {
    steps.forEach(st => st.classList.remove("active"));
    if (progressFill) { progressFill.style.width = "100%"; progressFill.style.background = "#ef4444"; }
    if (progressPercent) progressPercent.innerHTML = "Cancelled";
    if (currentStatus) currentStatus.innerHTML = `<span style="color:#ef4444; font-weight:bold;">Status : Order Cancelled ❌</span>`;
    if (message) message.innerHTML = "This order has been cancelled.";
    if (arrival) arrival.innerHTML = "Cancelled";
    return;
  }

  steps.forEach(st => st.classList.remove("active"));
  for (let i = 0; i <= stage && i < steps.length; i++) {
    steps[i].classList.add("active");
  }

  const percent = Math.min(100, Math.round(((stage + 1) / Math.max(steps.length, 1)) * 100));
  if (progressFill) {
    progressFill.style.width = percent + "%";
    progressFill.style.background = "linear-gradient(90deg, #D4AF37 0%, #22c55e 100%)";
  }
  if (progressPercent) progressPercent.innerHTML = percent + "%";
  if (currentStatus) currentStatus.innerHTML = `<strong>Current Status :</strong> <span style="color:#D4AF37;">${formattedStatus}</span>`;

  const van = document.querySelector(".delivery-van");
  if (van) van.style.left = Math.max(0, percent - 5) + "%";

  const statusTexts = {
    0: "Your order has been placed & is being processed.",
    1: "Your order has been confirmed by Beard Banna.",
    2: "Your items are being packed & quality checked.",
    3: "Your parcel has been shipped & is in transit.",
    4: "Your parcel has been delivered successfully. Wear your legacy with pride! 👑"
  };

  if (message) message.innerHTML = statusTexts[stage] || `Current status: ${formattedStatus}`;
  const hoursLeft = Math.max(0, 24 - (stage * 6));
  if (arrival) arrival.innerHTML = hoursLeft > 0 ? hoursLeft + " Hours" : "Delivered";
}

document.addEventListener("DOMContentLoaded", async () => {
  await loadOrderData();
});

// Expose for HTML onclick
window.loadOrderData = loadOrderData;