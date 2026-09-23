// ============================================================================
// BEARD BANNA — ENTERPRISE GST AUTOMATION ENGINE (STOREFRONT & CHECKOUT)
// Authoritative Database Sync (Supabase public.store_settings)
// ============================================================================

const GST_CONFIG = {
  sellerName: "BEARD BANNA ROYAL APPAREL",
  sellerGSTIN: "08AAAFB1234A1Z1",
  sellerState: "Rajasthan",
  sellerStateCode: "08",
  defaultHSN: "6109",
  defaultGSTRate: 5, // 5% Total GST (2.5% CGST + 2.5% SGST)
  enabled: false     // Default false until confirmed from DB
};

// Check local state/cache
function isGSTEnabled() {
  if (typeof window.GST_SETTINGS_OVERRIDE === 'boolean') {
    return window.GST_SETTINGS_OVERRIDE;
  }
  const cached = localStorage.getItem("gstAutomationEnabled");
  if (cached !== null) {
    return cached === "true";
  }
  return GST_CONFIG.enabled;
}

/**
 * Fetch true authoritative state from Supabase database (store_settings)
 */
async function syncGSTSettingsFromDB() {
  const supabaseUrl = window.SUPABASE_URL || 'https://xdetdylcbcvtsuxteeen.supabase.co';
  const anonKey = window.SUPABASE_ANON_KEY || 'sb_publishable_1kPBK6tBanQ2Hn__ZYdJVg_oskboZIv';

  try {
    const res = await fetch(`${supabaseUrl}/rest/v1/store_settings?select=*`, {
      method: 'GET',
      headers: {
        'apikey': anonKey,
        'Authorization': 'Bearer ' + anonKey
      }
    });

    if (!res.ok) {
      throw new Error(`HTTP ${res.status}: ${await res.text()}`);
    }

    const settings = await res.json();
    if (Array.isArray(settings)) {
      const gstSetting = settings.find(s => s.key === 'gst_enabled');
      const rateSetting = settings.find(s => s.key === 'gst_rate');

      if (gstSetting) {
        const val = gstSetting.value;
        const isEnabled = val === true || val === 'true' || val === 1;

        GST_CONFIG.enabled = isEnabled;
        window.GST_SETTINGS_OVERRIDE = isEnabled;
        localStorage.setItem("gstAutomationEnabled", isEnabled ? "true" : "false");
        return isEnabled;
      }

      if (rateSetting) {
        const rateVal = typeof rateSetting.value === 'number' ? rateSetting.value : Number(rateSetting.value);
        if (!isNaN(rateVal) && rateVal > 0) {
          GST_CONFIG.defaultGSTRate = rateVal;
        }
      }
    }
  } catch (err) {
    console.warn("[GST Storefront] Database sync notice (using cache):", err.message);
    return isGSTEnabled();
  }
}

/**
 * Calculates Taxable Value, CGST (2.5%), SGST (2.5%) = 5% Total GST
 * HSN: 6109
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
      sellerState: GST_CONFIG.sellerState,
      buyerState: buyerState || "Rajasthan"
    };
  }

  const rate = GST_CONFIG.defaultGSTRate || 5.0; // 5% Total GST
  const halfRate = rate / 2; // 2.5% each

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
    totalAmount: Math.round((totalAmount + totalGST) * 100) / 100,
    hsn: GST_CONFIG.defaultHSN,
    sellerGSTIN: GST_CONFIG.sellerGSTIN,
    sellerState: GST_CONFIG.sellerState,
    buyerState: buyerState || "Rajasthan"
  };
}

/**
 * Realtime listener for instant checkout & cart recalculation when admin changes GST
 */
function initStorefrontGSTRealtime() {
  if (!window.supabaseClient) return;
  try {
    window.supabaseClient
      .channel('storefront-store-settings-channel')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'store_settings' }, (payload) => {
        if (payload.new && payload.new.key === 'gst_enabled') {
          const val = payload.new.value;
          const isEnabled = val === true || val === 'true' || val === 1;
          GST_CONFIG.enabled = isEnabled;
          window.GST_SETTINGS_OVERRIDE = isEnabled;
          localStorage.setItem("gstAutomationEnabled", isEnabled ? "true" : "false");

          // If checkout is open, trigger recalculation
          if (typeof window.calculateTotals === 'function') {
            window.calculateTotals();
          }
        }
      })
      .subscribe();
  } catch (e) {
    console.warn('[GST Storefront] Realtime listener notice:', e.message);
  }
}

// Initial sync
if (typeof window !== 'undefined') {
  syncGSTSettingsFromDB().then(() => {
    initStorefrontGSTRealtime();
  });

  window.addEventListener('storage', (e) => {
    if (e.key === 'gstAutomationEnabled') {
      const isEnabled = e.newValue === 'true';
      GST_CONFIG.enabled = isEnabled;
      window.GST_SETTINGS_OVERRIDE = isEnabled;
      if (typeof window.calculateTotals === 'function') {
        window.calculateTotals();
      }
    }
  });
}

// Export to window
window.GST_CONFIG = GST_CONFIG;
window.isGSTEnabled = isGSTEnabled;
window.calculateGST = calculateGST;
window.syncGSTSettingsFromDB = syncGSTSettingsFromDB;
