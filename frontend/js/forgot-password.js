// =========================================================
// BEARD BANNA — FORGOT PASSWORD PAGE
// =========================================================

// Password toggle utility (consistent across pages)
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

let lastSubmittedEmail = '';

document.addEventListener('DOMContentLoaded', function () {
  const form = document.getElementById('forgot-form');
  if (!form) return;

  form.addEventListener('submit', async function (e) {
    e.preventDefault();
    await handleForgotSubmit();
  });
});

async function handleForgotSubmit() {
  const emailInput = document.getElementById('forgot-email');
  const submitBtn = document.getElementById('forgot-submit-btn');
  const errorDiv = document.getElementById('forgot-error');

  if (!emailInput) return;

  const email = emailInput.value.trim().toLowerCase();

  // Validate email format
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  if (!email || !emailRegex.test(email)) {
    showAuthError(errorDiv, 'Please enter a valid email address.');
    return;
  }

  // Loading state
  hideAuthError(errorDiv);
  setButtonLoading(submitBtn, 'Sending Reset Link...');

  const result = await SupabaseAuth.sendPasswordReset(email);

  resetButton(submitBtn, 'Send Reset Link');

  if (result.success) {
    lastSubmittedEmail = email;

    // Show success step
    const emailStep = document.getElementById('forgot-step-email');
    const successStep = document.getElementById('forgot-step-success');
    const emailDisplay = document.getElementById('forgot-email-display');

    if (emailStep) emailStep.style.display = 'none';
    if (successStep) successStep.style.display = 'block';
    if (emailDisplay) emailDisplay.textContent = email;

  } else {
    // Even on "user not found", show success to prevent email enumeration
    // (This is a security best practice — don't reveal whether an email exists)
    lastSubmittedEmail = email;

    const emailStep = document.getElementById('forgot-step-email');
    const successStep = document.getElementById('forgot-step-success');
    const emailDisplay = document.getElementById('forgot-email-display');

    if (emailStep) emailStep.style.display = 'none';
    if (successStep) successStep.style.display = 'block';
    if (emailDisplay) emailDisplay.textContent = email;
  }
}

// Resend the reset link
async function resendResetLink() {
  if (!lastSubmittedEmail) return;

  const resendBtn = document.getElementById('resend-btn');
  if (resendBtn) {
    resendBtn.disabled = true;
    resendBtn.textContent = 'Sending...';
  }

  await SupabaseAuth.sendPasswordReset(lastSubmittedEmail);

  if (resendBtn) {
    resendBtn.textContent = '✅ Sent!';
    setTimeout(() => {
      resendBtn.disabled = false;
      resendBtn.textContent = 'Resend Email';
    }, 5000);
  }
}

// ── Utility helpers ──────────────────────────────────────

function showAuthError(el, message) {
  if (!el) return;
  el.textContent = message;
  el.style.display = 'block';
}

function hideAuthError(el) {
  if (!el) return;
  el.style.display = 'none';
  el.textContent = '';
}

function setButtonLoading(btn, text) {
  if (!btn) return;
  btn.disabled = true;
  btn.textContent = text;
}

function resetButton(btn, text) {
  if (!btn) return;
  btn.disabled = false;
  btn.textContent = text;
}

window.resendResetLink = resendResetLink;
