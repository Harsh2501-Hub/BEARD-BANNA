// =========================================================
// BEARD BANNA — SUPABASE CLIENT (ADMIN PANEL)
// =========================================================

(function () {
  if (window.supabaseClient) return;

  const SUPABASE_URL = window.SUPABASE_URL;
  const SUPABASE_ANON_KEY = window.SUPABASE_ANON_KEY;

  if (!SUPABASE_URL || !SUPABASE_ANON_KEY) {
    console.warn('[Admin Panel] Supabase config missing');
    return;
  }

  if (typeof supabase === 'undefined' || typeof supabase.createClient !== 'function') {
    console.warn('[Admin Panel] Supabase CDN script not loaded');
    return;
  }

  window.supabaseClient = supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
    auth: {
      autoRefreshToken: true,
      persistSession: true,
      detectSessionInUrl: true,
      storageKey: 'bb_admin_supabase_auth'
    }
  });

  console.log('[BEARD BANNA Admin] ✅ Supabase client initialized');
})();
