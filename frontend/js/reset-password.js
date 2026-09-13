// =========================================================
// BEARD BANNA — RESET PASSWORD PAGE
// Handles Supabase password-recovery redirect flow.
// Supabase appends tokens to the URL hash after the user
// clicks the reset link in their email.
// =========================================================

// Password toggle utility
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

// ── UI State helpers ─────────────────────────────────────

function showState(stateId) {
  const states = ['reset-loading', 'reset-invalid', 'reset-form-container', 'reset-success'];
  states.forEach(id => {
    const el = document.getElementById(id);
    if (el) el.style.display = id === stateId ? 'block' : 'none';
  });
}

function showResetError(message) {
  const el = document.getElementById('reset-error');
  if (el) {
    el.textContent = message;
    el.style.display = 'block';
  }
}

function hideResetError() {
  const el = document.getElementById('reset-error');
  if (el) {
    el.style.display = 'none';
    el.textContent = '';
  }
}

// ── Main Logic ────────────────────────────────────────────

document.addEventListener('DOMContentLoaded', function () {
  // Show loading while Supabase processes the URL hash tokens
  showState('reset-loading');
  initResetPage();
});

async function initResetPage() {
  if (!window.supabaseClient) {
    showState('reset-invalid');
    return;
  }

  // Supabase handles the token in the URL hash automatically when
  // detectSessionInUrl: true is set (which we do in supabase-client.js).
  // We listen for the PASSWORD_RECOVERY event to know a valid reset token was found.

  let sessionHandled = false;

  // Listen for auth state — Supabase fires PASSWORD_RECOVERY when it detects
  // a valid recovery token in the URL hash
  const unsubscribe = SupabaseAuth.onAuthStateChange(async (event, session) => {
    if (sessionHandled) return;

    if (event === 'PASSWORD_RECOVERY') {
      sessionHandled = true;
      unsubscribe();
      showState('reset-form-container');
      setupResetForm();

    } else if (event === 'SIGNED_IN' && session) {
      // User somehow landed here while already signed in — check if they came from reset link
      const hashParams = new URLSearchParams(window.location.hash.substring(1));
      const type = hashParams.get('type');
      if (type === 'recovery') {
        sessionHandled = true;
        unsubscribe();
        showState('reset-form-container');
        setupResetForm();
      } else {
        // Already logged in, not a reset — redirect home
        window.location.href = 'index.html';
      }
    }
  });

  // Timeout fallback — if no auth event fires in 4s, the link is invalid/expired
  setTimeout(() => {
    if (!sessionHandled) {
      unsubscribe();
      showState('reset-invalid');
    }
  }, 4000);
}

function setupResetForm() {
  const form = document.getElementById('reset-form');
  if (!form) return;

  form.addEventListener('submit', async function (e) {
    e.preventDefault();
    await handleResetSubmit();
  });
}

async function handleResetSubmit() {
  const passwordInput = document.getElementById('reset-password');
  const confirmInput = document.getElementById('reset-confirm-password');
  const submitBtn = document.getElementById('reset-submit-btn');

  hideResetError();

  const password = passwordInput ? passwordInput.value : '';
  const confirmPassword = confirmInput ? confirmInput.value : '';

  // Validation
  if (!password) {
    showResetError('Please enter a new password.');
    return;
  }

  if (password.length < 6) {
    showResetError('Password must be at least 6 characters long.');
    return;
  }

  if (password !== confirmPassword) {
    showResetError('Passwords do not match. Please try again.');
    return;
  }

  // Loading state
  if (submitBtn) {
    submitBtn.disabled = true;
    submitBtn.textContent = 'Updating Password...';
  }

  const result = await SupabaseAuth.updatePassword(password);

  if (result.success) {
    // Show success state
    showState('reset-success');

    // Sign out so the user does a clean login with the new password
    await SupabaseAuth.signOut();

    // Redirect to login after 3 seconds
    setTimeout(() => {
      window.location.href = 'login.html';
    }, 3000);

  } else {
    if (submitBtn) {
      submitBtn.disabled = false;
      submitBtn.textContent = 'Update Password';
    }
    showResetError(result.error || 'Failed to update password. Please request a new reset link.');
  }
}
