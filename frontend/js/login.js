// =========================================================
// BEARD BANNA — LOGIN SYSTEM (SUPABASE POWERED)
// Supports: Email/Password, Magic Link, Google, GitHub
// =========================================================

// --- PASSWORD EYE TOGGLE ---
window.togglePasswordVisibility = function (inputId, btn) {
  const input = document.getElementById(inputId);
  if (!input) return;
  if (input.type === 'password') {
    input.type = 'text';
    if (btn) btn.innerText = '🙈';
  } else {
    input.type = 'password';
    if (btn) btn.innerText = '👁️';
  }
};

// --- TAB SWITCHER ---
window.switchTab = function (tab) {
  document.querySelectorAll('.auth-tab').forEach(t => t.classList.remove('active'));
  document.querySelectorAll('.tab-panel').forEach(p => p.classList.remove('active'));
  document.getElementById('tab-' + tab)?.classList.add('active');
  document.getElementById('panel-' + tab)?.classList.add('active');
  clearMessages();
};

// ── DOMContentLoaded ──────────────────────────────────────
document.addEventListener('DOMContentLoaded', async function () {

  // If already logged in → redirect to home
  if (window.supabaseClient && window.SupabaseAuth) {
    const { user } = await SupabaseAuth.getSession();
    if (user) {
      window.location.href = 'index.html';
      return;
    }
  }

  // Restore remembered email
  const rememberedEmail = localStorage.getItem('bb_remembered_email');
  const emailInput = document.getElementById('login-email');
  const rememberCheckbox = document.getElementById('remember-me');
  if (rememberedEmail && emailInput) {
    emailInput.value = rememberedEmail;
    if (rememberCheckbox) rememberCheckbox.checked = true;
  }

  // ── Form: Password login ──────────────────────────────────
  document.getElementById('login-form')?.addEventListener('submit', async (e) => {
    e.preventDefault();
    await handlePasswordLogin();
  });

  // ── Google buttons (both tabs) ────────────────────────────
  document.getElementById('google-signin-btn')?.addEventListener('click', () => handleOAuth('google'));
  document.getElementById('google-social-btn')?.addEventListener('click', () => handleOAuth('google'));

  // ── GitHub buttons (both tabs) ────────────────────────────
  document.getElementById('github-signin-btn')?.addEventListener('click', () => handleOAuth('github'));
  document.getElementById('github-social-btn')?.addEventListener('click', () => handleOAuth('github'));

  // ── Magic link ────────────────────────────────────────────
  document.getElementById('magic-link-btn')?.addEventListener('click', handleMagicLink);
  document.getElementById('magic-resend-btn')?.addEventListener('click', handleMagicResend);
});

// ── PASSWORD LOGIN ────────────────────────────────────────
async function handlePasswordLogin() {
  const email = document.getElementById('login-email')?.value.trim().toLowerCase() || '';
  const password = document.getElementById('login-password')?.value || '';
  const rememberCheckbox = document.getElementById('remember-me');
  const submitBtn = document.getElementById('login-submit-btn');

  clearMessages();

  if (!email || !password) {
    showError('Please fill in your email and password.');
    return;
  }
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    showError('Please enter a valid email address.');
    return;
  }

  // Handle remember me
  if (rememberCheckbox?.checked) {
    localStorage.setItem('bb_remembered_email', email);
  } else {
    localStorage.removeItem('bb_remembered_email');
  }

  setLoading(submitBtn, '⏳ Signing In...');

  if (!window.supabaseClient || !window.SupabaseAuth) {
    resetLoading(submitBtn, 'Sign In');
    showError('Authentication service is not available. Please try again later.');
    return;
  }

  const result = await SupabaseAuth.signIn(email, password);

  resetLoading(submitBtn, 'Sign In');

  if (result.success) {
    if (result.user && window.API) {
      const displayName = result.user.user_metadata?.full_name || email.split('@')[0];
      API.setCurrentUser({
        id: result.user.id,
        name: displayName,
        email: result.user.email,
        phone: result.user.user_metadata?.phone || '',
        role: 'customer'
      });
    }
    if (typeof showToast === 'function') {
      const name = result.user?.user_metadata?.full_name || 'Royal Member';
      showToast(`👑 Welcome back, ${name}!`);
    }
    setTimeout(() => { window.location.href = 'index.html'; }, 800);
  } else {
    handleAuthError(result.error, email);
  }
}

// ── OAUTH (Google / GitHub) ──────────────────────────────
// CONFIGURED PROVIDERS — set to true once enabled in Supabase dashboard
const OAUTH_ENABLED = {
  google: true,    // ✅ Enabled — Google Cloud project: beard-banna-store-507310
  github: false,   // ← set to true after enabling GitHub in Supabase → Auth → Providers
};

// Prevent double-click / concurrent OAuth attempts
let _oauthInProgress = false;

async function handleOAuth(provider) {
  clearMessages();

  // Prevent multiple simultaneous requests
  if (_oauthInProgress) return;

  const providerLabel = provider === 'google' ? 'Google' : 'GitHub';

  // Show friendly message if provider not configured yet
  if (!OAUTH_ENABLED[provider]) {
    showInfo(
      `⚙️ <strong>${providerLabel} sign-in</strong> is not configured yet.<br>
       Please use <strong>email &amp; password</strong> or <strong>✨ Magic Link</strong> tab to sign in for now.<br>
       <small style="color:#64748b; margin-top:4px; display:block;">
         To enable ${providerLabel} login: Supabase Dashboard → Authentication → Providers → ${providerLabel}
       </small>`
    );
    switchTab('password');
    return;
  }

  if (!window.supabaseClient || !window.SupabaseAuth) {
    showError('Authentication service is not available. Please try again later.');
    return;
  }

  // Guard: OAuth requires HTTP/S — file:// will fail
  if (!SupabaseAuth.buildRedirectUrl) {
    showError('Google sign-in requires an HTTP server. Please use a local server (e.g. Live Server).');
    return;
  }
  const redirectTo = SupabaseAuth.buildRedirectUrl('/index.html')
    || `${window.location.origin}/index.html`;
  if (!redirectTo) {
    showError(
      'Google sign-in requires an HTTP server. ' +
      'Please open this page via <strong>http://localhost</strong> instead of opening the file directly. ' +
      'Use the <strong>Live Server</strong> extension or any local HTTP server.'
    );
    return;
  }

  _oauthInProgress = true;

  const googleBtnIds = ['google-signin-btn', 'google-social-btn'];
  const githubBtnIds = ['github-signin-btn', 'github-social-btn'];
  const allBtnIds = [...googleBtnIds, ...githubBtnIds];

  // Disable all OAuth buttons to prevent double-click
  allBtnIds.forEach(id => {
    const btn = document.getElementById(id);
    if (btn) btn.disabled = true;
  });

  // Update text on the clicked provider's buttons
  const activeBtnIds = provider === 'google' ? googleBtnIds : githubBtnIds;
  activeBtnIds.forEach(id => {
    const btn = document.getElementById(id);
    if (btn) btn.innerHTML = `<span class="btn-icon">⏳</span> Connecting to ${providerLabel}...`;
  });

  try {
    const { error } = await window.supabaseClient.auth.signInWithOAuth({
      provider,
      options: {
        redirectTo,
        queryParams: provider === 'google' ? { access_type: 'offline', prompt: 'consent' } : {}
      }
    });

    if (error) throw error;
    // Successful — browser is redirecting. Keep buttons disabled.

  } catch (err) {
    // Reset state on error
    _oauthInProgress = false;
    allBtnIds.forEach(id => {
      const btn = document.getElementById(id);
      if (btn) btn.disabled = false;
    });
    // Restore button labels
    googleBtnIds.forEach(id => {
      const btn = document.getElementById(id);
      if (btn) btn.innerHTML = '<span class="btn-icon"><span class="google-logo">G</span></span> Continue with Google';
    });
    githubBtnIds.forEach(id => {
      const btn = document.getElementById(id);
      if (btn) btn.innerHTML = '<span class="btn-icon">🐱</span> Continue with GitHub';
    });

    const errMsg = (err.message || '').toLowerCase();
    if (errMsg.includes('provider') && errMsg.includes('not enabled')) {
      showError(
        `<strong>${providerLabel} sign-in is not enabled yet.</strong><br>
         Please enable it in: Supabase Dashboard → Authentication → Providers → ${providerLabel}.<br>
         For now, use <strong>email & password</strong> or <strong>✨ Magic Link</strong>.`
      );
    } else {
      showError(`${providerLabel} sign-in failed. Please use email/password or Magic Link instead.`);
    }
    switchTab('password');
  }
}

// ── MAGIC LINK ────────────────────────────────────────────
let lastMagicEmail = '';

async function handleMagicLink() {
  const email = document.getElementById('magic-email')?.value.trim().toLowerCase() || '';
  const btn = document.getElementById('magic-link-btn');
  clearMessages();

  if (!email) {
    showError('Please enter your email address.');
    return;
  }
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    showError('Please enter a valid email address.');
    return;
  }

  if (!window.supabaseClient || !window.SupabaseAuth) {
    showError('Authentication service is not available. Please try again later.');
    return;
  }

  setLoading(btn, '⏳ Sending link...');

  try {
    // Use buildRedirectUrl for consistent URL handling
    const redirectTo = SupabaseAuth.buildRedirectUrl('/frontend/index.html')
      || `${window.location.origin}/frontend/index.html`;

    const { error } = await window.supabaseClient.auth.signInWithOtp({
      email,
      options: { emailRedirectTo: redirectTo, shouldCreateUser: true }
    });

    resetLoading(btn, '✉️ Send Magic Link');

    if (error) throw error;

    // Show sent panel
    lastMagicEmail = email;
    document.getElementById('magic-form-area').style.display = 'none';
    const sentPanel = document.getElementById('magic-sent-panel');
    document.getElementById('magic-sent-email').textContent = email;
    sentPanel.style.display = 'block';

  } catch (err) {
    resetLoading(btn, '✉️ Send Magic Link');
    const msg = err.message?.toLowerCase() || '';
    if (msg.includes('rate limit') || msg.includes('too many')) {
      showError('Too many requests. Please wait a minute before trying again.');
    } else if (msg.includes('invalid email')) {
      showError('Please enter a valid email address.');
    } else {
      showError('Could not send magic link. Please try password login instead.');
    }
  }
}

async function handleMagicResend() {
  if (!lastMagicEmail) return;
  document.getElementById('magic-form-area').style.display = 'block';
  document.getElementById('magic-sent-panel').style.display = 'none';
  document.getElementById('magic-email').value = lastMagicEmail;
  await handleMagicLink();
}

// ── ERROR HANDLER ─────────────────────────────────────────
function handleAuthError(errorMessage, email) {
  const msg = (errorMessage || '').toLowerCase();

  if (msg.includes('email not confirmed') || msg.includes('verify your email')) {
    // Show friendly message with resend option
    showInfo(
      `📧 Your email <strong>${email}</strong> is not verified yet.<br>
       Check your inbox (and spam) for the verification email.<br>
       <button class="info-action" onclick="resendVerificationEmail('${email}')">Resend verification email →</button>`
    );
  } else if (msg.includes('invalid') || msg.includes('incorrect') || msg.includes('wrong')) {
    showError('Incorrect email or password. Please try again or use <a href="forgot-password.html" style="color:#fbbf24;">Forgot Password</a>.');
  } else if (msg.includes('too many') || msg.includes('rate limit')) {
    showError('Too many failed attempts. Please wait a few minutes and try again.');
  } else if (msg.includes('network') || msg.includes('fetch') || msg.includes('timeout')) {
    showError('Network error — please check your internet connection and try again.');
  } else if (msg.includes('user not found') || msg.includes('no user')) {
    showError('No account found with this email. <a href="register.html" style="color:#fbbf24;">Create an account →</a>');
  } else {
    showError(errorMessage || 'Something went wrong. Please try again.');
  }
}

// ── RESEND VERIFICATION EMAIL ─────────────────────────────
window.resendVerificationEmail = async function (email) {
  if (!window.supabaseClient) return;
  try {
    const redirectTo = SupabaseAuth.buildRedirectUrl('/frontend/index.html')
      || `${window.location.origin}/frontend/index.html`;
    const { error } = await window.supabaseClient.auth.resend({
      type: 'signup',
      email,
      options: { emailRedirectTo: redirectTo }
    });
    if (error) throw error;
    showInfo(`✅ Verification email resent to <strong>${email}</strong>. Check your inbox!`);
  } catch (err) {
    showError('Could not resend email. Please try again in a moment.');
  }
};

// ── UI HELPERS ────────────────────────────────────────────
function showError(message) {
  const el = document.getElementById('login-error');
  const info = document.getElementById('login-info');
  if (info) info.style.display = 'none';
  if (!el) return;
  el.innerHTML = message;
  el.style.display = 'block';
  el.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
}

function showInfo(message) {
  const el = document.getElementById('login-info');
  const err = document.getElementById('login-error');
  if (err) err.style.display = 'none';
  if (!el) return;
  el.innerHTML = message;
  el.style.display = 'block';
  el.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
}

function clearMessages() {
  const err = document.getElementById('login-error');
  const info = document.getElementById('login-info');
  if (err) { err.style.display = 'none'; err.innerHTML = ''; }
  if (info) { info.style.display = 'none'; info.innerHTML = ''; }
}

function setLoading(btn, text) {
  if (!btn) return;
  btn.disabled = true;
  btn.textContent = text;
}

function resetLoading(btn, text) {
  if (!btn) return;
  btn.disabled = false;
  btn.textContent = text;
}