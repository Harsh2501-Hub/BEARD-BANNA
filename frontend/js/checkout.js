// ===============================
// BEARD BANNA CHECKOUT SYSTEM - FAULT-TOLERANT INSTANT ORDERING
// ===============================

// Auth guard — check Supabase session first, then legacy fallback
(async function checkCheckoutAuth() {
  let isAuthenticated = false;

  // 1. Try Supabase session (preferred)
  if (window.supabaseClient && window.SupabaseAuth) {
    try {
      const { user } = await SupabaseAuth.getSession();
      if (user) {
        isAuthenticated = true;
        // Keep legacy API in sync so existing checkout code works
        if (window.API) {
          const existing = API.getCurrentUser();
          if (!existing || !existing.id) {
            API.setCurrentUser({
              id: user.id,
              name: user.user_metadata?.full_name || user.email.split('@')[0],
              email: user.email,
              phone: user.user_metadata?.phone || '',
              role: 'customer'
            });
          }
        }
      }
    } catch (e) { /* ignore */ }
  }

  // 2. Fallback: legacy localStorage token
  if (!isAuthenticated && window.API) {
    const legacyUser = API.getCurrentUser();
    const legacyToken = API.getToken();
    if (legacyUser && legacyToken) {
      isAuthenticated = true;
    }
  }

  if (!isAuthenticated) {
    alert('Please login to continue to checkout.');
    window.location.href = 'login.html';
  }
})();


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

if (cart.length === 0) {
  if (summary) summary.innerHTML = `<p>Your cart is empty.</p>`;
} else {
  displaySummary();
}

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

  // Render 2.5% CGST + 2.5% SGST Breakdown in Checkout Order Summary
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
if (stateInputEl) {
  stateInputEl.addEventListener("input", calculateTotals);
}

// Payment UI display toggle
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

// Coupon Code Validation
async function applyCoupon(code) {
  if (!code) return;
  try {
    const res = await API.post('/coupons/validate', {
      code,
      orderAmount: subtotal
    });
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

// Checkout Form Submission
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

    orderData = {
      name,
      email,
      phone,
      address,
      city,
      state,
      pincode,
      gstin: gstin || "N/A",
      payment: payment.value
    };

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
    COD: "Cash On Delivery",
    UPI: "UPI",
    Card: "Credit / Debit Card",
    cod: "Cash On Delivery",
    upi: "UPI",
    credit: "Credit Card",
    debit: "Debit Card"
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
  const btn = document.querySelector(".confirm-btn");
  if (btn && btn.disabled) return; // Prevent duplicate order on double click

  if (btn) {
    btn.disabled = true;
    btn.innerHTML = `⏳ Processing Order...`;
  }

  const selectedPayment = (orderData.payment || "COD").toUpperCase();
  calculateTotals();

  // If Cash on Delivery, place order directly
  if (selectedPayment === "COD") {
    if (btn) {
      btn.innerHTML = `✔ Placed! Redirecting...`;
    }
    finalizeOrder({
      paymentMethod: "COD",
      paymentStatus: "Pending"
    });
    return;
  }

  // Online Payment via Razorpay (UPI or Card)
  handleRazorpayPayment(btn, selectedPayment);
}

/**
 * Initiates Razorpay checkout popup and verifies payment
 */
async function handleRazorpayPayment(btn, paymentMethod) {
  if (btn) {
    btn.disabled = true;
    btn.innerHTML = `⏳ Opening Razorpay...`;
  }

  // Ensure Razorpay SDK is loaded
  if (typeof Razorpay === "undefined") {
    alert("Razorpay payment SDK is loading. Please check your internet connection and try again.");
    if (btn) {
      btn.disabled = false;
      btn.innerHTML = "Confirm Order";
    }
    return;
  }

  try {
    // 1. Create order on backend
    const createRes = await API.post('/payment/create-order', {
      amount: grandTotal,
      receipt: 'rcpt_' + Date.now().toString().slice(-8),
      notes: {
        customerName: orderData.name || '',
        customerEmail: orderData.email || '',
        paymentMethod: paymentMethod
      }
    });

    if (!createRes || !createRes.success || !createRes.order) {
      throw new Error(createRes?.message || 'Failed to create payment order with server');
    }

    const rzpOrder = createRes.order;
    const keyId = createRes.keyId || 'rzp_test_TZ41JZFiQ58s0Q';

    // Hide confirmation modal while payment popup is active
    closeModal();

    // 2. Configure Razorpay Standard Checkout
    const options = {
      key: keyId,
      amount: rzpOrder.amount,
      currency: rzpOrder.currency || 'INR',
      name: 'BEARD BANNA',
      description: `Payment for Order (${paymentMethod})`,
      order_id: rzpOrder.id,
      prefill: {
        name: orderData.name || '',
        email: orderData.email || '',
        contact: orderData.phone || ''
      },
      theme: {
        color: '#d4af37' // Signature royal gold theme
      },
      modal: {
        ondismiss: function () {
          alert('Payment cancelled. You can complete payment or select Cash on Delivery.');
          if (btn) {
            btn.disabled = false;
            btn.innerHTML = 'Confirm Order';
          }
        }
      },
      handler: async function (response) {
        // Payment successful on Razorpay side, now verify cryptographic signature
        try {
          if (btn) {
            btn.disabled = true;
            btn.innerHTML = `⏳ Verifying Payment...`;
          }

          const verifyRes = await API.post('/payment/verify', {
            razorpay_order_id: response.razorpay_order_id,
            razorpay_payment_id: response.razorpay_payment_id,
            razorpay_signature: response.razorpay_signature
          });

          if (verifyRes && verifyRes.success) {
            // Signature valid! Finalize order as PAID
            finalizeOrder({
              paymentMethod: paymentMethod,
              paymentStatus: 'Paid',
              razorpayOrderId: response.razorpay_order_id,
              razorpayPaymentId: response.razorpay_payment_id,
              razorpaySignature: response.razorpay_signature
            });
          } else {
            alert('Payment verification failed: ' + (verifyRes?.message || 'Signature mismatch'));
            if (btn) {
              btn.disabled = false;
              btn.innerHTML = 'Confirm Order';
            }
          }
        } catch (vErr) {
          console.error('Verification error:', vErr);
          alert('Error verifying payment with server. Please contact support if amount was debited: ' + vErr.message);
          if (btn) {
            btn.disabled = false;
            btn.innerHTML = 'Confirm Order';
          }
        }
      }
    };

    const rzpInstance = new Razorpay(options);

    rzpInstance.on('payment.failed', function (resp) {
      console.error('Razorpay payment failed:', resp.error);
      alert('Payment failed: ' + (resp.error?.description || 'Transaction declined. Please try another card or UPI.'));
      if (btn) {
        btn.disabled = false;
        btn.innerHTML = 'Confirm Order';
      }
    });

    rzpInstance.open();

  } catch (err) {
    console.error('Razorpay initialization error:', err);
    alert('Unable to start online payment: ' + (err.message || 'Please check server connection or choose Cash on Delivery.'));
    if (btn) {
      btn.disabled = false;
      btn.innerHTML = 'Confirm Order';
    }
  }
}

/**
 * Saves order locally and syncs to MongoDB backend, then redirects to order-success.html
 */
function finalizeOrder(paymentMeta = {}) {
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
  const orderId = "BB" + Date.now().toString().slice(-8);

  const newOrderObj = {
    id: orderId,
    orderId: orderId,
    customer: orderData.name || currentUser?.name || "Customer",
    customerName: orderData.name || currentUser?.name || "Customer",
    email: (orderData.email || currentUser?.email || "").toLowerCase(),
    customerEmail: (orderData.email || currentUser?.email || "").toLowerCase(),
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
    tax: (currentGST && currentGST.enabled) ? currentGST.totalGST : 0,
    gstDetails: currentGST,
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

  // 1. Save locally
  try {
    localStorage.setItem("lastOrder", JSON.stringify(newOrderObj));

    const existingOrders = JSON.parse(localStorage.getItem("orders")) || [];
    existingOrders.unshift(newOrderObj);
    localStorage.setItem("orders", JSON.stringify(existingOrders));

    localStorage.removeItem("cart");
  } catch (err) {
    console.error("Local storage error:", err);
  }

  // 2. Persist order directly into Supabase database
  async function persistToSupabase() {
    if (!window.supabaseClient) return;

    try {
      let sbUserId = null;
      if (window.SupabaseAuth) {
        try {
          const sess = await window.SupabaseAuth.getSession();
          if (sess?.user?.id) sbUserId = sess.user.id;
        } catch (e) {}
      }

      const orderPayload = {
        order_number: newOrderObj.id,
        user_id: sbUserId,
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
        console.warn('[Checkout] Supabase order insert notice:', orderErr.message);
      } else if (insertedOrder && insertedOrder.id) {
        const itemsPayload = orderItems.map(item => ({
          order_id: insertedOrder.id,
          product_id: String(item.productId),
          name: item.name,
          size: item.size,
          quantity: Number(item.quantity || 1),
          price: Number(item.price || 0),
          hsn: "6109"
        }));
        await window.supabaseClient.from('order_items').insert(itemsPayload);
        console.log('[Checkout] ✅ Order persisted to Supabase:', insertedOrder.order_number);
      }
    } catch (err) {
      console.warn('[Checkout] Supabase sync error:', err.message);
    }
  }

  // Execute Supabase persistence, then redirect
  persistToSupabase().finally(() => {
    // 3. Background REST API call (MongoDB backend fallback)
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
        }).catch(e => console.warn('Background order sync notice:', e));
      }
    } catch (e) {}

    // 4. Redirect to order-success page
    window.location.href = "order-success.html";
  });
}

window.addEventListener("click", function (e) {
  const modal = document.getElementById("confirm-modal");
  if (e.target === modal) closeModal();
});