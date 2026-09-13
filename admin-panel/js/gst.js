// ===============================
// BEARD BANNA GST AUTOMATION ENGINE
// ===============================

const GST_CONFIG = {
  sellerName: "BEARD BANNA ROYAL APPAREL",
  sellerGSTIN: "08AAAFB1234A1Z1",
  sellerState: "Rajasthan",
  sellerStateCode: "08",
  defaultHSN: "6109",
  defaultGSTRate: 5 // 5% Total GST (2.5% CGST + 2.5% SGST)
};

function isGSTEnabled() {
  return localStorage.getItem("gstAutomationEnabled") !== "false";
}

function toggleGSTAutomation(isEnabled) {
  localStorage.setItem("gstAutomationEnabled", isEnabled ? "true" : "false");
  if (typeof showToast === "function") {
    showToast(isEnabled ? "🏛️ GST Automation ENABLED" : "🚫 GST Automation DISABLED");
  } else {
    alert(isEnabled ? "🏛️ GST Automation ENABLED" : "🚫 GST Automation DISABLED");
  }
}

/**
 * Calculates Taxable Value, CGST (2.5%), SGST (2.5%) = 5% Total GST
 */
function calculateGST(subtotalAmount, buyerState = "") {
  const totalAmount = Number(subtotalAmount || 0);

  if (!isGSTEnabled()) {
    return {
      enabled: false,
      gstRate: 0,
      taxableAmount: totalAmount,
      totalGST: 0,
      cgstRate: 0,
      cgstAmount: 0,
      sgstRate: 0,
      sgstAmount: 0,
      igstRate: 0,
      igstAmount: 0,
      totalAmount,
      hsn: GST_CONFIG.defaultHSN,
      sellerGSTIN: GST_CONFIG.sellerGSTIN,
      sellerState: GST_CONFIG.sellerState
    };
  }

  const cgstRate = 2.5; // 2.5% CGST
  const sgstRate = 2.5; // 2.5% SGST
  const gstRate = 5.0;  // 5% Total GST

  const cgstAmount = Math.round((totalAmount * 0.025) * 100) / 100;
  const sgstAmount = Math.round((totalAmount * 0.025) * 100) / 100;
  const totalGST = Math.round((cgstAmount + sgstAmount) * 100) / 100;

  return {
    enabled: true,
    isIntraState: true,
    gstRate,
    taxableAmount: totalAmount,
    totalGST,
    cgstRate,
    cgstAmount,
    sgstRate,
    sgstAmount,
    igstRate: 0,
    igstAmount: 0,
    totalAmount: totalAmount + totalGST,
    hsn: GST_CONFIG.defaultHSN,
    sellerGSTIN: GST_CONFIG.sellerGSTIN,
    sellerState: GST_CONFIG.sellerState
  };
}

window.GST_CONFIG = GST_CONFIG;
window.isGSTEnabled = isGSTEnabled;
window.toggleGSTAutomation = toggleGSTAutomation;
window.calculateGST = calculateGST;
