// ===============================
// BEARD BANNA CHECKOUT SYSTEM - PRODUCTION-HARDENED v2
// ===============================

// ── Auth guard — resolve Supabase session first ──────────────────────────────
(async function checkCheckoutAuth() {
  let isAuthenticated = false;

  if (window.supabaseClient && window.SupabaseAuth) {
    try {
      const { user, session } = await SupabaseAuth.getSession();
      if (user) {
        isAuthenticated = true;
        if (window.API) {
          API.setCurrentUser({
            id: user.id,
            name: user.user_metadata?.full_name || user.email.split('@')[0],
            email: user.email,
            phone: user.user_metadata?.phone || '',
            role: 'customer'
          });
          if (session?.access_token) API.setToken(session.access_token);
        }
      }
    } catch (e) { /* ignore */ }
  }

  // Fallback: legacy localStorage token
  if (!isAuthenticated && window.API) {
    const legacyUser = API.getCurrentUser();
    const legacyToken = API.getToken();
    if (legacyUser && legacyToken) isAuthenticated = true;
  }

  if (!isAuthenticated) {
    alert('Please login to continue to checkout.');
    window.location.href = 'login.html';
  }
})();

// ── Cart and DOM references ────────────────────────────────────────────────
const cart = JSON.parse(localStorage.getItem("cart")) || [];
const summary = document.getElementById("checkout-items");
const subtotalElement = document.getElementById("subtotal");
const shippingElement = document.getElementById("shipping");
const grandTotalElement = document.getElementById("grandTotal");
const gstContainer = document.getElementById("gst-breakdown-container");

let subtotal = 0;
let shipping = 0;
let grandTotal = 0;
let appliedDiscount = 0;
let appliedCouponCode = "";
let orderData = {};
let currentGST = null;

// Prevent double-order submission
let _orderInProgress = false;

if (cart.length === 0) {
  if (summary) summary.innerHTML = `<p>Your cart is empty. <a href="collection.html">Browse our collection →</a></p>`;
}

// ── GST: await DB sync before rendering totals ─────────────────────────────
// This fixes the race condition where calculateGST() runs before
// syncGSTSettingsFromDB() resolves, causing stale GST state.
(async function initGST() {
  if (typeof syncGSTSettingsFromDB === 'function') {
    try { await syncGSTSettingsFromDB(); } catch (e) {}
  }
  if (cart.length > 0) displaySummary();
})();

function displaySummary() {
  if (!summary) return;
  summary.innerHTML = "";
  subtotal = 0;

  cart.forEach(item => {
    const total = item.price * (item.qty || 1);
    subtotal += total;

    summary.innerHTML += `
      <div class="summary-item">
        <div>
          <strong>${item.name}</strong><br>
          <small>Qty : ${item.qty || 1} ${item.size ? "| Size : " + item.size : ""} | HSN: 6109</small>
        </div>
        <div>₹${total}</div>
      </div>
    `;
  });

  calculateTotals();
}

function calculateTotals() {
  shipping = subtotal >= 1999 || subtotal === 0 ? 0 : 99;

  const stateVal = document.getElementById("state")?.value || "Rajasthan";
  if (typeof calculateGST === "function") {
    currentGST = calculateGST(subtotal, stateVal);
  }

  const gstAmount = (currentGST && currentGST.enabled) ? currentGST.totalGST : 0;
  grandTotal = Math.max(0, subtotal + gstAmount + shipping - appliedDiscount);

  if (subtotalElement) subtotalElement.innerHTML = "₹" + subtotal;
  if (shippingElement) shippingElement.innerHTML = shipping === 0 ? "FREE" : "₹99";
  if (grandTotalElement) grandTotalElement.innerHTML = "₹" + grandTotal;

  if (gstContainer) {
    if (currentGST && currentGST.enabled) {
      gstContainer.innerHTML = `
        <p style="color:#666; font-size:0.9rem;">CGST (2.5%): <span>+₹${currentGST.cgstAmount}</span></p>
        <p style="color:#666; font-size:0.9rem;">SGST (2.5%): <span>+₹${currentGST.sgstAmount}</span></p>
      `;
    } else {
      gstContainer.innerHTML = "";
    }
  }
}

const stateInputEl = document.getElementById("state");
if (stateInputEl) stateInputEl.addEventListener("input", calculateTotals);

// Payment UI
const paymentRadios = document.querySelectorAll('input[name="payment"]');
const upiSection = document.getElementById("upi-section");
const cardSection = document.getElementById("card-section");

if (upiSection) upiSection.style.display = "none";
if (cardSection) cardSection.style.display = "none";

paymentRadios.forEach(radio => {
  radio.addEventListener("change", function () {
    if (upiSection) upiSection.style.display = this.value === "UPI" ? "block" : "none";
    if (cardSection) cardSection.style.display = this.value === "Card" ? "block" : "none";
  });
});

// Coupon Code
async function applyCoupon(code) {
  if (!code) return;
  try {
    const res = await API.post('/coupons/validate', { code, orderAmount: subtotal });
    if (res.success && res.data) {
      appliedDiscount = res.data.discountAmount || 0;
      appliedCouponCode = code.toUpperCase();
      calculateTotals();
      if (typeof showToast === "function") showToast(`🎉 Coupon ${appliedCouponCode} applied! Saved ₹${appliedDiscount}`);
    } else {
      alert(res.message || "Invalid coupon code.");
    }
  } catch (err) {
    alert(err.message || "Invalid coupon code.");
  }
}

// ── CHECKOUT FORM ──────────────────────────────────────────────────────────
const checkoutForm = document.getElementById("checkout-form");

if (checkoutForm) {
  checkoutForm.addEventListener("submit", function (e) {
    e.preventDefault();

    const name = document.getElementById("name")?.value.trim();
    const email = document.getElementById("email")?.value.trim();
    const phone = document.getElementById("phone")?.value.trim();
    const address = document.getElementById("address")?.value.trim();
    const city = document.getElementById("city")?.value.trim();
    const state = document.getElementById("state")?.value.trim();
    const pincode = document.getElementById("pincode")?.value.trim();
    const gstin = document.getElementById("gstin") ? document.getElementById("gstin").value.trim().toUpperCase() : "";
    const payment = document.querySelector('input[name="payment"]:checked');

    if (!name || !email || !phone || !address || !city || !state || !pincode) {
      alert("Please fill all required fields.");
      return;
    }
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      alert("Enter a valid Email Address.");
      return;
    }
    if (!/^[6-9]\d{9}$/.test(phone)) {
      alert("Enter a valid 10-digit Mobile Number.");
      return;
    }
    if (!/^\d{6}$/.test(pincode)) {
      alert("Enter a valid 6-digit PIN Code.");
      return;
    }
    if (!payment) {
      alert("Please choose a payment method.");
      return;
    }

    orderData = { name, email, phone, address, city, state, pincode, gstin: gstin || "N/A", payment: payment.value };
    showConfirmation();
  });
}

function showConfirmation() {
  const confirmProducts = document.getElementById("confirm-products");
  const confirmDetails = document.getElementById("confirm-details");
  if (!confirmProducts || !confirmDetails) return;

  confirmProducts.innerHTML = "";
  let totalItems = 0;

  cart.forEach(item => {
    totalItems += item.qty || 1;
    confirmProducts.innerHTML += `
      <div class="confirm-item">
        <img src="${item.image}">
        <div>
          <h4>${item.name}</h4>
          <p>Qty : ${item.qty || 1} | Size : ${item.size || 'M'} | HSN: 6109</p>
        </div>
      </div>
    `;
  });

  const delivery = new Date();
  delivery.setDate(delivery.getDate() + 5);

  const paymentNames = {
    COD: "Cash On Delivery", UPI: "UPI", Card: "Credit / Debit Card",
    cod: "Cash On Delivery", upi: "UPI", credit: "Credit Card", debit: "Debit Card"
  };

  calculateTotals();

  let gstText = "";
  if (currentGST && currentGST.enabled) {
    gstText = `
      <div style="display:flex; justify-content:space-between; margin:7px 0; font-size:13.5px;">
        <span style="color:#ffd700; font-weight:600;">GST (CGST 2.5% + SGST 2.5%) :</span>
        <span style="color:#f5eedf; font-weight:600;">₹${currentGST.totalGST}</span>
      </div>`;
  }

  confirmDetails.innerHTML = `
    <div style="display:flex; justify-content:space-between; margin:7px 0; font-size:14px;">
      <span style="color:#ffd700; font-weight:600;">Total Items :</span>
      <span style="color:#f5eedf; font-weight:700;">${totalItems}</span>
    </div>
    <div style="display:flex; justify-content:space-between; margin:7px 0; font-size:14px;">
      <span style="color:#ffd700; font-weight:600;">Subtotal :</span>
      <span style="color:#f5eedf; font-weight:600;">₹${subtotal}</span>
    </div>
    ${gstText}
    <div style="display:flex; justify-content:space-between; margin:7px 0; font-size:15px; border-top:1px dashed rgba(212,175,55,0.3); padding-top:8px;">
      <span style="color:#ffd700; font-weight:700;">Grand Total :</span>
      <span style="color:#ffd700; font-weight:800; font-size:16px;">₹${grandTotal}</span>
    </div>
    <div style="display:flex; justify-content:space-between; margin:7px 0; font-size:14px;">
      <span style="color:#ffd700; font-weight:600;">Payment Method :</span>
      <span style="color:#f5eedf; font-weight:600;">${paymentNames[orderData.payment] || orderData.payment}</span>
    </div>
    <div style="margin:10px 0 0 0; padding-top:8px; border-top:1px solid rgba(212,175,55,0.2);">
      <span style="color:#ffd700; font-weight:600; font-size:13.5px; display:block; margin-bottom:4px;">Deliver To :</span>
      <span style="color:#f5eedf; font-size:13.5px; line-height:1.5; display:block;">
        ${orderData.address}<br>${orderData.city}, ${orderData.state} - ${orderData.pincode}
      </span>
    </div>
    <div style="display:flex; justify-content:space-between; margin-top:8px; font-size:13px; color:#d4af37; font-style:italic;">
      <span>Estimated Delivery :</span>
      <span>${delivery.toLocaleDateString("en-IN")}</span>
    </div>
  `;

  document.getElementById("confirm-modal").style.display = "flex";
}

function closeModal() {
  const modal = document.getElementById("confirm-modal");
  if (modal) modal.style.display = "none";
}

function confirmOrder() {
  if (_orderInProgress) return;

  const btn = document.querySelector(".confirm-btn");
  if (btn && btn.disabled) return;

  _orderInProgress = true;
  if (btn) { btn.disabled = true; btn.innerHTML = `⏳ Processing Order...`; }

  const selectedPayment = (orderData.payment || "COD").toUpperCase();
  calculateTotals();

  if (selectedPayment === "COD") {
    finalizeOrder({ paymentMethod: "COD", paymentStatus: "Pending" });
    return;
  }

  handleRazorpayPayment(btn, selectedPayment);
}

async function handleRazorpayPayment(btn, paymentMethod) {
  if (btn) { btn.disabled = true; btn.innerHTML = `⏳ Opening Razorpay...`; }

  if (typeof Razorpay === "undefined") {
    alert("Razorpay payment SDK is loading. Please check your internet connection and try again.");
    if (btn) { btn.disabled = false; btn.innerHTML = "Confirm Order"; }
    _orderInProgress = false;
    return;
  }

  try {
    const createRes = await API.post('/payment/create-order', {
      amount: grandTotal,
      receipt: 'rcpt_' + Date.now().toString().slice(-8),
      notes: { customerName: orderData.name || '', customerEmail: orderData.email || '', paymentMethod }
    });

    if (!createRes || !createRes.success || !createRes.order) {
      throw new Error(createRes?.message || 'Failed to create payment order with server');
    }

    const rzpOrder = createRes.order;
    const keyId = createRes.keyId || 'rzp_test_TZ41JZFiQ58s0Q';

    closeModal();

    const options = {
      key: keyId,
      amount: rzpOrder.amount,
      currency: rzpOrder.currency || 'INR',
      name: 'BEARD BANNA',
      description: `Payment for Order (${paymentMethod})`,
      order_id: rzpOrder.id,
      prefill: { name: orderData.name || '', email: orderData.email || '', contact: orderData.phone || '' },
      theme: { color: '#d4af37' },
      modal: {
        ondismiss: function () {
          alert('Payment cancelled. You can complete payment or select Cash on Delivery.');
          if (btn) { btn.disabled = false; btn.innerHTML = 'Confirm Order'; }
          _orderInProgress = false;
        }
      },
      handler: async function (response) {
        try {
          if (btn) { btn.disabled = true; btn.innerHTML = `⏳ Verifying Payment...`; }

          const verifyRes = await API.post('/payment/verify', {
            razorpay_order_id: response.razorpay_order_id,
            razorpay_payment_id: response.razorpay_payment_id,
            razorpay_signature: response.razorpay_signature
          });

          if (verifyRes && verifyRes.success) {
            await finalizeOrder({
              paymentMethod,
              paymentStatus: 'Paid',
              razorpayOrderId: response.razorpay_order_id,
              razorpayPaymentId: response.razorpay_payment_id,
              razorpaySignature: response.razorpay_signature
            });
          } else {
            alert('Payment verification failed: ' + (verifyRes?.message || 'Signature mismatch'));
            if (btn) { btn.disabled = false; btn.innerHTML = 'Confirm Order'; }
            _orderInProgress = false;
          }
        } catch (vErr) {
          alert('Error verifying payment with server. Please contact support if amount was debited: ' + vErr.message);
          if (btn) { btn.disabled = false; btn.innerHTML = 'Confirm Order'; }
          _orderInProgress = false;
        }
      }
    };

    const rzpInstance = new Razorpay(options);
    rzpInstance.on('payment.failed', function (resp) {
      alert('Payment failed: ' + (resp.error?.description || 'Transaction declined. Please try another card or UPI.'));
      if (btn) { btn.disabled = false; btn.innerHTML = 'Confirm Order'; }
      _orderInProgress = false;
    });
    rzpInstance.open();

  } catch (err) {
    alert('Unable to start online payment: ' + (err.message || 'Please check server connection or choose Cash on Delivery.'));
    if (btn) { btn.disabled = false; btn.innerHTML = 'Confirm Order'; }
    _orderInProgress = false;
  }
}

/**
 * ─────────────────────────────────────────────────────────────────────────────
 * PRODUCTION-HARDENED finalizeOrder()
 *
 * CRITICAL FIX: Uses await on Supabase INSERT — no redirect until DB confirms.
 * Old code used .finally() which redirected even if INSERT failed silently.
 * ─────────────────────────────────────────────────────────────────────────────
 */
async function finalizeOrder(paymentMeta = {}) {
  const btn = document.querySelector(".confirm-btn");
  if (btn) { btn.disabled = true; btn.innerHTML = `⏳ Saving Order...`; }

  const orderItems = cart.map(item => ({
    productId: item.id || item._id || "PROD-1001",
    name: item.name || "Product",
    title: item.name || "Product",
    size: item.size || "M",
    color: "Default",
    quantity: item.qty || 1,
    price: item.price || 0
  }));

  const shippingAddress = {
    fullName: orderData.name || "Customer",
    phone: orderData.phone || "9876543210",
    street: orderData.address || "Main Address",
    city: orderData.city || "City",
    state: orderData.state || "State",
    postalCode: orderData.pincode || "110001",
    country: "India"
  };

  calculateTotals();

  // Snapshot GST at order-placement time
  const gstSnapshot = currentGST
    ? { ...currentGST }
    : { enabled: false, totalGST: 0, cgstAmount: 0, sgstAmount: 0, gstRate: 0 };

  const orderId = "BB" + Date.now().toString().slice(-8);

  const newOrderObj = {
    id: orderId,
    orderId: orderId,
    customer: orderData.name || "Customer",
    customerName: orderData.name || "Customer",
    email: (orderData.email || "").toLowerCase(),
    customerEmail: (orderData.email || "").toLowerCase(),
    phone: orderData.phone || "9876543210",
    customerPhone: orderData.phone || "9876543210",
    gstin: orderData.gstin || "N/A",
    address: `${orderData.address || ''}, ${orderData.city || ''}, ${orderData.state || ''} - ${orderData.pincode || ''}`,
    shippingAddress: shippingAddress,
    state: orderData.state || "Rajasthan",
    payment: paymentMeta.paymentMethod || (orderData.payment ? orderData.payment.toUpperCase() : "COD"),
    paymentMethod: paymentMeta.paymentMethod || (orderData.payment ? orderData.payment.toUpperCase() : "COD"),
    paymentStatus: paymentMeta.paymentStatus || "Pending",
    razorpayOrderId: paymentMeta.razorpayOrderId || "",
    razorpayPaymentId: paymentMeta.razorpayPaymentId || "",
    razorpaySignature: paymentMeta.razorpaySignature || "",
    status: "Processing",
    orderStatus: "Processing",
    total: grandTotal,
    grandTotal: grandTotal,
    subtotal: subtotal,
    shipping: shipping,
    tax: gstSnapshot.enabled ? gstSnapshot.totalGST : 0,
    gstDetails: gstSnapshot,
    date: new Date().toLocaleDateString("en-IN"),
    orderDate: new Date().toISOString(),
    items: orderItems.map(i => ({
      productId: i.productId,
      name: i.name,
      size: i.size,
      quantity: i.quantity,
      price: i.price,
      hsn: "6109"
    })),
    cart: cart
  };

  // ── STEP 1: Save locally (provides immediate fallback) ──────────────────
  try {
    localStorage.setItem("lastOrder", JSON.stringify(newOrderObj));
    const existingOrders = JSON.parse(localStorage.getItem("orders")) || [];
    existingOrders.unshift(newOrderObj);
    localStorage.setItem("orders", JSON.stringify(existingOrders));
  } catch (err) {
    console.warn("[Checkout] Local storage error:", err);
  }

  // ── STEP 2: AWAIT Supabase INSERT — BLOCKS REDIRECT ────────────────────
  // This is the core fix: we wait for DB confirmation before redirecting.
  // If insert fails, we show an error and DO NOT redirect.

  if (window.supabaseClient) {
    try {
      // Get authenticated user's UUID for the order link
      let sbUserId = null;
      if (window.SupabaseAuth) {
        try {
          const sess = await SupabaseAuth.getSession();
          if (sess?.user?.id) sbUserId = sess.user.id;
        } catch (e) {}
      }

      if (btn) btn.innerHTML = `⏳ Confirming with database...`;

      const orderPayload = {
        order_number: newOrderObj.orderId,
        user_id: sbUserId,           // auth.uid() — links order to customer's Supabase UUID
        customer_name: newOrderObj.customerName,
        customer_email: newOrderObj.customerEmail,
        customer_phone: newOrderObj.customerPhone,
        shipping_address: newOrderObj.shippingAddress,
        subtotal: newOrderObj.subtotal,
        tax: newOrderObj.tax,
        shipping: newOrderObj.shipping,
        total: newOrderObj.grandTotal,
        discount: appliedDiscount || 0,
        coupon_code: appliedCouponCode || null,
        gst_details: newOrderObj.gstDetails || {},
        payment_method: newOrderObj.paymentMethod,
        payment_status: newOrderObj.paymentStatus,
        razorpay_order_id: newOrderObj.razorpayOrderId || null,
        razorpay_payment_id: newOrderObj.razorpayPaymentId || null,
        razorpay_signature: newOrderObj.razorpaySignature || null,
        order_status: newOrderObj.orderStatus || 'Processing',
        notes: ''
      };

      const { data: insertedOrder, error: orderErr } = await window.supabaseClient
        .from('orders')
        .insert([orderPayload])
        .select()
        .single();

      if (orderErr) {
        // ── INSERT FAILED: Show real error, do NOT redirect ──
        console.error('[Checkout] ❌ Supabase order insert FAILED:', orderErr.message, orderErr.code);
        if (btn) { btn.disabled = false; btn.innerHTML = 'Confirm Order'; }
        _orderInProgress = false;
        alert(
          '❌ Order could not be saved to database.\n' +
          'Error: ' + (orderErr.message || 'Unknown error') + '\n\n' +
          'Please try again. If the problem persists, contact support.\n' +
          'Your Order ID reference: ' + orderId
        );
        return; // STOP — do not redirect
      }

      if (insertedOrder && insertedOrder.id) {
        // ── STEP 3: Insert order_items ──
        const itemsPayload = orderItems.map(item => ({
          order_id: insertedOrder.id,
          product_id: String(item.productId),
          name: item.name,
          size: item.size,
          quantity: Number(item.quantity || 1),
          price: Number(item.price || 0),
          hsn: "6109"
        }));

        const { error: itemsErr } = await window.supabaseClient
          .from('order_items')
          .insert(itemsPayload);

        if (itemsErr) {
          // Items failed but order exists — log, don't block user
          console.warn('[Checkout] ⚠️ order_items insert failed:', itemsErr.message);
        }

        console.log('[Checkout] ✅ Order confirmed in Supabase:', insertedOrder.order_number);
      }

    } catch (err) {
      console.error('[Checkout] ❌ Supabase exception:', err.message);
      if (btn) { btn.disabled = false; btn.innerHTML = 'Confirm Order'; }
      _orderInProgress = false;
      alert(
        '❌ Connection error while saving order.\n' +
        'Error: ' + (err.message || 'Unknown') + '\n\n' +
        'Please check your internet connection and try again.\n' +
        'Your Order ID: ' + orderId
      );
      return; // STOP
    }
  } else {
    console.error('[Checkout] ❌ Supabase client is not available.');
    if (btn) { btn.disabled = false; btn.innerHTML = 'Confirm Order'; }
    _orderInProgress = false;
    alert('❌ Database connection unavailable. Please refresh and try again.');
    return;
  }

  // ── STEP 4: Clear cart (only after confirmed DB save) ──────────────────
  localStorage.removeItem("cart");

  // ── STEP 5: Background REST API sync (MongoDB) — non-blocking ──────
  try {
    if (typeof API !== "undefined" && API.post) {
      API.post('/orders', {
        customerName: newOrderObj.customerName,
        customerEmail: newOrderObj.customerEmail,
        customerPhone: newOrderObj.customerPhone,
        shippingAddress: newOrderObj.shippingAddress,
        items: newOrderObj.items,
        subtotal: newOrderObj.subtotal,
        tax: newOrderObj.tax,
        shipping: newOrderObj.shipping,
        total: newOrderObj.grandTotal,
        paymentMethod: newOrderObj.paymentMethod,
        paymentStatus: newOrderObj.paymentStatus,
        razorpayOrderId: newOrderObj.razorpayOrderId,
        razorpayPaymentId: newOrderObj.razorpayPaymentId,
        razorpaySignature: newOrderObj.razorpaySignature,
        couponCode: appliedCouponCode || undefined
      }).catch(e => console.warn('[Checkout] Background REST API sync notice:', e.message));
    }
  } catch (e) {}

  // ── STEP 6: Redirect — only reached if Supabase save succeeded ─────
  if (btn) btn.innerHTML = `✅ Order Confirmed! Redirecting...`;
  window.location.href = "order-success.html";
}

window.addEventListener("click", function (e) {
  const modal = document.getElementById("confirm-modal");
  if (e.target === modal) closeModal();
});

// Expose functions for HTML onclick attributes
window.confirmOrder = confirmOrder;
window.closeModal = closeModal;
window.showConfirmation = showConfirmation;
window.applyCoupon = applyCoupon;
window.calculateOrderGST = calculateTotals;