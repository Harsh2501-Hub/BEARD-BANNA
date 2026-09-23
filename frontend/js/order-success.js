// ===============================
// ORDER SUCCESS & OFFICIAL GST INVOICE
// ===============================

const order = JSON.parse(localStorage.getItem("lastOrder"));

if (!order) {
  window.location.href = "index.html";
}

document.getElementById("order-id").innerHTML = order.orderId;
document.getElementById("order-date").innerHTML = new Date(order.orderDate || Date.now()).toLocaleDateString("en-IN");

const delivery = new Date();
delivery.setDate(delivery.getDate() + 5);
document.getElementById("delivery-date").innerHTML = delivery.toLocaleDateString("en-IN");

const paymentNames = {
  cod: "Cash On Delivery",
  upi: "UPI",
  credit: "Credit Card",
  debit: "Debit Card"
};

const paymentCode = (order.customer?.payment || order.payment || "cod").toLowerCase();
let paymentLabel = paymentNames[paymentCode] || paymentCode.toUpperCase();
if (order.razorpayPaymentId) {
  paymentLabel += ` (Paid • Ref: ${order.razorpayPaymentId})`;
} else if (order.paymentStatus === 'Paid') {
  paymentLabel += ' (Paid)';
}
document.getElementById("payment-method").innerHTML = paymentLabel;

let items = 0;
const cartItems = order.cart || order.items || [];
cartItems.forEach(item => {
  items += (item.qty || item.quantity || 1);
});

document.getElementById("total-items").innerHTML = items;
document.getElementById("grand-total").innerHTML = order.grandTotal || order.total || 0;

// ===================================
// GST TAX INVOICE POPULATION
// ===================================

document.getElementById("invoice-no").innerHTML = "INV-2026-" + (order.orderId || "1001");
document.getElementById("invoice-order-id").innerHTML = order.orderId;
document.getElementById("invoice-date").innerHTML = new Date(order.orderDate || Date.now()).toLocaleDateString("en-IN");

const buyerState = order.state || order.customer?.state || "Rajasthan";
const posEl = document.getElementById("invoice-pos");
if (posEl) posEl.innerHTML = buyerState;

document.getElementById("invoice-name").innerHTML = order.customer?.name || order.customer || "Customer";
document.getElementById("invoice-phone").innerHTML = "<b>Phone:</b> " + (order.customer?.phone || order.phone || "N/A");
document.getElementById("invoice-address").innerHTML = "<b>Address:</b> " + (order.address || `${order.customer?.address || ''}, ${order.customer?.city || ''}, ${buyerState}`);

const buyerGstEl = document.getElementById("invoice-buyer-gstin");
if (buyerGstEl) buyerGstEl.innerHTML = order.gstin || order.customer?.gstin || "N/A";

// Check GST Enabled Status from Immutable Order Snapshot
const subtotalVal = Number(order.subtotal || order.grandTotal || 0);
let gstInfo = order.gst_details || order.gstDetails;
let isGstActive = false;

if (gstInfo && typeof gstInfo === 'object') {
  isGstActive = gstInfo.enabled === true || gstInfo.enabled === 'true';
} else if (Number(order.tax) > 0) {
  // Legacy order placed with GST
  isGstActive = true;
  const taxVal = Number(order.tax);
  gstInfo = {
    enabled: true,
    totalGST: taxVal,
    cgstAmount: Math.round((taxVal / 2) * 100) / 100,
    sgstAmount: Math.round((taxVal / 2) * 100) / 100,
    gstRate: 5
  };
} else {
  // Order placed with GST disabled (tax free)
  isGstActive = false;
  gstInfo = { enabled: false, totalGST: 0, cgstAmount: 0, sgstAmount: 0, gstRate: 0 };
}

// Render Exemption Banner if GST Disabled
const bannerEl = document.getElementById("invoice-gst-exemption-banner");
if (bannerEl) {
  if (!isGstActive) {
    bannerEl.innerHTML = `
      <div style="background: linear-gradient(135deg, #15803d 0%, #166534 100%); color: #ffffff; padding: 14px 20px; border-radius: 8px; text-align: center; margin: 15px 0; border: 1px solid #4ade80; box-shadow: 0 4px 15px rgba(22, 101, 52, 0.25);">
        <h3 style="margin: 0; font-family: serif; font-size: 1.12rem; color: #fef08a; letter-spacing: 1px;">
          🎉 CONGRATULATIONS! YOU DON'T HAVE TO PAY ANY GST! 🎉
        </h3>
        <p style="margin: 4px 0 0 0; font-size: 0.88rem; color: #f0fdf4;">
          Enjoy <strong>100% Tax-Free Shopping (₹0 GST Charged)</strong> on this purchase! Beard Banna has absorbed all taxes for you.
        </p>
      </div>
    `;
  } else {
    bannerEl.innerHTML = "";
  }
}

// Products Table Rendering
const invoiceProducts = document.getElementById("invoice-products");
if (invoiceProducts) {
  invoiceProducts.innerHTML = "";
  cartItems.forEach(item => {
    const q = item.qty || item.quantity || 1;
    const itemPrice = item.price || 0;
    const itemTotal = itemPrice * q;
    const rateText = isGstActive ? "5% <small style='color:#555;'>(CGST 2.5% + SGST 2.5%)</small>" : "<strong style='color:#166534;'>0% (TAX FREE ✨)</strong>";

    invoiceProducts.innerHTML += `
      <tr>
        <td style="padding:6px; border:1px solid #ddd;">${item.name || item.title}<br><small>Size: ${item.size || 'M'}</small></td>
        <td style="padding:6px; border:1px solid #ddd;">6109</td>
        <td style="padding:6px; border:1px solid #ddd;">${q}</td>
        <td style="padding:6px; border:1px solid #ddd;">₹${itemPrice}</td>
        <td style="padding:6px; border:1px solid #ddd;">${rateText}</td>
        <td style="padding:6px; border:1px solid #ddd;">₹${itemTotal}</td>
      </tr>
    `;
  });
}

// Totals & GST Summary Breakdown
document.getElementById("invoice-subtotal").innerHTML = subtotalVal;
document.getElementById("invoice-shipping").innerHTML = (order.shipping === 0 || !order.shipping) ? "FREE" : "₹" + order.shipping;
document.getElementById("invoice-payment").innerHTML = paymentNames[paymentCode] || paymentCode.toUpperCase();
document.getElementById("invoice-grand-total").innerHTML = order.grandTotal || order.total || 0;

const gstRowsEl = document.getElementById("invoice-gst-rows");
if (gstRowsEl) {
  if (isGstActive) {
    gstRowsEl.innerHTML = `
      <p style="margin:4px 0; display:flex; justify-content:space-between; color:#555;">CGST (2.5%): <span>+₹${gstInfo.cgstAmount || Math.round((subtotalVal * 0.025) * 100) / 100}</span></p>
      <p style="margin:4px 0; display:flex; justify-content:space-between; color:#555;">SGST (2.5%): <span>+₹${gstInfo.sgstAmount || Math.round((subtotalVal * 0.025) * 100) / 100}</span></p>
    `;
  } else {
    gstRowsEl.innerHTML = `
      <p style="margin:4px 0; display:flex; justify-content:space-between; color:#166534; font-weight:bold;">GST Taxes (0%): <span>₹0 (TAX FREE ✨)</span></p>
      <div style="background:#f0fdf4; color:#166534; padding:6px 10px; border-radius:6px; font-size:0.8rem; text-align:center; font-weight:bold; margin:6px 0; border:1px solid #bbf7d0;">
        🎁 Total GST Paid by You: ₹0
      </div>
    `;
  }
}

async function downloadInvoice() {
  const invoice = document.getElementById("invoice");
  if (!invoice) return;

  const canvas = await html2canvas(invoice, {
    scale: 2,
    useCORS: true,
    backgroundColor: "#ffffff"
  });

  const imgData = canvas.toDataURL("image/png");
  const { jsPDF } = window.jspdf;
  const pdf = new jsPDF({
    orientation: "portrait",
    unit: "mm",
    format: "a4"
  });

  const pageWidth = 210;
  const imgWidth = pageWidth - 20;
  const imgHeight = (canvas.height * imgWidth) / canvas.width;

  pdf.addImage(imgData, "PNG", 10, 10, imgWidth, imgHeight);
  pdf.save(`BEARD_BANNA_GST_Invoice_${order.orderId || '1001'}.pdf`);
}