   // ===============================
// ADMIN AUTH — BACKEND JWT POWERED
// ===============================
//
// SECURITY MODEL:
// ──────────────────────────────────────────────────────────────────
// Admin authorization is enforced at TWO layers:
//
//   1. BACKEND (primary): The Node.js server validates the JWT token
//      on every admin API request. Only tokens issued to users with
//      role === 'admin' in the database are accepted.
//
//   2. FRONTEND (UX only): We check for a stored admin token to decide
//      whether to redirect to login.html. This is NOT a security boundary —
//      it is a convenience UX check. The real protection is the backend.
//
// REMOVED: The insecure localStorage.adminLoggedIn === "true" bypass
// that allowed any user to open DevTools and gain admin UI access.
// ──────────────────────────────────────────────────────────────────

function isAdminLoggedIn() {
  // Only trust the presence of a real API token — not a simple boolean flag.
  return !!API.getAdminToken();
}

function saveAdminSession(token) {
  if (token) API.setAdminToken(token);
}

function clearAdminSession() {
  API.removeAdminToken();
  // Remove any legacy boolean flag if it exists
  localStorage.removeItem('adminLoggedIn');
}

const loginForm = document.getElementById('admin-login-form');

if (loginForm) {
  loginForm.addEventListener('submit', loginAdmin);
}

async function loginAdmin(e) {
  e.preventDefault();

  const usernameInput = document.getElementById('admin-username');
  const passwordInput = document.getElementById('admin-password');

  const inputVal = usernameInput ? usernameInput.value.trim() : '';
  const password = passwordInput ? passwordInput.value.trim() : '';

  if (!inputVal || !password) {
    if (typeof showToast === 'function') showToast('Please enter username/email and password', 'error');
    else alert('Please enter username/email and password');
    return;
  }

  const email = inputVal.includes('@') ? inputVal : (inputVal === 'beardbanna' ? 'beardbanna07773@gmail.com' : (inputVal === 'admin' ? 'admin@clothing.com' : inputVal));

  try {
    const res = await API.post('/auth/login', { email, password });
    const token = res.data?.tokens?.accessToken || res.token || res.accessToken;
    const user = res.data?.user || res.user;

    if (res.success && token && user?.role === 'admin') {
      saveAdminSession(token);
      if (typeof showToast === 'function') showToast('✅ Login Successful', 'success');
      else alert('✅ Login Successful');
      setTimeout(() => {
        window.location.href = 'dashboard.html';
      }, 1000);
      return;
    }

    // Backend returned success but user is not an admin
    if (res.success && user && user.role !== 'admin') {
      if (typeof showToast === 'function') showToast('❌ Access Denied: Admin privileges required', 'error');
      else alert('❌ Access Denied: Admin privileges required');
      return;
    }

    // Backend returned failure
    if (typeof showToast === 'function') showToast('❌ Invalid Username or Password', 'error');
    else alert('❌ Invalid Username or Password');

  } catch (err) {
    // Backend unreachable or returned an error
    console.warn('[Admin Auth] Backend login failed:', err.message);
    if (typeof showToast === 'function') {
      showToast('❌ Login failed. Please check your credentials or try again later.', 'error');
    } else {
      alert('❌ Login failed. Please check your credentials or try again later.');
    }
  }
}

// Redirect authenticated admins away from the login page
if (window.location.pathname.includes('login.html') && isAdminLoggedIn()) {
  setTimeout(() => {
    window.location.href = 'dashboard.html';
  }, 500);
}

// Redirect unauthenticated users to login on all other admin pages
if (!window.location.pathname.includes('login.html') && !isAdminLoggedIn()) {
  setTimeout(() => {
    window.location.href = 'login.html';
  }, 500);
}

const logoutBtn = document.getElementById('logout-btn');
if (logoutBtn) {
  logoutBtn.addEventListener('click', logoutAdmin);
}

function logoutAdmin() {
  clearAdminSession();
  if (typeof showToast === 'function') showToast('👋 Logged Out Successfully', 'success');
  else alert('Logged Out Successfully');
  setTimeout(() => {
    window.location.href = 'login.html';
  }, 800);
}