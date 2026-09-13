// =========================================================
// BEARD BANNA — SUPABASE AUTH SERVICE
// Central service for all authentication operations.
// All Supabase calls go through here — never call
// supabaseClient directly from page scripts.
// =========================================================

const SupabaseAuth = (() => {

  // ------------------------------------------------------------------
  // INTERNAL HELPERS
  // ------------------------------------------------------------------

  function getClient() {
    if (!window.supabaseClient) {
      throw new Error('Supabase is not configured. Please set your credentials in supabase-config.js');
    }
    return window.supabaseClient;
  }

  /**
   * Resolve the correct base URL for OAuth redirects and email links.
   * Works for:
   *   - Local development via HTTP server (http://localhost:xxxx)
   *   - Deployed production (https://yourdomain.com)
   *   - file:// (falls back to a safe placeholder — OAuth won't work here anyway)
   */
  function getBaseUrl() {
    const origin = window.location.origin;
    // file:// origin returns "null" — OAuth cannot work from file:// directly.
    // This guard prevents a broken redirect and surfaces a clear error instead.
    if (origin === 'null' || origin === 'file://') {
      return null;
    }
    return origin;
  }

  /**
   * Build the full redirect URL for post-auth landing.
   * Returns null if running from file:// (OAuth requires HTTP/S).
   */
  function buildRedirectUrl(path) {
    const base = getBaseUrl();
    if (!base) return null;
    // Normalise path — always starts with /
    const cleanPath = path.startsWith('/') ? path : '/' + path;
    return `${base}${cleanPath}`;
  }

  /**
   * Translates raw Supabase/network errors into user-friendly messages.
   */
  function friendlyError(error) {
    if (!error) return 'Something went wrong. Please try again.';

    const msg = (error.message || '').toLowerCase();

    if (msg.includes('invalid login credentials') || msg.includes('invalid email or password')) {
      return 'Email or password is incorrect. Please try again.';
    }
    if (msg.includes('email not confirmed')) {
      return 'Please verify your email address before signing in. Check your inbox.';
    }
    if (msg.includes('user already registered') || msg.includes('already exists')) {
      return 'An account with this email already exists. Please sign in instead.';
    }
    if (msg.includes('password should be at least') || msg.includes('weak password')) {
      return 'Please choose a stronger password (minimum 6 characters).';
    }
    if (msg.includes('invalid email')) {
      return 'Please enter a valid email address.';
    }
    if (msg.includes('signup is disabled')) {
      return 'New registrations are currently disabled. Please contact support.';
    }
    if (msg.includes('rate limit') || msg.includes('too many')) {
      return 'Too many attempts. Please wait a moment and try again.';
    }
    if (msg.includes('network') || msg.includes('fetch') || msg.includes('failed to fetch')) {
      return 'Network error. Please check your connection and try again.';
    }
    if (msg.includes('auth session missing') || msg.includes('not authenticated')) {
      return 'Your session has expired. Please sign in again.';
    }
    if (msg.includes('same password')) {
      return 'New password must be different from your current password.';
    }
    if (msg.includes('provider') && msg.includes('not enabled')) {
      return 'This sign-in method is not enabled yet. Please use email & password or Magic Link.';
    }

    // Fallback: generic message, never expose raw technical errors
    return 'Something went wrong. Please try again or contact support.';
  }

  // ------------------------------------------------------------------
  // SESSION
  // ------------------------------------------------------------------

  /**
   * Get current Supabase session (async, refreshes if needed).
   * Returns { session, user } or { session: null, user: null }
   */
  async function getSession() {
    try {
      const client = getClient();
      const { data, error } = await client.auth.getSession();
      if (error) throw error;
      return {
        session: data.session,
        user: data.session?.user || null
      };
    } catch (err) {
      console.warn('[Auth] getSession error:', err.message);
      return { session: null, user: null };
    }
  }

  /**
   * Convenience: returns just the current user object or null.
   */
  async function getCurrentUser() {
    const { user } = await getSession();
    return user;
  }

  // ------------------------------------------------------------------
  // PROFILES TABLE
  // ------------------------------------------------------------------

  /**
   * Upsert (insert or update) a profile row.
   * Safe to call multiple times — won't create duplicates.
   * Supports all fields: full_name, email, phone, avatar_url.
   */
  async function upsertProfile(userId, profileData) {
    try {
      const client = getClient();
      const { error } = await client
        .from('profiles')
        .upsert({
          id: userId,
          ...profileData,
          updated_at: new Date().toISOString()
        }, {
          onConflict: 'id' // Safe upsert — won't create duplicates
        });

      if (error) throw error;
      return { success: true };
    } catch (err) {
      console.warn('[Auth] upsertProfile error:', err.message);
      return { success: false, error: err.message };
    }
  }

  /**
   * Read a user's own profile from the profiles table.
   */
  async function getProfile(userId) {
    try {
      const client = getClient();
      const { data, error } = await client
        .from('profiles')
        .select('*')
        .eq('id', userId)
        .single();

      if (error && error.code !== 'PGRST116') throw error; // PGRST116 = not found, which is OK
      return { success: true, profile: data || null };
    } catch (err) {
      console.warn('[Auth] getProfile error:', err.message);
      return { success: false, profile: null, error: err.message };
    }
  }

  /**
   * Update profile fields (name, phone, avatar_url).
   */
  async function updateProfile(userId, updates) {
    try {
      const client = getClient();
      const { data, error } = await client
        .from('profiles')
        .update({
          ...updates,
          updated_at: new Date().toISOString()
        })
        .eq('id', userId)
        .select()
        .single();

      if (error) throw error;
      return { success: true, profile: data };
    } catch (err) {
      console.warn('[Auth] updateProfile error:', err.message);
      return { success: false, error: friendlyError(err) };
    }
  }

  /**
   * Extract and upsert profile from a Supabase user object.
   * Handles both email/password and OAuth (Google) users.
   * Safe to call on every SIGNED_IN event — idempotent.
   */
  async function syncProfileFromUser(user) {
    if (!user) return { success: false };
    try {
      const meta = user.user_metadata || {};
      // Google populates: full_name, name, avatar_url, picture
      const fullName =
        meta.full_name ||
        meta.name ||
        user.email?.split('@')[0] ||
        '';
      const avatarUrl = meta.avatar_url || meta.picture || null;
      const email = user.email || '';
      const phone = meta.phone || '';

      return await upsertProfile(user.id, {
        full_name: fullName,
        email,
        phone,
        ...(avatarUrl ? { avatar_url: avatarUrl } : {})
      });
    } catch (err) {
      console.warn('[Auth] syncProfileFromUser error:', err.message);
      return { success: false };
    }
  }

  // ------------------------------------------------------------------
  // SIGN UP
  // ------------------------------------------------------------------

  /**
   * Register a new customer with email/password.
   * Automatically creates a profile row after auth signup.
   */
  async function signUp(fullName, email, phone, password) {
    try {
      const client = getClient();

      const { data, error } = await client.auth.signUp({
        email: email.trim().toLowerCase(),
        password,
        options: {
          data: {
            full_name: fullName.trim(),
            phone: phone?.trim() || ''
          }
        }
      });

      if (error) throw error;

      const user = data.user;
      const session = data.session;

      // Create profile immediately if session is available (email confirmation disabled)
      // OR queue it to be created on first login (email confirmation enabled)
      if (user) {
        await upsertProfile(user.id, {
          full_name: fullName.trim(),
          email: email.trim().toLowerCase(),
          phone: phone?.trim() || ''
        });
      }

      const needsEmailConfirmation = !session && user && !user.confirmed_at;

      return {
        success: true,
        user,
        session,
        needsEmailConfirmation
      };

    } catch (err) {
      return {
        success: false,
        error: friendlyError(err)
      };
    }
  }

  // ------------------------------------------------------------------
  // SIGN IN
  // ------------------------------------------------------------------

  /**
   * Sign in with email and password.
   */
  async function signIn(email, password) {
    try {
      const client = getClient();

      const { data, error } = await client.auth.signInWithPassword({
        email: email.trim().toLowerCase(),
        password
      });

      if (error) throw error;

      const user = data.user;

      // Ensure profile exists (handles OAuth users, or cases where profile creation
      // failed during registration)
      if (user) {
        const { profile } = await getProfile(user.id);
        if (!profile) {
          await upsertProfile(user.id, {
            full_name: user.user_metadata?.full_name || user.email.split('@')[0],
            email: user.email,
            phone: user.user_metadata?.phone || ''
          });
        }
      }

      return { success: true, user: data.user, session: data.session };
    } catch (err) {
      return { success: false, error: friendlyError(err) };
    }
  }

  // ------------------------------------------------------------------
  // GOOGLE OAUTH
  // ------------------------------------------------------------------

  /**
   * Initiate Google OAuth sign-in via Supabase.
   * Redirects to Google, then returns to the site.
   * Works on HTTP localhost and deployed HTTPS.
   * Will return an error if run from file:// (OAuth requires HTTP/S).
   */
  async function signInWithGoogle() {
    try {
      const client = getClient();

      // Build redirect URL — works for both local HTTP dev and production HTTPS
      const redirectTo = buildRedirectUrl('/index.html') || `${window.location.origin}/index.html`;

      if (!redirectTo) {
        return {
          success: false,
          error: 'Google sign-in requires an HTTP server. Please open this site via http://localhost instead of directly from a file.'
        };
      }

      const { error } = await client.auth.signInWithOAuth({
        provider: 'google',
        options: {
          redirectTo,
          queryParams: {
            access_type: 'offline',
            prompt: 'consent'
          }
        }
      });

      if (error) throw error;
      // Browser will redirect — no return value needed

    } catch (err) {
      return { success: false, error: friendlyError(err) };
    }
  }

  // ------------------------------------------------------------------
  // SIGN OUT
  // ------------------------------------------------------------------

  /**
   * Sign out the current user from Supabase.
   */
  async function signOut() {
    try {
      const client = getClient();
      const { error } = await client.auth.signOut();
      if (error) throw error;

      // Clean up any legacy localStorage keys from the old auth system
      localStorage.removeItem('authToken');
      localStorage.removeItem('currentUser');
      localStorage.removeItem('lastOrder');

      return { success: true };
    } catch (err) {
      return { success: false, error: friendlyError(err) };
    }
  }

  // ------------------------------------------------------------------
  // PASSWORD RESET
  // ------------------------------------------------------------------

  /**
   * Send a password reset email to the given address.
   */
  async function sendPasswordReset(email) {
    try {
      const client = getClient();

      // Redirect URL after clicking the link in the email
      const redirectTo = buildRedirectUrl('/frontend/reset-password.html');

      const { error } = await client.auth.resetPasswordForEmail(
        email.trim().toLowerCase(),
        { redirectTo }
      );

      if (error) throw error;
      return { success: true };
    } catch (err) {
      return { success: false, error: friendlyError(err) };
    }
  }

  /**
   * Update password (called from reset-password.html after redirect).
   * Only works when a valid recovery session is active.
   */
  async function updatePassword(newPassword) {
    try {
      const client = getClient();
      const { data, error } = await client.auth.updateUser({ password: newPassword });
      if (error) throw error;
      return { success: true, user: data.user };
    } catch (err) {
      return { success: false, error: friendlyError(err) };
    }
  }

  // ------------------------------------------------------------------
  // AUTH STATE LISTENER
  // ------------------------------------------------------------------

  /**
   * Subscribe to auth state changes.
   * callback(event, session) is called on:
   *   SIGNED_IN, SIGNED_OUT, TOKEN_REFRESHED, PASSWORD_RECOVERY, etc.
   * Returns the unsubscribe function.
   */
  function onAuthStateChange(callback) {
    try {
      const client = getClient();
      const { data: { subscription } } = client.auth.onAuthStateChange(callback);
      return () => subscription.unsubscribe();
    } catch (err) {
      console.warn('[Auth] onAuthStateChange setup failed:', err.message);
      return () => {};
    }
  }

  // ------------------------------------------------------------------
  // PUBLIC API
  // ------------------------------------------------------------------
  return {
    getSession,
    getCurrentUser,
    signUp,
    signIn,
    signInWithGoogle,
    signOut,
    sendPasswordReset,
    updatePassword,
    upsertProfile,
    getProfile,
    updateProfile,
    syncProfileFromUser,
    onAuthStateChange,
    friendlyError,
    buildRedirectUrl  // Exposed for use in login.js magic link
  };

})();

window.SupabaseAuth = SupabaseAuth;
