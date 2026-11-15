// ==============================================================================
// BEARD BANNA — CROSS-DEVICE ORDER SYNCHRONIZATION & TRACKING
// Primary Engine: Supabase Central Database + Real-time Session Sync
// Solves:
//   - Cross-device sync between Mobile, Desktop, Tablet
//   - Order retrieval by Supabase auth.uid() AND verified Google email
//   - Safe Guest Tracking via RPC track_guest_order
//   - Zero "false empty" screens during asynchronous auth hydration
// ==============================================================================

let currentUser = null;
let currentOrder = null;
let allUserOrders = [];
let isAuthHydrated = false;
let authStateListenerAttached = false;

// ── 1. ASYNCHRONOUS AUTH HYDRATION WITH RETRY GUARD ──────────────────────────
async function resolveUserSession(maxWaitMs = 1200) {
  // Return cached user if already verified
  if (currentUser && currentUser.id) return currentUser;

  const startTime = Date.now();

  while (Date.now() - startTime < maxWaitMs) {
    if (window.supabaseClient) {
      try {
        // Method A: Check client auth directly
        const { data: userData, error: userErr } = await window.supabaseClient.auth.getUser();
        if (userData?.user) {
          const u = userData.user;
          const { data: sessData } = await window.supabaseClient.auth.getSession();
          currentUser = {
            id: u.id,
            name: u.user_metadata?.full_name || u.user_metadata?.name || u.email?.split('@')[0] || 'Royal Member',
            email: (u.email || '').toLowerCase().trim(),
            phone: u.user_metadata?.phone || '',
            role: 'customer'
          };
          if (window.API && sessData?.session?.access_token) {
            API.setToken(sessData.session.access_token);
            API.setCurrentUser(currentUser);
          }
          isAuthHydrated = true;
          return currentUser;
        }

        // Method B: Check SupabaseAuth wrapper
        if (window.SupabaseAuth) {
          const { user: authUser, session: authSess } = await window.SupabaseAuth.getSession();
          if (authUser) {
            currentUser = {
              id: authUser.id,
              name: authUser.user_metadata?.full_name || authUser.user_metadata?.name || authUser.email?.split('@')[0] || 'Royal Member',
              email: (authUser.email || '').toLowerCase().trim(),
              phone: authUser.user_metadata?.phone || '',
              role: 'customer'
            };
            if (window.API && authSess?.access_token) {
              API.setToken(authSess.access_token);
              API.setCurrentUser(currentUser);
            }
            isAuthHydrated = true;
            return currentUser;
          }
        }
      } catch (err) {
        console.warn('[Track Order] Session hydration check notice:', err.message);
      }
    }

    // Wait 100ms before checking again
    await new Promise(r => setTimeout(r, 100));
  }

  // Fallback: legacy storage
  if (window.API) {
    const legacyUser = API.getCurrentUser();
    if (legacyUser && (legacyUser.id || legacyUser.email)) {
      currentUser = {
        ...legacyUser,
        email: (legacyUser.email || '').toLowerCase().trim()
      };
      isAuthHydrated = true;
      return currentUser;
    }
  }

  isAuthHydrated = true;
  return null;
}

// ── 2. ATTACH AUTH STATE CHANGE LISTENER ─────────────────────────────────────
function setupTrackOrderAuthListener() {
  if (authStateListenerAttached) return;
  if (window.supabaseClient && window.supabaseClient.auth) {
    authStateListenerAttached = true;
    window.supabaseClient.auth.onAuthStateChange(async (event, session) => {
      console.log('[Track Order] ⚡ Auth state changed:', event);
      if (event === 'SIGNED_IN' || event === 'TOKEN_REFRESHED' || event === 'USER_UPDATED') {
        if (session?.user) {
          currentUser = {
            id: session.user.id,
            name: session.user.user_metadata?.full_name || session.user.email?.split('@')[0],
            email: (session.user.email || '').toLowerCase().trim(),
            phone: session.user.user_metadata?.phone || '',
            role: 'customer'
          };
          // Re-fetch orders with newly established session
          await loadOrderData();
        }
      } else if (event === 'SIGNED_OUT') {
        currentUser = null;
        allUserOrders = [];
        showUnauthenticatedState();
      }
    });
  }
}

// ── 3. MAIN ORDER DATA LOADER & SYNCHRONIZER ─────────────────────────────────
async function loadOrderData() {
  setupTrackOrderAuthListener();

  // Check URL parameters for explicit tracking
  const urlParams = new URLSearchParams(window.location.search);
  const queryOrderId = (urlParams.get("orderId") || "").trim();
  const searchInput = document.getElementById("search-order-id");
  const targetId = (queryOrderId || (searchInput ? searchInput.value.trim() : null) || "").trim();

  // Show royal loading state while checking database
  renderLoadingState();

  const activeUser = await resolveUserSession();
  const userEmail = (activeUser?.email || "").toLowerCase().trim();
  const userId = activeUser?.id || null;

  // Case A: Unauthenticated and no target order ID requested
  if (!activeUser && !targetId) {
    showUnauthenticatedState();
    return;
  }

  // Case B: Explicit order tracking by ID
  if (targetId) {
    await trackSpecificOrder(targetId, activeUser);
    return;
  }

  // Case C: Authenticated customer viewing all orders across all devices
  await fetchAndDisplayCustomerOrders(userId, userEmail, activeUser);
}

// ── 4. FETCH ALL CUSTOMER ORDERS (PRIMARY SYNC ENGINE) ────────────────────────
async function fetchAndDisplayCustomerOrders(userId, userEmail, activeUser) {
  allUserOrders = [];
  let dbSuccess = false;
  let fetchError = null;

  if (window.supabaseClient) {
    // ── Attempt 1: Call public.get_customer_orders() RPC ────────────────────
    try {
      const { data: rpcData, error: rpcErr } = await window.supabaseClient.rpc('get_customer_orders');

      if (!rpcErr && Array.isArray(rpcData)) {
        dbSuccess = true;
        allUserOrders = rpcData.map(mapSupabaseOrderRecord);
      } else if (rpcErr) {
        console.warn('[Track Order] get_customer_orders RPC notice:', rpcErr.message);
      }
    } catch (e) {
      console.warn('[Track Order] RPC execution failed, attempting direct query:', e.message);
    }

    // ── Attempt 2: Direct SELECT query with Unified OR Filter ───────────────
    if (!dbSuccess) {
      try {
        let sbQuery = window.supabaseClient
          .from('orders')
          .select('*, order_items(*)')
          .order('created_at', { ascending: false });

        if (userId && userEmail) {
          // Unified cross-device filter: matches user_id OR customer_email!
          sbQuery = sbQuery.or(`user_id.eq.${userId},customer_email.eq.${userEmail}`);
        } else if (userId) {
          sbQuery = sbQuery.eq('user_id', userId);
        } else if (userEmail) {
          sbQuery = sbQuery.eq('customer_email', userEmail);
        }

        const { data: directData, error: directErr } = await sbQuery;

        if (!directErr && Array.isArray(directData)) {
          dbSuccess = true;
          allUserOrders = directData.map(mapSupabaseOrderRecord);

          // Auto-claim unlinked orders in background
          try {
            await window.supabaseClient.rpc('claim_customer_orders');
          } catch (e) {}
        } else if (directErr) {
          fetchError = directErr.message;
          console.error('[Track Order] Supabase direct query error:', directErr);
        }
      } catch (e) {
        fetchError = e.message;
        console.error('[Track Order] Supabase fetch exception:', e);
      }
    }
  }

  // ── Attempt 3: Deduplicate with Local Storage (Safe Offline Fallback) ───────
  if (userEmail) {
    try {
      const rawLocal = JSON.parse(localStorage.getItem("orders") || "[]");
      const filteredLocal = rawLocal.filter(o => {
        const oEmail = (o.email || o.customerEmail || "").toLowerCase().trim();
        return oEmail && oEmail === userEmail;
      });

      filteredLocal.forEach(lo => {
        const loId = String(lo.id || lo.orderId || "");
        if (!allUserOrders.some(o => String(o.id) === loId || String(o.orderId) === loId)) {
          allUserOrders.push({
            ...lo,
            id: loId,
            orderId: loId,
            items: lo.items || lo.cart || []
          });
        }
      });
    } catch (e) {}
  }

  // ── Sort Newest First ───────────────────────────────────────────────────────
  allUserOrders.sort((a, b) => {
    const timeA = new Date(a.orderDate || a.created_at || 0).getTime();
    const timeB = new Date(b.orderDate || b.created_at || 0).getTime();
    return timeB - timeA;
  });

  // ── Render Result State ─────────────────────────────────────────────────────
  if (allUserOrders.length > 0) {
    renderMyOrdersList(allUserOrders);
  } else if (!dbSuccess && fetchError) {
    renderErrorState(`Database connection issue: ${fetchError}`);
  } else {
    renderEmptyState();
  }
}

// ── 5. SPECIFIC ORDER TRACKING (FOR QUERY PARAM OR SEARCH) ───────────────────
async function trackSpecificOrder(targetId, activeUser) {
  const cleanTarget = targetId.trim();

  // 1. Check in-memory list first
  const existing = allUserOrders.find(o =>
    String(o.id || o.orderId).toUpperCase() === cleanTarget.toUpperCase()
  );
  if (existing) {
    currentOrder = existing;
    showOrderDetails();
    return;
  }

  // 2. Query Supabase
  if (window.supabaseClient) {
    // If logged in, search authenticated orders
    if (activeUser) {
      try {
        const { data, error } = await window.supabaseClient
          .from('orders')
          .select('*, order_items(*)')
          .or(`order_number.eq.${cleanTarget},id.eq.${cleanTarget}`)
          .limit(1);

        if (!error && Array.isArray(data) && data.length > 0) {
          currentOrder = mapSupabaseOrderRecord(data[0]);
          showOrderDetails();
          return;
        }
      } catch (e) {}
    }

    // 3. Guest order tracking via RPC
    const guestInput = document.getElementById("guest-contact-input");
    const contactInfo = guestInput ? guestInput.value.trim() : null;

    if (contactInfo) {
      try {
        const { data: rpcRes, error: rpcErr } = await window.supabaseClient.rpc('track_guest_order', {
          p_order_number: cleanTarget,
          p_phone_or_email: contactInfo
        });

        if (!rpcErr && rpcRes && rpcRes.success && rpcRes.order) {
          currentOrder = mapSupabaseOrderRecord(rpcRes.order);
          showOrderDetails();
          return;
        }
      } catch (e) {}
    }
  }

  // 4. Local storage fallback
  try {
    const rawLocal = JSON.parse(localStorage.getItem("orders") || "[]");
    const matchedLocal = rawLocal.find(o =>
      String(o.id || o.orderId).toUpperCase() === cleanTarget.toUpperCase()
    );
    if (matchedLocal) {
      currentOrder = {
        ...matchedLocal,
        id: matchedLocal.id || matchedLocal.orderId,
        orderId: matchedLocal.id || matchedLocal.orderId,
        items: matchedLocal.items || matchedLocal.cart || []
      };
      showOrderDetails();
      return;
    }
  } catch (e) {}

  // 5. If not found, show helpful verification prompt
  renderOrderNotFound(cleanTarget, !activeUser);
}

// ── 6. DATA MAPPER ───────────────────────────────────────────────────────────
function mapSupabaseOrderRecord(s) {
  const ordNum = s.order_number || s.id;
  const items = Array.isArray(s.order_items) ? s.order_items.map(i => ({
    name: i.name || 'Product',
    size: i.size || 'M',
    quantity: i.quantity || 1,
    price: i.price || 0,
    hsn: i.hsn || "6109"
  })) : (Array.isArray(s.items) ? s.items : []);

  const addr = s.shipping_address || {};

  return {
    id: ordNum,
    orderId: ordNum,
    _id: s.id,
    user_id: s.user_id,
    orderDate: s.created_at || s.orderDate,
    created_at: s.created_at,
    status: s.order_status || s.status || 'Processing',
    orderStatus: s.order_status || s.status || 'Processing',
    total: s.total || s.grandTotal || 0,
    grandTotal: s.total || s.grandTotal || 0,
    subtotal: s.subtotal || 0,
    shipping: s.shipping || 0,
    tax: s.tax || 0,
    discount: s.discount || 0,
    paymentMethod: s.payment_method || 'COD',
    paymentStatus: s.payment_status || 'Pending',
    razorpayOrderId: s.razorpay_order_id || '',
    razorpayPaymentId: s.razorpay_payment_id || '',
    gstDetails: s.gst_details || {},
    customer: {
      name: s.customer_name || 'Customer',
      email: s.customer_email || '',
      phone: s.customer_phone || 'N/A',
      address: addr.street || addr.address || (typeof addr === 'string' ? addr : ''),
      city: addr.city || '',
      state: addr.state || '',
      pincode: addr.postalCode || addr.pincode || ''
    },
    items: items
  };
}

// ── 7. UI RENDER STATES ──────────────────────────────────────────────────────
function renderLoadingState() {
  const noOrdersContainer = document.getElementById("no-orders-container");
  const orderDetailsContainer = document.getElementById("order-details-container");
  const progressBoxContainer = document.getElementById("progress-box-container");

  if (orderDetailsContainer) orderDetailsContainer.style.display = "none";
  if (progressBoxContainer) progressBoxContainer.style.display = "none";

  if (noOrdersContainer) {
    noOrdersContainer.style.display = "block";
    noOrdersContainer.innerHTML = `
      <div style="text-align:center; padding: 45px 20px;">
        <div style="
          border: 3px solid rgba(251,191,36,0.2);
          border-top: 3px solid #fbbf24;
          border-radius: 50%;
          width: 44px;
          height: 44px;
          animation: spinBB 0.8s linear infinite;
          margin: 0 auto 18px auto;
        "></div>
        <h3 style="color:#fbbf24; font-family:'Cinzel',serif; font-size:1.25rem; margin-bottom:8px; letter-spacing:0.5px;">
          Synchronizing Your Royal Orders...
        </h3>
        <p style="color:#94a3b8; font-size:0.9rem; max-width:400px; margin:0 auto;">
          Connecting with BEARD BANNA central database across your devices.
        </p>
      </div>
      <style>
        @keyframes spinBB { 0% { transform: rotate(0deg); } 100% { transform: rotate(360deg); } }
      </style>
    `;
  }
}

function showUnauthenticatedState() {
  const noOrdersContainer = document.getElementById("no-orders-container");
  const orderDetailsContainer = document.getElementById("order-details-container");
  const progressBoxContainer = document.getElementById("progress-box-container");

  if (orderDetailsContainer) orderDetailsContainer.style.display = "none";
  if (progressBoxContainer) progressBoxContainer.style.display = "none";

  if (noOrdersContainer) {
    noOrdersContainer.style.display = "block";
    noOrdersContainer.innerHTML = `
      <div style="text-align:center; padding: 40px 20px;">
        <div style="font-size:3.2rem; margin-bottom:15px;">👑</div>
        <h2 style="color:#fbbf24; font-family:'Cinzel',serif; margin-bottom:12px; font-size:1.6rem;">Track Your Order</h2>
        <p style="color:#cbd5e1; max-width:500px; margin:0 auto 24px auto; font-size:0.95rem; line-height:1.6;">
          Sign in with your Google or email account to view your complete multi-device order history, or track a single package using your Order ID.
        </p>
        <div style="display:flex; justify-content:center; gap:12px; flex-wrap:wrap; margin-bottom:20px;">
          <a href="login.html?redirect=track-order.html" class="checkout-btn" style="text-decoration:none; padding:12px 28px; display:inline-block;">
            Sign In with Google / Email
          </a>
          <a href="collection.html" class="collection-btn" style="text-decoration:none; padding:12px 24px; display:inline-block;">
            Explore Collection
          </a>
        </div>
      </div>
    `;
  }
}

function renderEmptyState() {
  const noOrdersContainer = document.getElementById("no-orders-container");
  const orderDetailsContainer = document.getElementById("order-details-container");
  const progressBoxContainer = document.getElementById("progress-box-container");

  if (orderDetailsContainer) orderDetailsContainer.style.display = "none";
  if (progressBoxContainer) progressBoxContainer.style.display = "none";

  if (noOrdersContainer) {
    noOrdersContainer.style.display = "block";
    noOrdersContainer.innerHTML = `
      <div style="text-align:center; padding: 45px 20px;">
        <div style="font-size:3.5rem; margin-bottom:15px;">📦</div>
        <h2 style="color:#fbbf24; font-family:'Cinzel',serif; font-size:1.6rem; margin-bottom:10px;">No Orders Yet</h2>
        <p style="color:#cbd5e1; font-size:0.95rem; max-width:460px; margin:0 auto 25px auto; line-height:1.6;">
          You haven't placed any orders with this account yet. Craft your Rajputana legacy today!
        </p>
        <div style="display:flex; justify-content:center; gap:12px;">
          <a href="collection.html" class="checkout-btn" style="text-decoration:none; display:inline-block; padding:12px 28px;">👑 Explore Collection</a>
          <button onclick="loadOrderData()" class="collection-btn" style="padding:12px 20px; cursor:pointer;">🔄 Refresh</button>
        </div>
      </div>
    `;
  }
}

function renderErrorState(errorMessage) {
  const noOrdersContainer = document.getElementById("no-orders-container");
  if (noOrdersContainer) {
    noOrdersContainer.style.display = "block";
    noOrdersContainer.innerHTML = `
      <div style="text-align:center; padding: 40px 20px;">
        <div style="font-size:3rem; margin-bottom:12px;">⚠️</div>
        <h2 style="color:#ef4444; font-family:'Cinzel',serif; margin-bottom:10px;">Synchronization Notice</h2>
        <p style="color:#cbd5e1; max-width:480px; margin:0 auto 20px auto; font-size:0.95rem;">
          ${escapeHtml(errorMessage || 'Unable to connect to BEARD BANNA database.')}
        </p>
        <button onclick="loadOrderData()" class="checkout-btn" style="padding:10px 24px; cursor:pointer;">
          🔄 Retry Synchronization
        </button>
      </div>
    `;
  }
}

function renderOrderNotFound(orderId, isGuest) {
  const noOrdersContainer = document.getElementById("no-orders-container");
  if (noOrdersContainer) {
    noOrdersContainer.style.display = "block";
    noOrdersContainer.innerHTML = `
      <div style="text-align:center; padding: 40px 20px;">
        <div style="font-size:3rem; margin-bottom:12px;">🔍</div>
        <h2 style="color:#fbbf24; font-family:'Cinzel',serif; margin-bottom:10px;">Order #${escapeHtml(orderId)}</h2>
        <p style="color:#cbd5e1; max-width:500px; margin:0 auto 20px auto; font-size:0.95rem; line-height:1.6;">
          We couldn't immediately locate order <strong>#${escapeHtml(orderId)}</strong> in your active session.
        </p>

        ${isGuest ? `
          <div style="background:rgba(15,23,42,0.8); border:1px solid rgba(251,191,36,0.3); border-radius:10px; max-width:440px; margin:0 auto 24px auto; padding:20px;">
            <p style="color:#f5eedf; font-size:0.9rem; margin-bottom:12px;">
              <strong>Guest Verification:</strong> Enter the email or phone number used during checkout:
            </p>
            <input type="text" id="guest-contact-input" placeholder="Email or Phone Number" style="width:100%; padding:10px 14px; border:1px solid #fbbf24; border-radius:6px; background:#0a0e1a; color:#fff; font-size:0.92rem; margin-bottom:12px;">
            <button onclick="trackSpecificOrder('${escapeHtml(orderId)}', null)" class="checkout-btn" style="width:100%; padding:10px;">
              🔒 Verify & Track Package
            </button>
          </div>
        ` : ''}

        <div style="display:flex; justify-content:center; gap:12px;">
          <a href="track-order.html" class="collection-btn" style="text-decoration:none; padding:10px 20px;">← View All My Orders</a>
          <a href="collection.html" class="collection-btn" style="text-decoration:none; padding:10px 20px;">Explore Collection</a>
        </div>
      </div>
    `;
  }
}

// ── 8. RENDER MY ORDERS LIST (MULTI-DEVICE UNIFIED) ──────────────────────────
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
    const date = o.orderDate ? new Date(o.orderDate).toLocaleDateString("en-IN", {
      day: 'numeric', month: 'short', year: 'numeric'
    }) : (o.date || "Recent");

    const itemNames = (o.items || []).map(i => `${escapeHtml(i.name)} (${escapeHtml(i.size || 'M')}) × ${i.quantity || 1}`).join(' • ');

    return `
      <div onclick="showOrderById('${escapeHtml(o.id || o.orderId)}')" style="
        background: rgba(15,23,42,0.85);
        border: 1px solid rgba(251,191,36,0.25);
        border-radius: 12px;
        padding: 20px 24px;
        margin-bottom: 16px;
        cursor: pointer;
        transition: border-color 0.25s, box-shadow 0.25s, transform 0.15s;
      " onmouseover="this.style.borderColor='#fbbf24'; this.style.boxShadow='0 6px 24px rgba(251,191,36,0.15)'; this.style.transform='translateY(-2px)'"
         onmouseout="this.style.borderColor='rgba(251,191,36,0.25)'; this.style.boxShadow='none'; this.style.transform='translateY(0)'">
        <div style="display:flex; justify-content:space-between; align-items:flex-start; flex-wrap:wrap; gap:10px; margin-bottom:8px;">
          <div>
            <div style="color:#fbbf24; font-weight:700; font-size:1.05rem; letter-spacing:0.5px; font-family:'Cinzel',serif;">
              Order #${escapeHtml(o.id || o.orderId)}
            </div>
            <div style="color:#94a3b8; font-size:0.85rem; margin-top:2px;">
              📅 Placed on ${escapeHtml(date)} · ${itemCount} piece${itemCount !== 1 ? 's' : ''}
            </div>
          </div>
          <div style="text-align:right;">
            <div style="color:#f5eedf; font-weight:700; font-size:1.15rem;">₹${total}</div>
            <div style="color:${statusColor}; font-weight:700; font-size:0.88rem; margin-top:3px; text-transform:uppercase; letter-spacing:0.5px;">
              ● ${escapeHtml(status)}
            </div>
          </div>
        </div>

        ${itemNames ? `
          <div style="color:#cbd5e1; font-size:0.88rem; margin:8px 0; border-top:1px solid rgba(255,255,255,0.06); padding-top:8px;">
            ${itemNames}
          </div>
        ` : ''}

        <div style="display:flex; justify-content:space-between; align-items:center; margin-top:10px; border-top:1px dashed rgba(251,191,36,0.15); padding-top:10px;">
          <span style="font-size:0.82rem; color:#94a3b8;">
            Customer: <strong style="color:#e2e8f0;">${escapeHtml(o.customer?.name || 'Valued Patron')}</strong>
          </span>
          <span style="color:#fbbf24; font-size:0.85rem; font-weight:600; display:inline-flex; align-items:center; gap:4px;">
            View Live Timeline ↗
          </span>
        </div>
      </div>
    `;
  }).join('');

  noOrdersContainer.innerHTML = `
    <div style="text-align:left; padding: 10px 0;">
      <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:20px; flex-wrap:wrap; gap:10px;">
        <h2 style="color:#fbbf24; margin:0; font-family:'Cinzel',serif; font-size:1.45rem;">
          📦 My Orders (${ordersList.length})
        </h2>
        <button onclick="loadOrderData()" class="collection-btn" style="padding:6px 14px; font-size:0.82rem; cursor:pointer;">
          🔄 Sync Status
        </button>
      </div>
      ${listHTML}
    </div>
  `;
}

// ── 9. SHOW ORDER DETAILS & TIMELINE ─────────────────────────────────────────
window.showOrderById = function(orderId) {
  const cleanId = String(orderId).trim().toUpperCase();
  const order = allUserOrders.find(o => String(o.id || o.orderId).toUpperCase() === cleanId);
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

  // Scroll to details on mobile
  if (window.innerWidth < 768 && orderDetailsContainer) {
    orderDetailsContainer.scrollIntoView({ behavior: 'smooth' });
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
  if (trackOrderId) trackOrderId.textContent = orderIdVal;
  if (trackOrderDate) {
    const rawDate = currentOrder.orderDate || currentOrder.created_at || Date.now();
    trackOrderDate.textContent = new Date(rawDate).toLocaleDateString("en-IN", {
      day: 'numeric', month: 'long', year: 'numeric'
    });
  }

  const delivery = new Date(currentOrder.orderDate || currentOrder.created_at || Date.now());
  delivery.setDate(delivery.getDate() + 5);
  if (trackDeliveryDate) {
    trackDeliveryDate.textContent = delivery.toLocaleDateString("en-IN", {
      day: 'numeric', month: 'long', year: 'numeric'
    });
  }

  const custObj = currentOrder.customer || {};
  if (customerName) customerName.textContent = custObj.name || (typeof currentOrder.customer === 'string' ? currentOrder.customer : "Valued Patron");
  if (customerEmail) customerEmail.textContent = custObj.email || currentOrder.email || "";
  if (customerPhone) customerPhone.textContent = custObj.phone || currentOrder.phone || "N/A";

  if (customerAddress) {
    if (currentOrder.address) {
      customerAddress.textContent = currentOrder.address;
    } else {
      customerAddress.textContent = [custObj.address, custObj.city, custObj.state, custObj.pincode].filter(Boolean).join(', ') || 'Standard Dispatch';
    }
  }

  if (trackingNumber) trackingNumber.textContent = "BBX" + String(orderIdVal).replace(/[^0-9]/g, "");
}

function getStageFromStatus(statusStr) {
  if (!statusStr) return 0;
  const s = statusStr.toLowerCase();
  if (s.includes("cancel")) return -1;
  if (s.includes("deliver")) return 4;
  if (s.includes("ship")) return 3;
  if (s.includes("pack")) return 2;
  if (s.includes("confirm")) return 1;
  return 0; // Processing
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
    3: "Your parcel has been shipped & is in transit with BEARD BANNA Express.",
    4: "Your parcel has been delivered successfully. Wear your legacy with pride! 👑"
  };

  if (message) message.innerHTML = statusTexts[stage] || `Current status: ${formattedStatus}`;
  const hoursLeft = Math.max(0, 24 - (stage * 6));
  if (arrival) arrival.innerHTML = hoursLeft > 0 ? hoursLeft + " Hours" : "Delivered";
}

// ── 10. INITIALIZATION ────────────────────────────────────────────────────────
document.addEventListener("DOMContentLoaded", async () => {
  await loadOrderData();
});

// Expose globally
window.loadOrderData = loadOrderData;
window.trackSpecificOrder = trackSpecificOrder;
