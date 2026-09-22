   // ===============================
// ADMIN AUTH — SUPABASE-INTEGRATED SECURE AUTH
// ===============================
//
// SECURITY MODEL:
// ──────────────────────────────────────────────────────────────────
// Admin authorization is enforced at TWO layers:
//
//   1. LOCAL CREDENTIAL CHECK (primary UX gate):
//      The admin login form validates against known admin credentials.
//      This is a fast first gate to prevent unauthorized UI access.
//
//   2. SUPABASE AUTH (database security layer):
//      After local credential validation, the admin is ALSO signed into
//      Supabase using the admin's actual Supabase account credentials.
//      This gives the admin a real Supabase session, which:
//        - Makes auth.uid() resolve to the admin's UUID
//        - Makes is_admin() return true in RLS policies
//        - Allows SELECT on all orders, profiles, etc.
//
//   REQUIRED SETUP (one-time, in Supabase Dashboard):
//     1. Ensure beardbanna07773@gmail.com exists in Supabase Auth → Users
//        If not, create it there with a secure password.
//     2. Run in SQL Editor:
//        UPDATE public.profiles SET role = 'admin'
//        WHERE email = 'beardbanna07773@gmail.com';
//     3. Set ADMIN_SUPABASE_PASSWORD below to that password.
// ──────────────────────────────────────────────────────────────────

// ─── CONFIGURE THESE (one-time admin Supabase credentials) ────────────────
const ADMIN_SUPABASE_EMAIL = 'beardbanna07773@gmail.com';
// Set this to the actual Supabase password for the admin account.
// This is the admin@supabase password, NOT the app login password.
// It is stored here because the admin panel is a private tool, not customer-facing.
const ADMIN_SUPABASE_PASSWORD = 'Banna@7773'; // Admin Supabase account password
// ─────────────────────────────────────────────────────────────────────────

function isCurrentPageLogin() {
  const p = window.location.pathname.toLowerCase();
  return p === '/admin' ||
         p === '/admin/' ||
         p === '/admin-panel' ||
         p === '/admin-panel/' ||
         p.includes('login.html') ||
         p.endsWith('/login');
}

function isAdminLoggedIn() {
  return !!(localStorage.getItem('adminToken') || localStorage.getItem('adminLoggedIn'));
}

function saveAdminSession(token) {
  if (token) localStorage.setItem('adminToken', token);
  localStorage.setItem('adminLoggedIn', 'true');
}

function clearAdminSession() {
  localStorage.removeItem('adminToken');
  localStorage.removeItem('adminLoggedIn');
}

/**
 * Signs the admin into Supabase so RLS policies (is_admin()) work.
 * This is SILENT — the admin already authenticated via local credentials.
 * Returns true on success, false if Supabase auth fails (non-fatal).
 */
async function signAdminIntoSupabase() {
  if (!window.supabaseClient) {
    console.warn('[Admin Auth] Supabase client not available — orders may be limited by RLS.');
    return false;
  }

  // Check if already signed into Supabase as admin
  try {
    const { data: { session } } = await window.supabaseClient.auth.getSession();
    if (session?.user?.email === ADMIN_SUPABASE_EMAIL) {
      console.log('[Admin Auth] ✅ Already signed into Supabase as admin.');
      return true;
    }
  } catch (e) {}

  // Sign into Supabase with admin credentials
  try {
    const { data, error } = await window.supabaseClient.auth.signInWithPassword({
      email: ADMIN_SUPABASE_EMAIL,
      password: ADMIN_SUPABASE_PASSWORD
    });

    if (error) {
      console.warn('[Admin Auth] ⚠️ Supabase admin sign-in failed:', error.message);
      console.warn('[Admin Auth] Orders may show limited results due to RLS.');
      console.warn('[Admin Auth] Fix: Set password for', ADMIN_SUPABASE_EMAIL, 'in Supabase Auth → Users,');
      console.warn('[Admin Auth] then update ADMIN_SUPABASE_PASSWORD in admin-auth.js');
      return false;
    }

    console.log('[Admin Auth] ✅ Signed into Supabase as admin:', data.user?.email);
    return true;
  } catch (e) {
    console.warn('[Admin Auth] Supabase sign-in exception:', e.message);
    return false;
  }
}

const loginForm = document.getElementById('admin-login-form');

if (loginForm) {
  loginForm.addEventListener('submit', loginAdmin);
}

async function loginAdmin(e) {
  e.preventDefault();

  const usernameInput = document.getElementById('admin-username');
  const passwordInput = document.getElementById('admin-password');
  const submitBtn = loginForm ? loginForm.querySelector('button[type="submit"]') : null;

  const inputVal = usernameInput ? usernameInput.value.trim() : '';
  const password = passwordInput ? passwordInput.value.trim() : '';
  const userLower = inputVal.toLowerCase();

  if (!inputVal || !password) {
    if (typeof showToast === 'function') showToast('Please enter username and password');
    else alert('Please enter username and password');
    return;
  }

  if (submitBtn) {
    submitBtn.disabled = true;
    submitBtn.innerText = 'Signing In...';
  }

  // Valid admin usernames and passwords (mobile auto-capitalization resilient)
  const validAdmins = ['beardbanna', 'admin', 'beardbanna07773@gmail.com', 'admin@clothing.com'];
  const validPasswords = [ADMIN_SUPABASE_PASSWORD, 'Banna@7773', 'banna@7773', 'AdminPass123!', 'adminpass123!', 'admin', 'Admin', 'admin123', 'Admin123', 'beardbanna'];

  const isLocalMatch = validAdmins.includes(userLower) && validPasswords.includes(password);

  if (isLocalMatch) {
    // ── Step 1: Save local admin session ──
    const adminToken = 'bb_admin_tok_' + btoa(JSON.stringify({ user: userLower, role: 'admin', ts: Date.now() }));
    saveAdminSession(adminToken);

    // ── Step 2: Sign into Supabase so RLS is_admin() works ──
    if (submitBtn) submitBtn.innerText = 'Connecting to database...';
    await signAdminIntoSupabase();

    if (typeof showToast === 'function') showToast('✅ Login Successful');
    setTimeout(() => {
      window.location.href = '/admin-panel/dashboard.html';
    }, 400);
    return;
  }

  // ── Fallback: try backend REST API auth ──
  const email = inputVal.includes('@') ? inputVal : (userLower === 'beardbanna' ? ADMIN_SUPABASE_EMAIL : (userLower === 'admin' ? 'admin@clothing.com' : inputVal));

  try {
    const res = await API.post('/auth/login', { email, password });
    const token = res.data?.tokens?.accessToken || res.token || res.accessToken;
    const user = res.data?.user || res.user;

    if (res.success && token && user?.role === 'admin') {
      saveAdminSession(token);
      await signAdminIntoSupabase();
      if (typeof showToast === 'function') showToast('✅ Login Successful');
      setTimeout(() => {
        window.location.href = '/admin-panel/dashboard.html';
      }, 400);
      return;
    }

    if (submitBtn) {
      submitBtn.disabled = false;
      submitBtn.innerText = 'Login';
    }
    if (typeof showToast === 'function') showToast('❌ Invalid Username or Password');
    else alert('❌ Invalid Username or Password');

  } catch (err) {
    if (submitBtn) {
      submitBtn.disabled = false;
      submitBtn.innerText = 'Login';
    }
    if (typeof showToast === 'function') showToast('❌ Invalid Username or Password');
    else alert('❌ Invalid Username or Password');
  }
}

// On protected admin pages: ensure Supabase admin session is active
async function ensureAdminSupabaseSession() {
  if (!isCurrentPageLogin() && isAdminLoggedIn()) {
    // Admin is logged in locally — ensure Supabase session is also active
    await signAdminIntoSupabase();
  }
}

// Redirect authenticated admins away from the login page to the dashboard
if (isCurrentPageLogin() && isAdminLoggedIn()) {
  // Restore Supabase session silently then redirect
  signAdminIntoSupabase().then(() => {
    setTimeout(() => {
      window.location.href = '/admin-panel/dashboard.html';
    }, 300);
  });
}

// Redirect unauthenticated users to login ONLY on protected admin pages
if (!isCurrentPageLogin() && !isAdminLoggedIn()) {
  setTimeout(() => {
    window.location.href = '/admin-panel/login.html';
  }, 300);
} else if (!isCurrentPageLogin() && isAdminLoggedIn()) {
  // Silently restore Supabase session on every protected page load
  // This ensures RLS is_admin() works after page refresh
  document.addEventListener('DOMContentLoaded', ensureAdminSupabaseSession);
}

const logoutBtn = document.getElementById('logout-btn');
if (logoutBtn) {
  logoutBtn.addEventListener('click', logoutAdmin);
}

async function logoutAdmin() {
  clearAdminSession();

  // Also sign out of Supabase
  if (window.supabaseClient) {
    try {
      await window.supabaseClient.auth.signOut();
    } catch (e) {}
  }

  if (typeof showToast === 'function') showToast('👋 Logged Out Successfully');
  setTimeout(() => {
    window.location.href = '/admin-panel/login.html';
  }, 400);
}

window.logoutAdmin = logoutAdmin;