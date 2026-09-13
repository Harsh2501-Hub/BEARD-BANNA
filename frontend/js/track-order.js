// ===============================
// TRACK ORDER - REAL-TIME SUPABASE & ADMIN SYNCED
// ===============================

let currentUser = null;
let currentOrder = null;

// Resolve authenticated user asynchronously without blocking or race conditions
async function resolveUserSession() {
  // 1. Try Supabase Auth session first (handles Google OAuth & email login)
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
        if (window.API) {
          API.setCurrentUser(currentUser);
          if (session?.access_token) {
            API.setToken(session.access_token);
          }
        }
        return currentUser;
      }
    } catch (e) {
      console.warn('[Track Order] Supabase session check notice:', e.message);
    }
  }

  // 2. Try legacy API storage
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
  const userEmail = (activeUser?.email || "").toLowerCase();

  // 1. Check if user typed an order ID into search input or query param
  const urlParams = new URLSearchParams(window.location.search);
  const queryOrderId = urlParams.get("orderId");
  const searchInput = document.getElementById("search-order-id");
  const targetId = (queryOrderId || (searchInput ? searchInput.value.trim() : null) || "").trim();

  // Guard: Not logged in and no specific orderId requested
  if (!activeUser && !targetId) {
    const noOrdersContainer = document.getElementById("no-orders-container");
    const orderDetailsContainer = document.getElementById("order-details-container");
    const progressBoxContainer = document.getElementById("progress-box-container");

    if (orderDetailsContainer) orderDetailsContainer.style.display = "none";
    if (progressBoxContainer) progressBoxContainer.style.display = "none";
    if (noOrdersContainer) {
      noOrdersContainer.style.display = "block";
      noOrdersContainer.innerHTML = `
        <div style="text-align:center; padding: 40px 20px;">
          <h2 style="color:#fbbf24; margin-bottom:12px;">Track Your Order</h2>
          <p style="color:#cbd5e1; max-width:480px; margin:0 auto 20px auto;">
            Please sign in to view your orders automatically, or enter your Order ID in the search box above.
          </p>
          <a href="login.html?redirect=track-order.html" class="collection-btn" style="display:inline-block; padding:10px 24px;">Sign In with Google</a>
        </div>
      `;
    }
    return;
  }

  // Get raw local data
  const rawLastOrder = JSON.parse(localStorage.getItem("lastOrder"));
  const rawAllLocalOrders = JSON.parse(localStorage.getItem("orders")) || [];

  // Filter local orders strictly by logged-in user email
  const allLocalOrders = rawAllLocalOrders.filter(o => {
    const oEmail = (o.email || o.customerEmail || "").toLowerCase();
    return userEmail && oEmail && oEmail === userEmail;
  });

  const lastOrder = (rawLastOrder && (!userEmail || (rawLastOrder.email || rawLastOrder.customerEmail || "").toLowerCase() === userEmail)) ? rawLastOrder : null;

  // 2. Fetch from Supabase Orders table
  let supabaseOrders = [];
  if (window.supabaseClient) {
    try {
      let sbQuery = window.supabaseClient.from('orders').select('*');
      if (targetId) {
        sbQuery = sbQuery.or(`order_number.eq.${targetId},id.eq.${targetId}`);
      } else if (userEmail) {
        sbQuery = sbQuery.eq('customer_email', userEmail);
      }
      const { data: sbData, error: sbErr } = await sbQuery.order('created_at', { ascending: false });
      if (!sbErr && Array.isArray(sbData)) {
        supabaseOrders = sbData.map(s => ({
          id: s.order_number || s.id,
          orderId: s.order_number || s.id,
          _id: s.id,
          orderDate: s.created_at,
          status: s.order_status || 'Pending',
          total: s.total,
          grandTotal: s.total,
          customer: {
            name: s.customer_name || activeUser?.name || 'Customer',
            email: s.customer_email || userEmail,
            phone: s.customer_phone || 'N/A',
            address: s.shipping_address?.street || '',
            city: s.shipping_address?.city || '',
            state: s.shipping_address?.state || '',
            pincode: s.shipping_address?.postalCode || ''
          }
        }));
      }
    } catch (e) {
      console.warn('[Track Order] Supabase orders query error:', e.message);
    }
  }

  // 3. Try fetching latest server orders for this user from REST API fallback
  let serverOrders = [];
  const activeToken = window.API ? API.getToken() : null;
  if (activeToken || userEmail) {
    try {
      const endpoint = userEmail ? `/orders/my-orders?email=${encodeURIComponent(userEmail)}` : '/orders/my-orders';
      const res = await API.get(endpoint);
      if (res.success && Array.isArray(res.data?.orders)) {
        serverOrders = res.data.orders;
      }
    } catch (err) {
      // Backend offline notice handled silently
    }
  }

  currentOrder = null;

  if (targetId) {
    // Find matching order in Supabase, local storage or server orders
    const matchedSb = supabaseOrders.find(o => String(o.id) === String(targetId) || String(o.orderId) === String(targetId));
    const matchedLocal = rawAllLocalOrders.find(o => String(o.id) === String(targetId) || String(o.orderId) === String(targetId) || String(o._id) === String(targetId));
    const matchedServer = serverOrders.find(o => String(o.orderNumber) === String(targetId) || String(o.orderId) === String(targetId) || String(o._id) === String(targetId));

    if (matchedSb) {
      currentOrder = matchedSb;
    } else if (matchedLocal) {
      currentOrder = matchedLocal;
    } else if (matchedServer) {
      currentOrder = {
        orderId: matchedServer.orderNumber || matchedServer.orderId || matchedServer._id,
        orderDate: matchedServer.createdAt || matchedServer.orderDate,
        status: matchedServer.orderStatus ? matchedServer.orderStatus.charAt(0).toUpperCase() + matchedServer.orderStatus.slice(1) : "Pending",
        customer: {
          name: matchedServer.shippingAddress?.fullName || matchedServer.customerName || activeUser?.name || "Customer",
          email: matchedServer.customerEmail || activeUser?.email || "customer@clothing.com",
          phone: matchedServer.shippingAddress?.phone || matchedServer.customerPhone || "N/A",
          address: matchedServer.shippingAddress?.street || "",
          city: matchedServer.shippingAddress?.city || "",
          state: matchedServer.shippingAddress?.state || "",
          pincode: matchedServer.shippingAddress?.postalCode || ""
        }
      };
    }
  }

  // Fallback to user's first Supabase order, lastOrder, or first local order
  if (!currentOrder && !targetId) {
    if (supabaseOrders.length > 0) {
      currentOrder = supabaseOrders[0];
    } else if (lastOrder) {
      const matchingLocal = allLocalOrders.find(o => String(o.id) === String(lastOrder.id) || String(o.orderId) === String(lastOrder.orderId));
      currentOrder = matchingLocal || lastOrder;
    } else if (allLocalOrders.length > 0) {
      currentOrder = allLocalOrders[0];
    } else if (serverOrders.length > 0) {
      const s = serverOrders[0];
      currentOrder = {
        orderId: s.orderNumber || s.orderId || s._id,
        orderDate: s.createdAt || s.orderDate,
        status: s.orderStatus ? s.orderStatus.charAt(0).toUpperCase() + s.orderStatus.slice(1) : "Pending",
        customer: {
          name: s.shippingAddress?.fullName || s.customerName || activeUser?.name || "Customer",
          email: s.customerEmail || activeUser?.email || "customer@clothing.com",
          phone: s.shippingAddress?.phone || s.customerPhone || "N/A",
          address: s.shippingAddress?.street || "",
          city: s.shippingAddress?.city || "",
          state: s.shippingAddress?.state || "",
          pincode: s.shippingAddress?.postalCode || ""
        }
      };
    }
  }

  const noOrdersContainer = document.getElementById("no-orders-container");
  const orderDetailsContainer = document.getElementById("order-details-container");
  const progressBoxContainer = document.getElementById("progress-box-container");

  if (!currentOrder) {
    if (targetId) {
      if (typeof showToast === "function") showToast(`Order #${targetId} not found.`);
      else alert(`Order #${targetId} not found.`);
    }
    if (noOrdersContainer) {
      noOrdersContainer.style.display = "block";
      noOrdersContainer.innerHTML = `
        <div style="text-align:center; padding: 40px 20px;">
          <h2 style="color:#fbbf24; margin-bottom:12px;">📦 No Orders Found</h2>
          <p style="color:#cbd5e1; max-width:480px; margin:0 auto 20px auto;">
            ${targetId ? `We couldn't find order #${targetId}. Please check the Order ID and try again.` : `You don't have any placed orders yet.`}
          </p>
          <a href="collection.html" class="collection-btn" style="display:inline-block; padding:10px 24px;">Explore Collection</a>
        </div>
      `;
    }
    if (orderDetailsContainer) orderDetailsContainer.style.display = "none";
    if (progressBoxContainer) progressBoxContainer.style.display = "none";
    return;
  }

  if (noOrdersContainer) noOrdersContainer.style.display = "none";
  if (orderDetailsContainer) orderDetailsContainer.style.display = "block";
  if (progressBoxContainer) progressBoxContainer.style.display = "block";

  renderOrderInfo();
  updateProgressUI();
}

function renderOrderInfo() {
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
  if (customerEmail) customerEmail.innerHTML = custObj.email || currentOrder.email || "customer@clothing.com";
  if (customerPhone) customerPhone.innerHTML = custObj.phone || currentOrder.phone || "N/A";
  
  if (customerAddress) {
    if (currentOrder.address) {
      customerAddress.innerHTML = currentOrder.address;
    } else {
      customerAddress.innerHTML = `${custObj.address || ''}, ${custObj.city || ''}, ${custObj.state || ''} - ${custObj.pincode || ''}`;
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
  return 0; // Pending / Placed
}

function updateProgressUI() {
  const steps = [
    document.getElementById("step1"),
    document.getElementById("step2"),
    document.getElementById("step3"),
    document.getElementById("step4"),
    document.getElementById("step5")
  ].filter(Boolean);

  const times = [
    document.getElementById("time1"),
    document.getElementById("time2"),
    document.getElementById("time3"),
    document.getElementById("time4"),
    document.getElementById("time5")
  ].filter(Boolean);

  const progressFill = document.getElementById("progress-fill");
  const progressPercent = document.getElementById("progress-percent");
  const currentStatus = document.getElementById("current-status");
  const arrival = document.getElementById("arrival-time");
  const message = document.getElementById("delivery-message");

  const rawStatus = currentOrder.status || currentOrder.orderStatus || "Pending";
  const formattedStatus = rawStatus.charAt(0).toUpperCase() + rawStatus.slice(1).toLowerCase();
  const stage = getStageFromStatus(formattedStatus);

  // Handle Cancelled Order State
  if (stage === -1) {
    steps.forEach(st => st.classList.remove("active"));
    if (progressFill) {
      progressFill.style.width = "100%";
      progressFill.style.background = "#ef4444";
    }
    if (progressPercent) progressPercent.innerHTML = "Cancelled";
    if (currentStatus) {
      currentStatus.innerHTML = `<span style="color:#ef4444; font-weight:bold;">Status : Order Cancelled ❌</span>`;
    }
    if (message) message.innerHTML = "This order has been cancelled by admin or customer.";
    if (arrival) arrival.innerHTML = "Cancelled";
    return;
  }

  // Active Normal Progress Stages
  steps.forEach(st => st.classList.remove("active"));

  for (let i = 0; i <= stage && i < steps.length; i++) {
    steps[i].classList.add("active");
    if (times[i] && !times[i].innerHTML) {
      times[i].innerHTML = "Updated at " + new Date().toLocaleTimeString("en-IN", { hour: "2-digit", minute: "2-digit" });
    }
  }

  const percent = Math.min(100, Math.round(((stage + 1) / steps.length) * 100));
  if (progressFill) {
    progressFill.style.width = percent + "%";
    progressFill.style.background = "linear-gradient(90deg, #D4AF37 0%, #22c55e 100%)";
  }
  if (progressPercent) progressPercent.innerHTML = percent + "%";
  if (currentStatus) currentStatus.innerHTML = `<strong>Current Status :</strong> <span style="color:#D4AF37;">${formattedStatus}</span>`;

  const van = document.querySelector(".delivery-van");
  if (van) van.style.left = Math.max(0, percent - 5) + "%";

  const statusTexts = {
    0: "Your order has been placed & is pending confirmation.",
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

// Sync order status live if changed in another browser tab
window.addEventListener("storage", async () => {
  await loadOrderData();
});