// =========================================================
// BEARD BANNA — HARDENED ADMIN AUTHENTICATION
// Secure Supabase Authentication & Role Verification
// ZERO Hardcoded Passwords
// =========================================================

const PRIMARY_ADMIN_EMAIL = 'beardbanna07773@gmail.com';

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
  localStorage.removeItem('adminEmail');
}

/**
 * Validates that an authenticated Supabase user possesses the 'admin' role.
 */
async function verifyAdminRole(user) {
  if (!user) return false;

  // Primary brand administrator email
  if (user.email && user.email.toLowerCase() === PRIMARY_ADMIN_EMAIL.toLowerCase()) {
    return true;
  }

  // Check user metadata
  if (user.user_metadata?.role === 'admin') {
    return true;
  }

  // Check database public.profiles table
  if (window.supabaseClient) {
    try {
      const { data, error } = await window.supabaseClient
        .from('profiles')
        .select('role')
        .eq('id', user.id)
        .single();

      if (!error && data && data.role === 'admin') {
        return true;
      }
    } catch (e) {
      console.warn('[Admin Auth] Profile role check error:', e.message);
    }
  }

  return false;
}

// ── ADMIN LOGIN FORM HANDLER ──────────────────────────────
const loginForm = document.getElementById('admin-login-form');
if (loginForm) {
  loginForm.addEventListener('submit', loginAdmin);
}

async function loginAdmin(e) {
  e.preventDefault();

  const usernameInput = document.getElementById('admin-username');
  const passwordInput = document.getElementById('admin-password');
  const submitBtn = loginForm ? loginForm.querySelector('button[type="submit"]') : null;

  const rawInput = usernameInput ? usernameInput.value.trim() : '';
  const password = passwordInput ? passwordInput.value : '';

  if (!rawInput || !password) {
    showAuthNotice('Please enter your admin credentials');
    return;
  }

  // Resolve input to email address
  let email = rawInput.toLowerCase();
  if (!email.includes('@')) {
    if (email === 'beardbanna' || email === 'admin') {
      email = PRIMARY_ADMIN_EMAIL;
    } else {
      email = email + '@beard-banna.com';
    }
  }

  if (submitBtn) {
    submitBtn.disabled = true;
    submitBtn.innerText = 'Verifying Credentials...';
  }

  // ── Primary Gate: Authenticate directly against Supabase Auth ──
  if (window.supabaseClient) {
    try {
      const { data, error } = await window.supabaseClient.auth.signInWithPassword({
        email: email,
        password: password
      });

      if (!error && data?.user) {
        // Enforce RBAC (Role-Based Access Control)
        const hasAdminRole = await verifyAdminRole(data.user);

        if (!hasAdminRole) {
          await window.supabaseClient.auth.signOut();
          clearAdminSession();
          if (submitBtn) {
            submitBtn.disabled = false;
            submitBtn.innerText = 'Login';
          }
          showAuthNotice('❌ Access Denied: This account lacks administrator privileges.');
          return;
        }

        // ── MFA (Multi-Factor Authentication) Verification Gate ──
        try {
          const { data: aalData, error: aalErr } = await window.supabaseClient.auth.mfa.getAuthenticatorAssuranceLevel();
          if (!aalErr && aalData?.nextLevel === 'aal2' && aalData?.currentLevel === 'aal1') {
            const factors = await window.supabaseClient.auth.mfa.listFactors();
            const totpFactor = factors.data?.totp?.[0];
            if (totpFactor) {
              const code = prompt('🔐 Two-Factor Authentication Required\nEnter your 6-digit Authenticator TOTP code:');
              if (!code || !code.trim()) {
                await window.supabaseClient.auth.signOut();
                clearAdminSession();
                if (submitBtn) { submitBtn.disabled = false; submitBtn.innerText = 'Login'; }
                showAuthNotice('❌ MFA verification is required for this administrator account.');
                return;
              }

              const { data: mfaVerifyData, error: mfaVerifyErr } = await window.supabaseClient.auth.mfa.challengeAndVerify({
                factorId: totpFactor.id,
                code: code.trim()
              });

              if (mfaVerifyErr) {
                await window.supabaseClient.auth.signOut();
                clearAdminSession();
                if (submitBtn) { submitBtn.disabled = false; submitBtn.innerText = 'Login'; }
                showAuthNotice('❌ Invalid 6-digit MFA code. Verification failed.');
                return;
              }
            }
          }
        } catch (mfaEx) {
          console.warn('[Admin Auth] MFA challenge notice:', mfaEx.message);
        }

        // Admin verified (password + optional MFA)
        saveAdminSession(data.session?.access_token || 'bb_auth_valid');
        localStorage.setItem('adminEmail', data.user.email);

        if (typeof showToast === 'function') showToast('👑 Royal Admin Login Successful');
        setTimeout(() => {
          window.location.href = '/admin-panel/dashboard.html';
        }, 350);
        return;
      }
    } catch (err) {
      console.warn('[Admin Auth] Supabase auth attempt exception:', err.message);
    }
  }

  // ── Secondary Gate: Legacy backend REST API fallback ──
  try {
    if (typeof API !== 'undefined' && API.post) {
      const res = await API.post('/auth/login', { email, password });
      const token = res.data?.tokens?.accessToken || res.token || res.accessToken;
      const user = res.data?.user || res.user;

      if (res.success && token && user?.role === 'admin') {
        saveAdminSession(token);
        localStorage.setItem('adminEmail', email);
        if (typeof showToast === 'function') showToast('👑 Admin Login Successful');
        setTimeout(() => {
          window.location.href = '/admin-panel/dashboard.html';
        }, 350);
        return;
      }
    }
  } catch (apiErr) {
    console.warn('[Admin Auth] REST API fallback error:', apiErr.message);
  }

  // Failed login
  if (submitBtn) {
    submitBtn.disabled = false;
    submitBtn.innerText = 'Login';
  }
  showAuthNotice('❌ Invalid Administrator Username or Password');
}

function showAuthNotice(msg) {
  if (typeof showToast === 'function') {
    showToast(msg);
  } else {
    alert(msg);
  }
}

// ── SESSION GUARD FOR PROTECTED ADMIN PAGES ────────────────
async function verifyAdminPageAccess() {
  if (isCurrentPageLogin()) {
    // If on login page and already authenticated, forward to dashboard
    if (isAdminLoggedIn() && window.supabaseClient) {
      try {
        const { data: { session } } = await window.supabaseClient.auth.getSession();
        if (session?.user) {
          const hasAdmin = await verifyAdminRole(session.user);
          if (hasAdmin) {
            window.location.href = '/admin-panel/dashboard.html';
          }
        }
      } catch (e) {}
    }
    return;
  }

  // On protected admin pages:
  if (!isAdminLoggedIn()) {
    window.location.href = '/admin-panel/login.html';
    return;
  }

  // Double-check live Supabase session
  if (window.supabaseClient) {
    try {
      const { data: { session } } = await window.supabaseClient.auth.getSession();
      if (!session || !session.user) {
        console.warn('[Admin Auth] No active Supabase session found. Redirecting to login.');
        clearAdminSession();
        window.location.href = '/admin-panel/login.html';
        return;
      }
      const hasAdmin = await verifyAdminRole(session.user);
      if (!hasAdmin) {
        console.warn('[Admin Auth] User session is not an administrator.');
        clearAdminSession();
        window.location.href = '/admin-panel/login.html';
      }
    } catch (e) {}
  }
}

document.addEventListener('DOMContentLoaded', verifyAdminPageAccess);

// ── LOGOUT HANDLER ─────────────────────────────────────────
async function logoutAdmin() {
  clearAdminSession();

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

const logoutBtn = document.getElementById('logout-btn');
if (logoutBtn) {
  logoutBtn.addEventListener('click', logoutAdmin);
}

window.logoutAdmin = logoutAdmin;
window.isAdminLoggedIn = isAdminLoggedIn;

// ── ADMIN MFA ENROLLMENT & MANAGEMENT HELPERS ─────────────
async function checkAdminMFAStatus() {
  if (!window.supabaseClient) return { enrolled: false };
  try {
    const factors = await window.supabaseClient.auth.mfa.listFactors();
    const totpFactor = factors.data?.totp?.[0];
    return {
      enrolled: !!totpFactor && totpFactor.status === 'verified',
      factorId: totpFactor?.id || null
    };
  } catch (e) {
    return { enrolled: false };
  }
}

async function enrollAdminTOTP() {
  if (!window.supabaseClient) throw new Error('Supabase client unavailable');
  const { data, error } = await window.supabaseClient.auth.mfa.enroll({
    factorType: 'totp',
    issuer: 'BEARD BANNA Admin',
    friendlyName: 'Admin Authenticator'
  });
  if (error) throw error;
  return data;
}

window.checkAdminMFAStatus = checkAdminMFAStatus;
window.enrollAdminTOTP = enrollAdminTOTP;
