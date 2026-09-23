// ============================================================================
// BEARD BANNA — ENTERPRISE GST AUTOMATION ENGINE (ADMIN PANEL)
// Authoritative Database Sync (Supabase public.store_settings)
// ============================================================================

const GST_CONFIG = {
  sellerName: "BEARD BANNA ROYAL APPAREL",
  sellerGSTIN: "08AAAFB1234A1Z1",
  sellerState: "Rajasthan",
  sellerStateCode: "08",
  defaultHSN: "6109",
  defaultGSTRate: 5, // 5% Total GST (2.5% CGST + 2.5% SGST)
  enabled: false     // Authoritative state synced from database
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
 * Updates all GST status badges and checkboxes across admin pages
 */
function updateGSTUI(isEnabled, isSyncing = false, isSaving = false) {
  const badges = [
    document.getElementById("gst-status-badge"),
    document.getElementById("settings-gst-badge")
  ].filter(Boolean);

  const checkboxes = [
    document.getElementById("gst-toggle-checkbox"),
    document.getElementById("settings-gst-checkbox")
  ].filter(Boolean);

  checkboxes.forEach(cb => {
    cb.checked = isEnabled;
    cb.disabled = isSyncing || isSaving;
  });

  badges.forEach(b => {
    if (isSaving) {
      b.textContent = "SAVING...";
      b.style.background = "#f59e0b"; // Amber
      b.style.color = "#ffffff";
    } else if (isSyncing) {
      b.textContent = "SYNCING...";
      b.style.background = "#64748b"; // Neutral slate
      b.style.color = "#ffffff";
    } else {
      b.textContent = isEnabled ? "ENABLED" : "DISABLED";
      b.style.background = isEnabled ? "#22c55e" : "#ef4444"; // Green / Red
      b.style.color = "#ffffff";
    }
  });
}

/**
 * Obtains a validated, active admin JWT for RLS-protected database writes
 */
async function getAuthoritativeAdminToken() {
  if (!window.supabaseClient) {
    console.error("[GST Engine] Supabase client is not initialized.");
    return null;
  }

  try {
    const { data: { session } } = await window.supabaseClient.auth.getSession();
    if (session?.access_token) {
      // Check JWT expiration with 30s buffer
      try {
        const payload = JSON.parse(atob(session.access_token.split('.')[1]));
        if (payload.exp * 1000 > Date.now() + 30000) {
          return session.access_token;
        }
      } catch (e) {
        return session.access_token;
      }
    }
  } catch (e) {
    console.warn("[GST Engine] Session check notice:", e.message);
  }

  // Session expired or missing — re-authenticate as admin
  try {
    if (typeof window.signAdminIntoSupabase === "function") {
      const ok = await window.signAdminIntoSupabase();
      if (ok) {
        const { data: { session } } = await window.supabaseClient.auth.getSession();
        if (session?.access_token) return session.access_token;
      }
    } else {
      // Direct sign-in using admin credentials
      const { data, error } = await window.supabaseClient.auth.signInWithPassword({
        email: 'beardbanna07773@gmail.com',
        password: 'Banna@7773'
      });
      if (!error && data?.session?.access_token) {
        return data.session.access_token;
      }
    }
  } catch (err) {
    console.error("[GST Engine] Admin re-authentication failed:", err);
  }

  return null;
}

/**
 * Fetch true authoritative GST state directly from Supabase store_settings table
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

        updateGSTUI(isEnabled, false, false);
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
    console.warn("[GST Engine] Failed to fetch settings from DB, falling back to cache:", err.message);
    const cachedEnabled = isGSTEnabled();
    updateGSTUI(cachedEnabled, false, false);
    return cachedEnabled;
  }
}

/**
 * ARCHITECTURAL CORE:
 * ADMIN CLICKS TOGGLE
 *   ↓
 * UPDATE DATABASE FIRST
 *   ↓
 * DATABASE CONFIRMS SUCCESS
 *   ↓
 * UPDATE UI STATE & LOCAL CACHE
 *   ↓
 * SHOW SUCCESS TOAST
 *
 * IF FAILURE: REVERT TOGGLE, SHOW CLEAR ERROR
 */
async function toggleGSTAutomation(targetState) {
  const previousState = GST_CONFIG.enabled;

  // 1. Temporarily disable switch and show SAVING... indicator
  updateGSTUI(previousState, false, true);

  const supabaseUrl = window.SUPABASE_URL || 'https://xdetdylcbcvtsuxteeen.supabase.co';
  const anonKey = window.SUPABASE_ANON_KEY || 'sb_publishable_1kPBK6tBanQ2Hn__ZYdJVg_oskboZIv';

  try {
    // 2. Obtain authoritative admin JWT
    const adminToken = await getAuthoritativeAdminToken();
    if (!adminToken) {
      throw new Error("Admin authentication required. Please sign into the Admin Panel.");
    }

    // 3. Update Supabase public.store_settings table via PATCH
    let res = await fetch(`${supabaseUrl}/rest/v1/store_settings?key=eq.gst_enabled`, {
      method: 'PATCH',
      headers: {
        'apikey': anonKey,
        'Authorization': 'Bearer ' + adminToken,
        'Content-Type': 'application/json',
        'Prefer': 'return=representation'
      },
      body: JSON.stringify({
        value: targetState,
        updated_at: new Date().toISOString()
      })
    });

    // Fallback: If row did not exist yet, perform UPSERT (POST)
    if (!res.ok || res.status === 404) {
      res = await fetch(`${supabaseUrl}/rest/v1/store_settings`, {
        method: 'POST',
        headers: {
          'apikey': anonKey,
          'Authorization': 'Bearer ' + adminToken,
          'Content-Type': 'application/json',
          'Prefer': 'resolution=merge-duplicates'
        },
        body: JSON.stringify({
          key: 'gst_enabled',
          value: targetState,
          updated_at: new Date().toISOString()
        })
      });
    }

    if (!res.ok) {
      const errText = await res.text();
      throw new Error(`Database rejected update (Status ${res.status}): ${errText}`);
    }

    // 4. DATABASE CONFIRMED SUCCESS -> Update in-memory state & localStorage
    GST_CONFIG.enabled = targetState;
    window.GST_SETTINGS_OVERRIDE = targetState;
    localStorage.setItem("gstAutomationEnabled", targetState ? "true" : "false");

    // 5. Update UI to confirmed state
    updateGSTUI(targetState, false, false);

    const successMsg = targetState
      ? "🏛️ GST Automation ENABLED & Synced to Database"
      : "🚫 GST Automation DISABLED & Synced to Database";

    if (typeof showToast === "function") showToast(successMsg);
    else alert(successMsg);

    console.log(`[GST Engine] ✅ Database updated: gst_enabled = ${targetState}`);

  } catch (err) {
    console.error("[GST Engine] ❌ Failed to update GST setting in database:", err);

    // 6. FAILURE -> REVERT TOGGLE & BADGE TO PREVIOUS CONFIRMED STATE
    GST_CONFIG.enabled = previousState;
    window.GST_SETTINGS_OVERRIDE = previousState;
    localStorage.setItem("gstAutomationEnabled", previousState ? "true" : "false");
    updateGSTUI(previousState, false, false);

    const errorMsg = `❌ GST Setting Failed: ${err.message || 'Database connection error'}`;
    if (typeof showToast === "function") showToast(errorMsg);
    else alert(errorMsg);
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
      sellerState: GST_CONFIG.sellerState,
      buyerState: buyerState || "Rajasthan"
    };
  }

  const rate = GST_CONFIG.defaultGSTRate || 5.0; // 5% total
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
 * Initialize Realtime channel for instant cross-tab / cross-device consistency
 */
function initGSTRealtime() {
  if (!window.supabaseClient) return;
  try {
    window.supabaseClient
      .channel('admin-store-settings-channel')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'store_settings' }, (payload) => {
        if (payload.new && payload.new.key === 'gst_enabled') {
          const val = payload.new.value;
          const isEnabled = val === true || val === 'true' || val === 1;
          GST_CONFIG.enabled = isEnabled;
          window.GST_SETTINGS_OVERRIDE = isEnabled;
          localStorage.setItem("gstAutomationEnabled", isEnabled ? "true" : "false");
          updateGSTUI(isEnabled, false, false);
          console.log("[GST Engine] Realtime update received: gst_enabled =", isEnabled);
        }
      })
      .subscribe();
  } catch (e) {
    console.warn('[GST Engine] Realtime setup notice:', e.message);
  }
}

// Cross-tab sync via storage events
if (typeof window !== 'undefined') {
  window.addEventListener('storage', (e) => {
    if (e.key === 'gstAutomationEnabled') {
      const isEnabled = e.newValue === 'true';
      GST_CONFIG.enabled = isEnabled;
      window.GST_SETTINGS_OVERRIDE = isEnabled;
      updateGSTUI(isEnabled, false, false);
    }
  });

  // Set initial syncing state immediately when DOM is ready
  document.addEventListener('DOMContentLoaded', () => {
    updateGSTUI(isGSTEnabled(), true, false);
    syncGSTSettingsFromDB().then(() => {
      initGSTRealtime();
    });
  });

  // Also trigger sync on script execution if DOM is already loaded
  if (document.readyState === 'complete' || document.readyState === 'interactive') {
    syncGSTSettingsFromDB().then(() => {
      initGSTRealtime();
    });
  }
}

// Export to window
window.GST_CONFIG = GST_CONFIG;
window.isGSTEnabled = isGSTEnabled;
window.toggleGSTAutomation = toggleGSTAutomation;
window.calculateGST = calculateGST;
window.syncGSTSettingsFromDB = syncGSTSettingsFromDB;
window.updateGSTUI = updateGSTUI;
