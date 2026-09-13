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

document.addEventListener('DOMContentLoaded', async function () {

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
  const name = document.getElementById('register-name')?.value.trim() || '';
  const email = document.getElementById('register-email')?.value.trim().toLowerCase() || '';
  const phone = document.getElementById('register-phone')?.value.trim() || '';
  const password = document.getElementById('register-password')?.value || '';
  const confirmPassword = document.getElementById('confirm-password')?.value || '';

  const submitBtn = document.querySelector('#register-form button[type="submit"]');
  const errorDiv = document.getElementById('register-error');
  const successDiv = document.getElementById('register-success');

  hideMessage(errorDiv);
  hideMessage(successDiv);

  // ── Client-side validation ───────────────────────────────

  if (!name || !email || !password) {
    showError(errorDiv, 'Please fill in all required fields.');
    return;
  }

  if (name.trim().length < 2) {
    showError(errorDiv, 'Please enter your full name (at least 2 characters).');
    return;
  }

  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  if (!emailRegex.test(email)) {
    showError(errorDiv, 'Please enter a valid email address.');
    return;
  }

  if (phone && !/^[+]?[\d\s\-]{6,15}$/.test(phone)) {
    showError(errorDiv, 'Please enter a valid phone number.');
    return;
  }

  if (password.length < 6) {
    showError(errorDiv, 'Please choose a stronger password (minimum 6 characters).');
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

  // ── Handle Email Confirmation Required ───────────────────
  if (result.needsEmailConfirmation) {
    showSuccess(successDiv,
      `🎉 Account created! We've sent a verification email to <strong>${email}</strong>.<br>
       Please check your inbox (and spam folder) and click the verification link before signing in.`
    );
    // Clear form
    const form = document.getElementById('register-form');
    if (form) form.reset();
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
      window.location.href = 'index.html';
    }, 1000);
    return;
  }

  // ── Fallback: show success message ───────────────────────
  showSuccess(successDiv,
    `🎉 Account created! Please check your email at <strong>${email}</strong> to verify your account.`
  );
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