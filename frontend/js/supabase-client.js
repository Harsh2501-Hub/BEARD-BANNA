// =========================================================
// BEARD BANNA — SUPABASE CLIENT (CDN ESM)
// Singleton client — import this in every auth-related script
// =========================================================

(function () {
  // Guard: already initialized
  if (window.supabaseClient) return;

  const SUPABASE_URL = window.SUPABASE_URL;
  const SUPABASE_ANON_KEY = window.SUPABASE_ANON_KEY;

  if (!SUPABASE_URL || SUPABASE_URL === 'YOUR_SUPABASE_URL') {
    console.error(
      '[BEARD BANNA] ⚠️ Supabase is not configured!\n' +
      'Open frontend/js/supabase-config.js and set your SUPABASE_URL and SUPABASE_ANON_KEY.\n' +
      'Get these from: Supabase Dashboard → Settings → API'
    );
    // Create a mock client so the rest of the app doesn't crash
    window.supabaseClient = null;
    return;
  }

  // Load Supabase via CDN (already added to HTML via <script> tag)
  // The global `supabase` object comes from the CDN script
  if (typeof supabase === 'undefined' || typeof supabase.createClient !== 'function') {
    console.error('[BEARD BANNA] Supabase CDN script not loaded. Make sure the CDN <script> tag is present before this file.');
    window.supabaseClient = null;
    return;
  }

  window.supabaseClient = supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
    auth: {
      autoRefreshToken: true,
      persistSession: true,         // Session persists across page refreshes
      detectSessionInUrl: true,     // Handles OAuth + password reset redirects
      storageKey: 'bb_auth_session' // Namespaced key in localStorage
    }
  });

  console.log('[BEARD BANNA] ✅ Supabase client initialized');
})();
