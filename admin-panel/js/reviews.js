// ===============================
// ADMIN REVIEWS MANAGEMENT PORTAL
// Moderation, Analytics, Search, Filters
// ===============================

let adminReviews = [];
let adminReviewPage = 1;
let currentAdminSearch = "";
let currentAdminStatus = "all";
let currentAdminRating = "all";
let currentAdminVerified = "all";

async function loadAdminReviews() {
  await loadReviewAnalytics();

  let query = `/admin/reviews?page=${adminReviewPage}&limit=12`;
  if (currentAdminSearch) query += `&search=${encodeURIComponent(currentAdminSearch)}`;
  if (currentAdminStatus !== "all") query += `&status=${currentAdminStatus}`;
  if (currentAdminRating !== "all") query += `&rating=${currentAdminRating}`;
  if (currentAdminVerified !== "all") query += `&verified=${currentAdminVerified}`;

  let data = null;
  try {
    const res = await API.get(query, { isAdmin: true });
    if (res.success && res.data) {
      data = res.data;
    }
  } catch (err) {
    console.warn("Using local reviews cache fallback for admin portal");
  }

  if (!data) {
    data = getLocalAdminReviews();
  }

  adminReviews = data.reviews || [];
  renderAdminReviewsTable(adminReviews);
  renderAdminPagination(data.pagination);
}

function getLocalAdminReviews() {
  const deletedIds = JSON.parse(localStorage.getItem("deleted_reviews")) || [];

  // Collect all reviews stored across products in localStorage
  let all = [];
  for (let i = 0; i < localStorage.length; i++) {
    const key = localStorage.key(i);
    if (key.startsWith("reviews_")) {
      try {
        const itemRevs = JSON.parse(localStorage.getItem(key)) || [];
        all = all.concat(itemRevs);
      } catch (e) {}
    }
  }



  // Filter out deleted review IDs
  all = all.filter(r => !deletedIds.includes(String(r._id)) && !deletedIds.includes(String(r.id)));

  // Filtering
  let filtered = [...all];
  if (currentAdminStatus !== "all") {
    filtered = filtered.filter(r => (r.status || 'approved').toLowerCase() === currentAdminStatus.toLowerCase());
  }
  if (currentAdminRating !== "all") {
    filtered = filtered.filter(r => String(r.rating) === String(currentAdminRating));
  }
  if (currentAdminVerified === "true") {
    filtered = filtered.filter(r => r.isVerifiedPurchase);
  }
  if (currentAdminSearch) {
    const s = currentAdminSearch.toLowerCase();
    filtered = filtered.filter(r =>
      (r.title && r.title.toLowerCase().includes(s)) ||
      (r.comment && r.comment.toLowerCase().includes(s)) ||
      (r.user?.name && r.user.name.toLowerCase().includes(s)) ||
      (r.product?.title && r.product.title.toLowerCase().includes(s))
    );
  }

  return {
    reviews: filtered,
    pagination: {
      total: filtered.length,
      page: 1,
      pages: 1,
      limit: 12
    }
  };
}

async function loadReviewAnalytics() {
  let stats = { total: 0, pending: 0, approved: 0, rejected: 0, verified: 0, averageRating: 0 };
  try {
    const res = await API.get('/admin/reviews/analytics', { isAdmin: true });
    if (res.success && res.data) {
      stats = res.data;
    }
  } catch (err) {
    const localData = getLocalAdminReviews();
    const revs = localData.reviews || [];
    stats.total = revs.length;
    stats.approved = revs.filter(r => (r.status || 'approved') === 'approved').length;
    stats.pending = revs.filter(r => r.status === 'pending').length;
    stats.rejected = revs.filter(r => r.status === 'rejected').length;
    stats.verified = revs.filter(r => r.isVerifiedPurchase).length;
    const sum = revs.reduce((acc, r) => acc + r.rating, 0);
    stats.averageRating = revs.length > 0 ? Math.round((sum / revs.length) * 10) / 10 : 0;
  }

  const totalEl = document.getElementById("analytics-total-reviews");
  const avgEl = document.getElementById("analytics-avg-rating");
  const appEl = document.getElementById("analytics-approved-reviews");
  const penEl = document.getElementById("analytics-pending-reviews");
  const rejEl = document.getElementById("analytics-rejected-reviews");
  const verEl = document.getElementById("analytics-verified-reviews");
  const pendingBadge = document.getElementById("pending-reviews-badge");

  if (totalEl) totalEl.textContent = stats.total;
  if (avgEl) avgEl.textContent = "⭐ " + stats.averageRating;
  if (appEl) appEl.textContent = stats.approved;
  if (penEl) penEl.textContent = stats.pending;
  if (rejEl) rejEl.textContent = stats.rejected;
  if (verEl) verEl.textContent = stats.verified;

  if (pendingBadge) {
    if (stats.pending > 0) {
      pendingBadge.textContent = stats.pending;
      pendingBadge.style.display = "inline-block";
    } else {
      pendingBadge.style.display = "none";
    }
  }
}

function renderAdminReviewsTable(reviews) {
  const tbody = document.getElementById("reviews-body");
  if (!tbody) return;

  if (reviews.length === 0) {
    tbody.innerHTML = `<tr><td colspan="9" style="text-align:center; padding:35px; color:#94a3b8; font-size:1.05rem;">💬 No reviews found matching your search filters.</td></tr>`;
    return;
  }

  let html = "";
  reviews.forEach(r => {
    const id = r._id || r.id;
    const customerName = r.user?.name || r.userName || "Customer";
    const productName = r.product?.title || r.productName || "Product Item";
    const status = (r.status || "approved").toLowerCase();
    const dateStr = new Date(r.createdAt || Date.now()).toLocaleDateString("en-IN");

    let statusBadge = `<span class="badge shipped">Approved</span>`;
    if (status === "pending") statusBadge = `<span class="badge pending" style="background:#f59e0b; color:white;">Pending</span>`;
    if (status === "rejected") statusBadge = `<span class="badge active" style="background:#ef4444; color:white;">Rejected</span>`;

    html += `
      <tr>
        <td><small>#${id.slice(-6)}</small></td>
        <td><b>${customerName}</b><br><small style="color:#94a3b8;">${r.user?.email || ''}</small></td>
        <td><b>${productName}</b></td>
        <td><strong style="color:#f59e0b;">${r.rating} ★</strong></td>
        <td>
          <div style="font-weight:700; color:#520F16;">${r.title || ''}</div>
          <small style="color:#64748b;">${r.comment ? (r.comment.length > 50 ? r.comment.slice(0, 50) + '...' : r.comment) : ''}</small>
        </td>
        <td>${r.isVerifiedPurchase ? `<span style="background:#166534; color:#fff; padding:2px 8px; border-radius:10px; font-size:0.75rem; font-weight:700;">✔ Verified</span>` : `<span style="color:#94a3b8; font-size:0.8rem;">Standard</span>`}</td>
        <td>${statusBadge}</td>
        <td><small>${dateStr}</small></td>
        <td>
          <div style="display:flex; gap:6px; flex-wrap:wrap;">
            ${status !== 'approved' ? `<button onclick="updateReviewStatusAction('${id}', 'approved')" style="background:#22c55e; color:white; border:none; padding:4px 8px; border-radius:4px; font-weight:700; cursor:pointer;" title="Approve Review">✅ Approve</button>` : ''}
            ${status !== 'rejected' ? `<button onclick="updateReviewStatusAction('${id}', 'rejected')" style="background:#f59e0b; color:white; border:none; padding:4px 8px; border-radius:4px; font-weight:700; cursor:pointer;" title="Reject Review">🚫 Reject</button>` : ''}
            <button onclick="viewReviewDetails('${id}')" style="background:#3b82f6; color:white; border:none; padding:4px 8px; border-radius:4px; font-weight:700; cursor:pointer;" title="View Details">👁 View</button>
            <button onclick="deleteAdminReviewAction('${id}')" style="background:#dc2626; color:white; border:none; padding:4px 8px; border-radius:4px; font-weight:700; cursor:pointer;" title="Delete Review">🗑 Delete</button>
          </div>
        </td>
      </tr>
    `;
  });

  tbody.innerHTML = html;
}

function renderAdminPagination(pagination) {
  const container = document.getElementById("admin-reviews-pagination");
  if (!container) return;
  if (!pagination || pagination.pages <= 1) {
    container.innerHTML = "";
    return;
  }

  container.innerHTML = `
    Showing page ${pagination.page} of ${pagination.pages} (${pagination.total} total reviews)
  `;
}

async function updateReviewStatusAction(id, status) {
  try {
    await API.patch(`/admin/reviews/${id}/status`, { status }, { isAdmin: true });
    if (typeof showToast === "function") showToast(`✅ Review status updated to ${status}`);
  } catch (err) {
    updateLocalReviewStatus(id, status);
    if (typeof showToast === "function") showToast(`✅ Review status updated to ${status}`);
  }
  loadAdminReviews();
}

function updateLocalReviewStatus(id, status) {
  for (let i = 0; i < localStorage.length; i++) {
    const key = localStorage.key(i);
    if (key.startsWith("reviews_")) {
      let list = JSON.parse(localStorage.getItem(key)) || [];
      const idx = list.findIndex(r => r.id === id || r._id === id);
      if (idx > -1) {
        list[idx].status = status;
        localStorage.setItem(key, JSON.stringify(list));
        break;
      }
    }
  }
}

async function deleteAdminReviewAction(id) {
  if (!confirm("Are you sure you want to delete this review permanently?")) return;

  try {
    await API.delete(`/admin/reviews/${id}`, { isAdmin: true });
  } catch (err) {}

  deleteLocalReview(id);

  if (typeof showToast === "function") showToast("🗑 Review deleted successfully!");
  loadAdminReviews();
}

function deleteLocalReview(id) {
  const deletedIds = JSON.parse(localStorage.getItem("deleted_reviews")) || [];
  if (!deletedIds.includes(String(id))) {
    deletedIds.push(String(id));
    localStorage.setItem("deleted_reviews", JSON.stringify(deletedIds));
  }

  for (let i = 0; i < localStorage.length; i++) {
    const key = localStorage.key(i);
    if (key.startsWith("reviews_")) {
      let list = JSON.parse(localStorage.getItem(key)) || [];
      list = list.filter(r => String(r.id) !== String(id) && String(r._id) !== String(id));
      localStorage.setItem(key, JSON.stringify(list));
    }
  }
}

function clearAllReviewsAdmin() {
  if (!confirm("⚠️ Are you sure you want to delete ALL reviews and reset review metrics?")) return;

  for (let i = localStorage.length - 1; i >= 0; i--) {
    const key = localStorage.key(i);
    if (key && key.startsWith("reviews_")) {
      localStorage.removeItem(key);
    }
  }

  localStorage.setItem("admin_cleared_all_reviews", "true");
  localStorage.removeItem("deleted_reviews");

  loadAdminReviews();
  if (typeof showToast === "function") showToast("🗑 All reviews cleared successfully!");
  else alert("All reviews cleared successfully!");
}

function viewReviewDetails(id) {
  const review = adminReviews.find(r => (r._id || r.id) === id);
  if (!review) return;

  let imagesHTML = "";
  if (Array.isArray(review.images) && review.images.length > 0) {
    imagesHTML = `<div style="display:flex; gap:10px; margin-top:10px; flex-wrap:wrap;">`;
    review.images.forEach(img => {
      imagesHTML += `<img src="${img}" style="width:90px; height:90px; object-fit:cover; border-radius:8px; border:1px solid #ddd;">`;
    });
    imagesHTML += `</div>`;
  }

  const modalBody = document.getElementById("modal-review-details");
  if (modalBody) {
    modalBody.innerHTML = `
      <h2 style="color:#520F16; margin-top:0;">Review Details (#${id.slice(-6)})</h2>
      <hr style="margin:10px 0;">
      <p><b>Customer:</b> ${review.user?.name || 'Customer'} (${review.user?.email || 'N/A'})</p>
      <p><b>Product:</b> ${review.product?.title || 'Product'}</p>
      <p><b>Rating:</b> <strong style="color:#f59e0b;">${review.rating} ★★★★★</strong></p>
      <p><b>Verification:</b> ${review.isVerifiedPurchase ? '✔ Verified Purchase' : 'Standard Review'}</p>
      <p><b>Status:</b> ${review.status || 'approved'}</p>
      <p><b>Date:</b> ${new Date(review.createdAt || Date.now()).toLocaleString()}</p>
      <br>
      <div style="background:#fafafa; border:1px solid #ddd; padding:12px; border-radius:8px;">
        <h3 style="margin-top:0; color:#520F16;">${review.title || 'Review Headline'}</h3>
        <p style="margin:0; line-height:1.5;">${review.comment || ''}</p>
        ${imagesHTML}
      </div>
    `;
  }

  document.getElementById("review-modal").style.display = "flex";
}

function closeReviewDetailsModal() {
  document.getElementById("review-modal").style.display = "none";
}

// Attach Search & Filters Listeners
document.addEventListener("DOMContentLoaded", () => {
  const searchInput = document.getElementById("review-search");
  if (searchInput) {
    searchInput.addEventListener("input", (e) => {
      currentAdminSearch = e.target.value.trim();
      adminReviewPage = 1;
      loadAdminReviews();
    });
  }

  const statusSel = document.getElementById("status-filter");
  if (statusSel) {
    statusSel.addEventListener("change", (e) => {
      currentAdminStatus = e.target.value;
      adminReviewPage = 1;
      loadAdminReviews();
    });
  }

  const ratingSel = document.getElementById("rating-filter");
  if (ratingSel) {
    ratingSel.addEventListener("change", (e) => {
      currentAdminRating = e.target.value;
      adminReviewPage = 1;
      loadAdminReviews();
    });
  }

  const verifiedSel = document.getElementById("verified-filter");
  if (verifiedSel) {
    verifiedSel.addEventListener("change", (e) => {
      currentAdminVerified = e.target.value;
      adminReviewPage = 1;
      loadAdminReviews();
    });
  }

  loadAdminReviews();
});

window.updateReviewStatusAction = updateReviewStatusAction;
window.deleteAdminReviewAction = deleteAdminReviewAction;
window.clearAllReviewsAdmin = clearAllReviewsAdmin;
window.viewReviewDetails = viewReviewDetails;
window.closeReviewDetailsModal = closeReviewDetailsModal;
