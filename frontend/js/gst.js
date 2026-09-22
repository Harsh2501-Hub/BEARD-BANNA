// ===============================
// BEARD BANNA GST AUTOMATION ENGINE
// Database-synced source of truth (Supabase store_settings)
// ===============================

const GST_CONFIG = {
  sellerName: "BEARD BANNA ROYAL APPAREL",
  sellerGSTIN: "08AAAFB1234A1Z1",
  sellerState: "Rajasthan",
  sellerStateCode: "08",
  defaultHSN: "6109",
  defaultGSTRate: 5, // 5% Total GST (2.5% CGST + 2.5% SGST)
  enabled: false     // Default disabled until confirmed from DB
};

// Check local cache first (defaults to false if unset)
function isGSTEnabled() {
  if (typeof window.GST_SETTINGS_OVERRIDE === 'boolean') {
    return window.GST_SETTINGS_OVERRIDE;
  }
  const cached = localStorage.getItem("gstAutomationEnabled");
  if (cached !== null) {
    return cached === "true";
  }
  return false;
}

// Fetch true state from Supabase database
async function syncGSTSettingsFromDB() {
  try {
    const supabaseUrl = window.SUPABASE_URL || 'https://xdetdylcbcvtsuxteeen.supabase.co';
    const anonKey = window.SUPABASE_ANON_KEY || 'sb_publishable_1kPBK6tBanQ2Hn__ZYdJVg_oskboZIv';
    
    const res = await fetch(`${supabaseUrl}/rest/v1/store_settings?select=*`, {
      headers: {
        'apikey': anonKey,
        'Authorization': 'Bearer ' + anonKey
      }
    });

    if (res.ok) {
      const settings = await res.json();
      if (Array.isArray(settings)) {
        const gstSetting = settings.find(s => s.key === 'gst_enabled');
        const rateSetting = settings.find(s => s.key === 'gst_rate');

        if (gstSetting) {
          // Supabase stores JSONB: value can be true (boolean), "true" (string), or 1 (number)
          // Handle all three cases correctly
          const val = gstSetting.value;
          const isEnabled = val === true || val === 'true' || val === 1;
          window.GST_SETTINGS_OVERRIDE = isEnabled;
          GST_CONFIG.enabled = isEnabled;
          localStorage.setItem("gstAutomationEnabled", isEnabled ? "true" : "false");
        }
        if (rateSetting) {
          const rateVal = typeof rateSetting.value === 'number' ? rateSetting.value : Number(rateSetting.value);
          if (!isNaN(rateVal) && rateVal > 0) {
            GST_CONFIG.defaultGSTRate = rateVal;
          }
        }
      }
    }
  } catch (e) {
    console.warn("[GST] Could not sync settings from DB, using cache:", e.message);
  }
}

// Immediately trigger background sync
if (typeof window !== 'undefined') {
  syncGSTSettingsFromDB();
}

function toggleGSTAutomation(isEnabled) {
  window.GST_SETTINGS_OVERRIDE = isEnabled;
  GST_CONFIG.enabled = isEnabled;
  localStorage.setItem("gstAutomationEnabled", isEnabled ? "true" : "false");
  
  // Persist to Supabase store_settings using upsert (POST with merge-duplicates)
  const supabaseUrl = window.SUPABASE_URL || 'https://xdetdylcbcvtsuxteeen.supabase.co';
  const anonKey = window.SUPABASE_ANON_KEY || 'sb_publishable_1kPBK6tBanQ2Hn__ZYdJVg_oskboZIv';

  // Get the admin Supabase session token if available (needed for write access)
  let authToken = anonKey;
  if (window.supabaseClient) {
    window.supabaseClient.auth.getSession().then(({ data: { session } }) => {
      if (session?.access_token) authToken = session.access_token;
    }).catch(() => {});
  }
  
  fetch(`${supabaseUrl}/rest/v1/store_settings`, {
    method: 'POST',
    headers: {
      'apikey': anonKey,
      'Authorization': 'Bearer ' + authToken,
      'Content-Type': 'application/json',
      'Prefer': 'resolution=merge-duplicates'
    },
    body: JSON.stringify({
      key: 'gst_enabled',
      value: isEnabled,   // Store as actual boolean in JSONB
      updated_at: new Date().toISOString()
    })
  }).catch(err => console.warn('[GST] Failed to update DB:', err));

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

  const rate = GST_CONFIG.defaultGSTRate || 5.0;
  const halfRate = rate / 2;

  const cgstAmount = Math.round((totalAmount * (halfRate / 100)) * 100) / 100;
  const sgstAmount = Math.round((totalAmount * (halfRate / 100)) * 100) / 100;
  const totalGST = Math.round((cgstAmount + sgstAmount) * 100) / 100;

  return {
    enabled: true,
    isIntraState: true,
    gstRate: rate,
    taxableAmount: totalAmount,
    totalGST,
    cgstRate: halfRate,
    cgstAmount,
    sgstRate: halfRate,
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
window.syncGSTSettingsFromDB = syncGSTSettingsFromDB;

