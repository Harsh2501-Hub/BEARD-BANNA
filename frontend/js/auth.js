// ===============================
// AUTH SYSTEM - SUPABASE POWERED
// Handles navbar user state display
// and session persistence across pages.
// ===============================

/**
 * Initialises the #user-area in the navbar based on
 * the current Supabase session. Works on every page.
 */
async function initAuthUI() {
  const userArea = document.getElementById('user-area');
  if (!userArea) return;

  // Show a subtle loading placeholder while session resolves
  userArea.innerHTML = '';

  // Supabase is optional — if not configured, fall back gracefully
  if (!window.supabaseClient || !window.SupabaseAuth) {
    renderLoggedOut(userArea);
    return;
  }

  try {
    const { user } = await SupabaseAuth.getSession();

    if (user) {
      // Try to get display name: prefer profile table, then auth metadata, then email prefix
      let displayName = user.user_metadata?.full_name
        || user.user_metadata?.name
        || user.email?.split('@')[0]
        || 'Royal Member';

      // Capitalise first letter
      displayName = displayName.charAt(0).toUpperCase() + displayName.slice(1);

      renderLoggedIn(userArea, displayName);
    } else {
      renderLoggedOut(userArea);
    }
  } catch (err) {
    console.warn('[Auth] initAuthUI error:', err.message);
    renderLoggedOut(userArea);
  }
}

function renderLoggedIn(userArea, displayName) {
  userArea.innerHTML = `
    <div class="user-dropdown">
      <button id="user-toggle" class="user-toggle" aria-haspopup="true" aria-expanded="false">
        👤 ${displayName} ▼
      </button>
      <div id="dropdown-menu" class="dropdown-menu" role="menu">
        <a href="profile.html" role="menuitem">👤 My Profile</a>
        <a href="track-order.html" role="menuitem">📦 My Orders</a>
        <a href="wishlist.html" role="menuitem">❤️ Wishlist</a>
        <button onclick="logout()" role="menuitem">🚪 Logout</button>
      </div>
    </div>
  `;

  const toggle = document.getElementById('user-toggle');
  const menu = document.getElementById('dropdown-menu');

  if (toggle && menu) {
    toggle.addEventListener('click', (e) => {
      e.stopPropagation();
      const isOpen = menu.classList.toggle('show-menu');
      toggle.classList.toggle('active', isOpen);
      toggle.setAttribute('aria-expanded', isOpen);
    });

    // Close when clicking outside
    document.addEventListener('click', (e) => {
      if (!toggle.contains(e.target) && !menu.contains(e.target)) {
        menu.classList.remove('show-menu');
        toggle.classList.remove('active');
        toggle.setAttribute('aria-expanded', 'false');
      }
    });

    // Close on Escape key
    document.addEventListener('keydown', (e) => {
      if (e.key === 'Escape') {
        menu.classList.remove('show-menu');
        toggle.classList.remove('active');
        toggle.setAttribute('aria-expanded', 'false');
      }
    });
  }
}

function renderLoggedOut(userArea) {
  userArea.innerHTML = `
    <a href="login.html" class="login-btn">Login</a>
    <a href="register.html" class="register-btn">Register</a>
  `;
}

/**
 * Logs the customer out using Supabase Auth and
 * clears all local session data.
 */
async function logout() {
  if (!confirm('Are you sure you want to logout?')) return;

  // Update button text while signing out
  const toggleBtn = document.getElementById('user-toggle');
  if (toggleBtn) toggleBtn.textContent = '⏳ Signing out...';

  const result = await SupabaseAuth.signOut();

  // Clear legacy localStorage keys (old auth system)
  localStorage.removeItem('authToken');
  localStorage.removeItem('currentUser');
  localStorage.removeItem('lastOrder');

  if (result.success) {
    if (typeof showToast === 'function') {
      showToast('👋 Logged out successfully!');
    }
  }

  setTimeout(() => {
    window.location.href = 'index.html';
  }, 800);
}

// ── Real-time auth state listener ────────────────────────
// Updates the navbar immediately when auth state changes
// (e.g., after Google OAuth redirect, token refresh, etc.)
// Also upserts the profile on SIGNED_IN — critical for Google OAuth users
// who land on the site after OAuth redirect without going through register.js.
function setupAuthStateListener() {
  if (!window.supabaseClient || !window.SupabaseAuth) return;

  SupabaseAuth.onAuthStateChange(async (event, session) => {
    if (event === 'SIGNED_IN' && session?.user) {
      // ── Post-login profile sync ──────────────────────────────────
      // This is the KEY step for Google OAuth users:
      // After the OAuth redirect, Supabase fires SIGNED_IN with the
      // Google user's full metadata (name, avatar_url, email).
      // We sync it to the profiles table — idempotent, no duplicates.
      try {
        await SupabaseAuth.syncProfileFromUser(session.user);
      } catch (e) {
        // Profile sync failure is non-fatal — user is still logged in
        console.warn('[Auth] Post-login profile sync failed:', e.message);
      }

      // Update navbar
      initAuthUI();
    }

    if (event === 'SIGNED_OUT') {
      initAuthUI();
    }

    if (event === 'TOKEN_REFRESHED') {
      // Session token was silently refreshed — no UI update needed
      // unless the navbar hasn't rendered yet
      const userArea = document.getElementById('user-area');
      if (userArea && !userArea.querySelector('.user-dropdown, .login-btn')) {
        initAuthUI();
      }
    }
  });
}

document.addEventListener('DOMContentLoaded', () => {
  initAuthUI();
  setupAuthStateListener();
});

// Expose logout globally so HTML onclick= attributes work
window.logout = logout;