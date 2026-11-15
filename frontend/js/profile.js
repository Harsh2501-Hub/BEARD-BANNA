// =========================================================
// BEARD BANNA — EXPANDED CUSTOMER ACCOUNT & PROFILE HUB
// Full Suite: Profile, Orders History, Saved Address, Wishlist, Security
// Primary Engine: Supabase Auth & Relational DB
// =========================================================

let activeProfileUser = null;

// --- TAB SWITCHER ---
window.switchProfileTab = function (tabName) {
  document.querySelectorAll('.profile-tab').forEach(t => {
    t.classList.remove('active');
    t.setAttribute('aria-selected', 'false');
  });
  document.querySelectorAll('.profile-panel').forEach(p => p.classList.remove('active'));

  const tabBtn = document.getElementById('tab-' + tabName);
  const panel = document.getElementById('panel-' + tabName);

  if (tabBtn) {
    tabBtn.classList.add('active');
    tabBtn.setAttribute('aria-selected', 'true');
  }
  if (panel) {
    panel.classList.add('active');
  }
};

// ── INITIALIZE PROFILE ─────────────────────────────────────
async function loadProfile() {
  if (!window.supabaseClient || !window.SupabaseAuth) {
    window.location.href = 'login.html';
    return;
  }

  const { user } = await SupabaseAuth.getSession();

  if (!user) {
    window.location.href = 'login.html?redirect=profile.html';
    return;
  }

  activeProfileUser = user;

  // Fetch profile from Supabase profiles table
  const { profile } = await SupabaseAuth.getProfile(user.id);

  const nameInput = document.getElementById('profile-name');
  const emailInput = document.getElementById('profile-email');
  const phoneInput = document.getElementById('profile-phone');
  const joinedEl = document.getElementById('profile-joined');
  const avatarInitials = document.getElementById('profile-avatar-initials');
  const headingEl = document.getElementById('profile-display-heading');

  const displayName = profile?.full_name
    || user.user_metadata?.full_name
    || user.email?.split('@')[0]
    || 'Royal Member';

  const displayEmail = profile?.email || user.email || '';
  const displayPhone = profile?.phone || user.user_metadata?.phone || '';

  if (nameInput) nameInput.value = displayName;
  if (headingEl) headingEl.textContent = displayName;

  if (emailInput) {
    emailInput.value = displayEmail;
    emailInput.readOnly = true;
    emailInput.style.opacity = '0.65';
    emailInput.style.cursor = 'not-allowed';
    emailInput.title = 'Email cannot be changed directly from this form.';
  }

  if (phoneInput) phoneInput.value = displayPhone;

  // Joined date
  if (joinedEl) {
    const createdDate = user.created_at
      ? new Date(user.created_at).toLocaleDateString('en-IN', {
          year: 'numeric', month: 'long', day: 'numeric'
        })
      : 'November 2026';
    joinedEl.textContent = createdDate;
  }

  // Initials
  if (avatarInitials) {
    const initials = displayName
      .split(' ')
      .map(w => w[0])
      .slice(0, 2)
      .join('')
      .toUpperCase();
    avatarInitials.textContent = initials || '👤';
  }

  // Sync legacy API
  if (window.API) {
    API.setCurrentUser({
      id: user.id,
      name: displayName,
      email: displayEmail,
      phone: displayPhone,
      role: 'customer'
    });
  }

  // Load secondary tabs
  await Promise.all([
    loadUserOrders(user.id, displayEmail),
    loadDefaultAddress(user.id),
    loadWishlistPreview()
  ]);
}

// ── TAB 2: LOAD ORDERS HISTORY ─────────────────────────────
async function loadUserOrders(userId, userEmail) {
  const container = document.getElementById('profile-orders-list');
  const countEl = document.getElementById('profile-orders-count');
  if (!container) return;

  let orders = [];

  // 1. Try Supabase
  if (window.supabaseClient) {
    try {
      const { data, error } = await window.supabaseClient
        .from('orders')
        .select('*, order_items(*)')
        .or(`user_id.eq.${userId},customer_email.eq.${userEmail.toLowerCase()}`)
        .order('created_at', { ascending: false });

      if (!error && Array.isArray(data)) {
        orders = data;
      }
    } catch (e) {
      console.warn('[Profile Orders] Supabase error:', e.message);
    }
  }

  // 2. Fallback to localStorage orders
  if (orders.length === 0) {
    try {
      const localOrders = JSON.parse(localStorage.getItem('orders') || '[]');
      orders = localOrders.filter(o =>
        (o.customerEmail && o.customerEmail.toLowerCase() === userEmail.toLowerCase()) ||
        (o.email && o.email.toLowerCase() === userEmail.toLowerCase())
      );
    } catch (e) {}
  }

  if (countEl) countEl.textContent = orders.length;

  if (orders.length === 0) {
    container.innerHTML = `
      <div style="text-align:center; padding:50px 20px; background:rgba(15, 23, 42, 0.6); border:1px solid rgba(212, 175, 55, 0.2); border-radius:10px;">
        <span style="font-size:2.4rem; display:block; margin-bottom:12px;">⚜️</span>
        <h3 style="font-family:'Cinzel', serif; color:#fbbf24; margin-bottom:8px;">No Royal Orders Placed Yet</h3>
        <p style="color:#cbd5e1; max-width:440px; margin:0 auto 20px auto; font-size:0.92rem;">
          Your order archive is currently empty. Explore our Rajputana apparel collection to script your heritage style.
        </p>
        <a href="collection.html" class="checkout-btn" style="display:inline-block; padding:10px 24px; text-decoration:none;">
          Browse Heritage Collection →
        </a>
      </div>
    `;
    return;
  }

  container.innerHTML = orders.map(order => {
    const orderNum = order.order_number || order.orderId || order.id || 'N/A';
    const status = (order.order_status || order.status || 'Processing').toLowerCase();
    const dateStr = order.created_at || order.orderDate || order.date
      ? new Date(order.created_at || order.orderDate || order.date).toLocaleDateString('en-IN', {
          day: 'numeric', month: 'short', year: 'numeric'
        })
      : 'Recent';

    const items = order.order_items || order.items || [];
    const totalAmount = order.total || order.grandTotal || 0;

    let pillClass = 'processing';
    if (status.includes('ship')) pillClass = 'shipped';
    else if (status.includes('deliv')) pillClass = 'delivered';
    else if (status.includes('cancel')) pillClass = 'cancelled';

    return `
      <div class="order-card-item">
        <div style="display:flex; justify-content:space-between; align-items:flex-start; flex-wrap:wrap; gap:10px; margin-bottom:12px; border-bottom:1px solid rgba(212,175,55,0.15); padding-bottom:10px;">
          <div>
            <span style="font-family:'Cinzel', serif; font-size:1.05rem; color:#fbbf24; font-weight:700;">Order #${escapeHtml(orderNum)}</span>
            <div style="font-size:0.82rem; color:#94a3b8; margin-top:2px;">Placed on: ${escapeHtml(dateStr)}</div>
          </div>
          <div style="display:flex; align-items:center; gap:8px;">
            <span class="status-pill ${pillClass}">● ${escapeHtml((order.order_status || order.status || 'Processing').toUpperCase())}</span>
          </div>
        </div>

        <div style="margin-bottom:14px;">
          ${items.map(item => `
            <div style="display:flex; justify-content:space-between; font-size:0.9rem; color:#e2e8f0; margin-bottom:6px;">
              <span>• ${escapeHtml(item.name || item.title || 'Apparel Piece')} (Size: <strong>${escapeHtml(item.size || 'M')}</strong>) × ${Number(item.quantity || item.qty || 1)}</span>
              <span style="color:#fbbf24; font-weight:600;">₹${Number(item.price || 0)}</span>
            </div>
          `).join('')}
        </div>

        <div style="display:flex; justify-content:space-between; align-items:center; flex-wrap:wrap; gap:10px; border-top:1px dashed rgba(212,175,55,0.2); padding-top:10px;">
          <div style="font-size:0.92rem; color:#cbd5e1;">
            Grand Total: <strong style="color:#fbbf24; font-size:1.1rem;">₹${totalAmount}</strong>
            <span style="font-size:0.8rem; color:#94a3b8; margin-left:6px;">(${order.payment_method || order.payment || 'COD'})</span>
          </div>
          <a href="track-order.html?orderId=${encodeURIComponent(orderNum)}" class="checkout-btn" style="padding:6px 14px; font-size:0.82rem; text-decoration:none; display:inline-flex; align-items:center; gap:4px;">
            Live Timeline ↗
          </a>
        </div>
      </div>
    `;
  }).join('');
}

// ── TAB 3: DEFAULT SHIPPING ADDRESS MANAGER ────────────────
async function loadDefaultAddress(userId) {
  let saved = null;
  try {
    saved = JSON.parse(localStorage.getItem('bb_saved_shipping_address') || 'null');
  } catch (e) {}

  if (saved) {
    const addressInput = document.getElementById('saved-address');
    const cityInput = document.getElementById('saved-city');
    const pincodeInput = document.getElementById('saved-pincode');
    const stateInput = document.getElementById('saved-state');

    if (addressInput && saved.address) addressInput.value = saved.address;
    if (cityInput && saved.city) cityInput.value = saved.city;
    if (pincodeInput && saved.pincode) pincodeInput.value = saved.pincode;
    if (stateInput && saved.state) stateInput.value = saved.state;
  }
}

window.saveDefaultAddress = function (e) {
  if (e) e.preventDefault();

  const address = document.getElementById('saved-address')?.value.trim();
  const city = document.getElementById('saved-city')?.value.trim();
  const pincode = document.getElementById('saved-pincode')?.value.trim();
  const state = document.getElementById('saved-state')?.value;
  const statusEl = document.getElementById('address-status');

  if (!address || !city || !pincode || !state) {
    alert('Please fill in all address fields.');
    return;
  }

  if (!/^\d{6}$/.test(pincode)) {
    alert('Please enter a valid 6-digit Indian PIN code.');
    return;
  }

  const payload = { address, city, pincode, state };
  localStorage.setItem('bb_saved_shipping_address', JSON.stringify(payload));

  if (statusEl) {
    statusEl.textContent = '✅ Default delivery address saved successfully!';
    statusEl.style.display = 'block';
    setTimeout(() => { statusEl.style.display = 'none'; }, 4000);
  }

  if (typeof showToast === 'function') {
    showToast('✅ Shipping Address Saved!');
  }
};

// ── TAB 4: WISHLIST PREVIEW ────────────────────────────────
function loadWishlistPreview() {
  const container = document.getElementById('profile-wishlist-list');
  const countEl = document.getElementById('profile-wishlist-count');
  if (!container) return;

  const wishlist = JSON.parse(localStorage.getItem('wishlist') || '[]');
  if (countEl) countEl.textContent = wishlist.length;

  if (wishlist.length === 0) {
    container.innerHTML = `
      <div style="width:100%; text-align:center; padding:40px 20px; background:rgba(15, 23, 42, 0.6); border:1px solid rgba(212, 175, 55, 0.2); border-radius:10px;">
        <span style="font-size:2rem; display:block; margin-bottom:8px;">❤️</span>
        <p style="color:#cbd5e1; margin:0 0 14px 0; font-size:0.92rem;">Your royal wishlist has no items yet.</p>
        <a href="collection.html" class="checkout-btn" style="padding:8px 18px; font-size:0.85rem; text-decoration:none;">Discover Items</a>
      </div>
    `;
    return;
  }

  container.innerHTML = wishlist.slice(0, 4).map(item => `
    <div style="background:rgba(15, 23, 42, 0.85); border:1px solid rgba(212,175,55,0.22); border-radius:8px; padding:12px; width:calc(50% - 8px); display:flex; gap:12px; align-items:center;">
      <img src="${item.image || 'images/Product 1.jpeg'}" alt="${item.name || 'Wishlist Item'}" style="width:60px; height:60px; object-fit:cover; border-radius:6px; border:1px solid rgba(212,175,55,0.3);">
      <div style="flex:1;">
        <h4 style="margin:0 0 4px 0; font-size:0.9rem; color:#f8fafc;">${item.name || 'Royal Item'}</h4>
        <div style="color:#fbbf24; font-weight:700; font-size:0.88rem;">₹${item.price || 0}</div>
        <button type="button" onclick="window.location.href='product.html?id=${item.id}'" style="background:none; border:none; color:#fbbf24; text-decoration:underline; cursor:pointer; font-size:0.8rem; padding:0; margin-top:4px;">
          View Piece →
        </button>
      </div>
    </div>
  `).join('');
}

// ── SIGN OUT HANDLER ───────────────────────────────────────
window.handleProfileSignOut = async function () {
  if (!confirm('Are you sure you wish to sign out of the House of Beard Banna?')) return;

  if (window.supabaseClient && window.SupabaseAuth) {
    try {
      await SupabaseAuth.signOut();
    } catch (e) {}
  }

  if (window.API) {
    API.removeToken();
  }

  localStorage.removeItem('bb_user');
  window.location.href = 'index.html';
};

// ── Profile Update Form Listener ───────────────────────────
document.addEventListener('DOMContentLoaded', async function () {
  await loadProfile();

  const profileForm = document.getElementById('profile-form');
  if (profileForm) {
    profileForm.addEventListener('submit', async function (e) {
      e.preventDefault();
      await handleProfileSave();
    });
  }

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

  if (name.length < 2 || name.length > 80) {
    showMessage(errorDiv, 'Name must be between 2 and 80 characters.', 'error');
    return;
  }

  if (phone && !/^[+]?[\d\s\-]{6,16}$/.test(phone)) {
    showMessage(errorDiv, 'Please enter a valid phone number (up to 16 digits).', 'error');
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
    submitBtn.textContent = 'Save Profile Changes';
  }

  if (result.success) {
    if (window.API) {
      const current = API.getCurrentUser() || {};
      API.setCurrentUser({ ...current, name, phone });
    }

    const headingEl = document.getElementById('profile-display-heading');
    if (headingEl) headingEl.textContent = name;

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

  if (!newPassword || newPassword.length < 6 || newPassword.length > 64) {
    showMessage(errorDiv, 'Password must be between 6 and 64 characters.', 'error');
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
