// =========================================================
// BEARD BANNA — REGISTER SYSTEM (SUPABASE POWERED)
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

// Form spam guard timestamp & rate-limiting
let registerFormLoadedAt = Date.now();
let lastRegisterAttempt = 0;

document.addEventListener('DOMContentLoaded', async function () {
  registerFormLoadedAt = Date.now();

  // ── If already logged in, redirect to home ──────────────
  if (window.supabaseClient && window.SupabaseAuth) {
    const { user } = await SupabaseAuth.getSession();
    if (user) {
      window.location.href = 'index.html';
      return;
    }
  }

  const registerForm = document.getElementById('register-form');
  if (!registerForm) return;

  registerForm.addEventListener('submit', async function (e) {
    e.preventDefault();
    await handleRegister();
  });
});

async function handleRegister() {
  const submitBtn = document.querySelector('#register-form button[type="submit"]');
  const errorDiv = document.getElementById('register-error');
  const successDiv = document.getElementById('register-success');

  hideMessage(errorDiv);
  hideMessage(successDiv);

  // ── Honeypot Bot Trap Check ───────────────────────────────
  const honeypot = document.getElementById('register-hp')?.value || '';
  if (honeypot.trim().length > 0) {
    console.warn('[Beard Banna Security] Automated bot registration rejected via honeypot.');
    setLoading(submitBtn, 'Creating Account...');
    setTimeout(() => {
      resetLoading(submitBtn, 'Sign Up');
      showSuccess(successDiv, '🎉 Account created! Please check your email.');
    }, 1200);
    return;
  }

  // ── Form Velocity Protection (Humans take >1.2s to fill) ───
  if (Date.now() - registerFormLoadedAt < 1200) {
    showError(errorDiv, 'Please complete all required fields carefully before submitting.');
    return;
  }

  // ── Client-side Cooldown / Rate Limiting (5s) ─────────────
  const now = Date.now();
  if (now - lastRegisterAttempt < 5000) {
    showError(errorDiv, 'Please wait a moment before trying again.');
    return;
  }
  lastRegisterAttempt = now;

  const name = document.getElementById('register-name')?.value.trim() || '';
  const email = document.getElementById('register-email')?.value.trim().toLowerCase() || '';
  const phone = document.getElementById('register-phone')?.value.trim() || '';
  const password = document.getElementById('register-password')?.value || '';
  const confirmPassword = document.getElementById('confirm-password')?.value || '';

  // ── Length & Format Validation ───────────────────────────
  if (!name || !email || !password) {
    showError(errorDiv, 'Please fill in all required fields.');
    return;
  }

  if (name.length < 2 || name.length > 80) {
    showError(errorDiv, 'Please enter a valid full name (2 to 80 characters).');
    return;
  }

  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  if (!emailRegex.test(email) || email.length > 100) {
    showError(errorDiv, 'Please enter a valid email address (max 100 characters).');
    return;
  }

  if (phone && !/^[+]?[\d\s\-]{6,16}$/.test(phone)) {
    showError(errorDiv, 'Please enter a valid phone number (up to 16 digits).');
    return;
  }

  if (password.length < 6 || password.length > 64) {
    showError(errorDiv, 'Password must be between 6 and 64 characters.');
    return;
  }

  if (password !== confirmPassword) {
    showError(errorDiv, 'Passwords do not match. Please try again.');
    return;
  }

  // ── Loading state ────────────────────────────────────────
  setLoading(submitBtn, 'Creating Account...');

  // ── Check Supabase available ─────────────────────────────
  if (!window.supabaseClient || !window.SupabaseAuth) {
    resetLoading(submitBtn, 'Sign Up');
    showError(errorDiv, 'Authentication service is not configured. Please contact support.');
    return;
  }

  // ── Supabase Sign Up ─────────────────────────────────────
  const result = await SupabaseAuth.signUp(name, email, phone, password);

  resetLoading(submitBtn, 'Sign Up');

  if (!result.success) {
    showError(errorDiv, result.error);
    return;
  }

  // ── Analytics Event Tracking (No sensitive data sent) ─────
  if (typeof window.trackGAEvent === 'function') {
    window.trackGAEvent('sign_up', { method: 'email' });
  }

  // ── Handle Email Confirmation Required ───────────────────
  if (result.needsEmailConfirmation) {
    // Redirect to dedicated Thank You confirmation page
    window.location.href = `thank-you.html?type=account&email=${encodeURIComponent(email)}`;
    return;
  }

  // ── Immediate session (email confirmation disabled) ──────
  if (result.session && result.user) {
    // Bridge legacy API for cart/checkout compatibility
    if (window.API) {
      API.setCurrentUser({
        id: result.user.id,
        name: name,
        email: result.user.email,
        phone: phone || '',
        role: 'customer'
      });
    }

    if (typeof showToast === 'function') {
      showToast(`🎉 Welcome to the Royal Family, ${name}!`);
    }

    setTimeout(() => {
      window.location.href = `thank-you.html?type=account&ref=welcome`;
    }, 800);
    return;
  }

  // ── Fallback ─────────────────────────────────────────────
  window.location.href = `thank-you.html?type=account&email=${encodeURIComponent(email)}`;
}

// ── Utility helpers ───────────────────────────────────────

function showError(el, message) {
  if (!el) {
    if (typeof showToast === 'function') showToast(message);
    else alert(message);
    return;
  }
  el.innerHTML = message;
  el.style.display = 'block';
}

function showSuccess(el, message) {
  if (!el) {
    if (typeof showToast === 'function') showToast(message);
    return;
  }
  el.innerHTML = message;
  el.style.display = 'block';
}

function hideMessage(el) {
  if (!el) return;
  el.style.display = 'none';
  el.innerHTML = '';
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