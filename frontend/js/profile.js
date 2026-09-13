// ===============================
// PROFILE PAGE — SUPABASE POWERED
// ===============================

async function loadProfile() {
  if (!window.supabaseClient || !window.SupabaseAuth) {
    // Supabase not configured — redirect to login
    window.location.href = 'login.html';
    return;
  }

  const { user } = await SupabaseAuth.getSession();

  if (!user) {
    // Not authenticated — redirect to login
    window.location.href = 'login.html';
    return;
  }

  // ── Fetch profile from Supabase profiles table ───────────
  const { profile } = await SupabaseAuth.getProfile(user.id);

  // Fill form fields
  const nameInput = document.getElementById('profile-name');
  const emailInput = document.getElementById('profile-email');
  const phoneInput = document.getElementById('profile-phone');
  const joinedEl = document.getElementById('profile-joined');
  const avatarInitials = document.getElementById('profile-avatar-initials');

  const displayName = profile?.full_name
    || user.user_metadata?.full_name
    || user.email?.split('@')[0]
    || '';

  const displayEmail = profile?.email || user.email || '';
  const displayPhone = profile?.phone || user.user_metadata?.phone || '';

  if (nameInput) nameInput.value = displayName;
  if (emailInput) {
    emailInput.value = displayEmail;
    emailInput.readOnly = true; // Email cannot be changed here — use Supabase Auth
    emailInput.style.opacity = '0.65';
    emailInput.style.cursor = 'not-allowed';
    emailInput.title = 'Email cannot be changed from this page.';
  }
  if (phoneInput) phoneInput.value = displayPhone;

  // Show account creation date
  if (joinedEl) {
    const createdDate = user.created_at
      ? new Date(user.created_at).toLocaleDateString('en-IN', {
          year: 'numeric', month: 'long', day: 'numeric'
        })
      : 'N/A';
    joinedEl.textContent = createdDate;
  }

  // Show avatar initials
  if (avatarInitials) {
    const initials = displayName
      .split(' ')
      .map(w => w[0])
      .slice(0, 2)
      .join('')
      .toUpperCase();
    avatarInitials.textContent = initials || '👤';
  }

  // Keep legacy API in sync for cart/checkout compatibility
  if (window.API) {
    API.setCurrentUser({
      id: user.id,
      name: displayName,
      email: displayEmail,
      phone: displayPhone,
      role: 'customer'
    });
  }
}

// ── Profile Update Form ───────────────────────────────────
document.addEventListener('DOMContentLoaded', async function () {
  await loadProfile();

  const profileForm = document.getElementById('profile-form');
  if (!profileForm) return;

  profileForm.addEventListener('submit', async function (e) {
    e.preventDefault();
    await handleProfileSave();
  });

  // ── Password Change Section ──────────────────────────────
  const changePasswordForm = document.getElementById('change-password-form');
  if (changePasswordForm) {
    changePasswordForm.addEventListener('submit', async function (e) {
      e.preventDefault();
      await handlePasswordChange();
    });
  }
});

async function handleProfileSave() {
  const name = document.getElementById('profile-name')?.value.trim() || '';
  const phone = document.getElementById('profile-phone')?.value.trim() || '';
  const submitBtn = document.querySelector('#profile-form button[type="submit"]');
  const errorDiv = document.getElementById('profile-error');
  const successDiv = document.getElementById('profile-success');

  hideMessage(errorDiv);
  hideMessage(successDiv);

  // Validation
  if (name.length < 2) {
    showMessage(errorDiv, 'Name must be at least 2 characters long.', 'error');
    return;
  }

  if (phone && !/^[+]?[\d\s\-]{6,15}$/.test(phone)) {
    showMessage(errorDiv, 'Please enter a valid phone number.', 'error');
    return;
  }

  if (submitBtn) {
    submitBtn.disabled = true;
    submitBtn.textContent = 'Saving...';
  }

  const { user } = await SupabaseAuth.getSession();
  if (!user) {
    window.location.href = 'login.html';
    return;
  }

  const result = await SupabaseAuth.updateProfile(user.id, {
    full_name: name,
    phone: phone
  });

  if (submitBtn) {
    submitBtn.disabled = false;
    submitBtn.textContent = 'Save Changes';
  }

  if (result.success) {
    // Update legacy API for compatibility
    if (window.API) {
      const current = API.getCurrentUser() || {};
      API.setCurrentUser({ ...current, name, phone });
    }

    // Update navbar display name
    const userToggle = document.getElementById('user-toggle');
    if (userToggle) {
      const displayName = name.charAt(0).toUpperCase() + name.slice(1);
      userToggle.innerHTML = `👤 ${displayName} ▼`;
    }

    // Update avatar initials
    const avatarInitials = document.getElementById('profile-avatar-initials');
    if (avatarInitials) {
      const initials = name.split(' ').map(w => w[0]).slice(0, 2).join('').toUpperCase();
      avatarInitials.textContent = initials || '👤';
    }

    showMessage(successDiv, '✅ Profile updated successfully!', 'success');
    if (typeof showToast === 'function') showToast('✅ Profile Updated!');

  } else {
    showMessage(errorDiv, result.error || 'Failed to update profile. Please try again.', 'error');
  }
}

async function handlePasswordChange() {
  const newPassword = document.getElementById('new-password')?.value || '';
  const confirmNew = document.getElementById('confirm-new-password')?.value || '';
  const submitBtn = document.querySelector('#change-password-form button[type="submit"]');
  const errorDiv = document.getElementById('password-error');
  const successDiv = document.getElementById('password-success');

  hideMessage(errorDiv);
  hideMessage(successDiv);

  if (!newPassword) {
    showMessage(errorDiv, 'Please enter a new password.', 'error');
    return;
  }
  if (newPassword.length < 6) {
    showMessage(errorDiv, 'Password must be at least 6 characters long.', 'error');
    return;
  }
  if (newPassword !== confirmNew) {
    showMessage(errorDiv, 'Passwords do not match.', 'error');
    return;
  }

  if (submitBtn) {
    submitBtn.disabled = true;
    submitBtn.textContent = 'Updating Password...';
  }

  const result = await SupabaseAuth.updatePassword(newPassword);

  if (submitBtn) {
    submitBtn.disabled = false;
    submitBtn.textContent = 'Update Password';
  }

  if (result.success) {
    showMessage(successDiv, '✅ Password changed successfully!', 'success');
    const form = document.getElementById('change-password-form');
    if (form) form.reset();
  } else {
    showMessage(errorDiv, result.error || 'Failed to update password.', 'error');
  }
}

// ── Utility helpers ───────────────────────────────────────

function showMessage(el, message, type = 'error') {
  if (!el) return;
  el.innerHTML = message;
  el.style.display = 'block';
  el.className = type === 'success' ? 'auth-success' : 'auth-error';
}

function hideMessage(el) {
  if (!el) return;
  el.style.display = 'none';
  el.innerHTML = '';
}

// Password toggle for profile page
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