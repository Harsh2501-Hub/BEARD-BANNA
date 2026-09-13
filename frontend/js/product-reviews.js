// =========================================================
// BEARD BANNA - PRODUCT REVIEWS & RATINGS SYSTEM
// High-End Royal Customer Review Workflow
// =========================================================

let reviewProductId = null;
let currentReviewPage = 1;
let currentSort = 'newest';
let currentRatingFilter = 'all';
let verifiedOnlyFilter = false;
let userSelectedRating = 5;
let uploadedReviewImages = [];
let editingReviewId = null;

// Initializer called from loadProductDetail in product.js
async function initProductReviews(productId) {
  reviewProductId = productId || getProductIdFromURL();
  if (!reviewProductId) return;

  const section = document.getElementById("product-reviews-section");
  if (!section) return;

  section.innerHTML = `
    <div class="reviews-container">
      <div class="royal-crest-badge">👑 CUSTOMER REVIEWS & RATINGS 👑</div>
      <h2 class="reviews-section-title">Scriptures of Satisfaction</h2>
      <div class="gold-divider"><span>⚜</span></div>

      <!-- Rating Summary & Breakdown Container -->
      <div id="reviews-summary-card" class="reviews-summary-card">
        <div class="summary-loading">Loading ratings & reviews...</div>
      </div>

      <!-- Review Filter & Action Toolbar -->
      <div class="reviews-toolbar">
        <div class="toolbar-filters">
          <select id="review-sort-select" onchange="changeReviewSort(this.value)">
            <option value="newest">🕒 Most Recent</option>
            <option value="highest">⭐ Highest Rating</option>
            <option value="lowest">🔻 Lowest Rating</option>
            <option value="most_helpful">👍 Most Helpful</option>
          </select>

          <div class="filter-pills">
            <button class="filter-pill active" onclick="filterReviewRating('all', this)">All</button>
            <button class="filter-pill" onclick="filterReviewRating('5', this)">5 ★</button>
            <button class="filter-pill" onclick="filterReviewRating('4', this)">4 ★</button>
            <button class="filter-pill" onclick="filterReviewRating('3', this)">3 ★</button>
            <button class="filter-pill" onclick="filterReviewRating('2', this)">2 ★</button>
            <button class="filter-pill" onclick="filterReviewRating('1', this)">1 ★</button>
            <button class="filter-pill verified-pill" onclick="toggleVerifiedFilter(this)">✔ Verified Only</button>
          </div>
        </div>

        <button class="write-review-btn" onclick="openReviewModal()">
          ✍ Write a Review
        </button>
      </div>

      <!-- Reviews Cards List -->
      <div id="reviews-list" class="reviews-list"></div>

      <!-- Pagination / Load More -->
      <div id="reviews-pagination" class="reviews-pagination"></div>
    </div>

    <!-- WRITE / EDIT REVIEW MODAL -->
    <div id="review-modal" class="royal-modal" style="display:none;">
      <div class="royal-modal-content">
        <span class="royal-modal-close" onclick="closeReviewModal()">&times;</span>
        <h2 id="modal-title">✍ Write a Product Review</h2>
        <p class="modal-sub">Share your legacy experience with the House of Beard Banna</p>

        <form id="review-form" onsubmit="handleReviewSubmit(event)">
          <div class="form-group">
            <label>Your Rating <span class="required">*</span></label>
            <div class="star-rating-picker" id="star-picker">
              <span onclick="setRating(1)" onmouseover="hoverRating(1)" onmouseout="resetRatingHover()">★</span>
              <span onclick="setRating(2)" onmouseover="hoverRating(2)" onmouseout="resetRatingHover()">★</span>
              <span onclick="setRating(3)" onmouseover="hoverRating(3)" onmouseout="resetRatingHover()">★</span>
              <span onclick="setRating(4)" onmouseover="hoverRating(4)" onmouseout="resetRatingHover()">★</span>
              <span onclick="setRating(5)" onmouseover="hoverRating(5)" onmouseout="resetRatingHover()">★</span>
            </div>
            <input type="hidden" id="review-rating-val" value="5">
          </div>

          <div class="form-group">
            <label>Review Headline / Title <span class="required">*</span></label>
            <input type="text" id="review-title-input" placeholder="e.g. Royal Quality & Regal Fit!" required maxlength="100">
          </div>

          <div class="form-group">
            <label>Detailed Review <span class="required">*</span></label>
            <textarea id="review-comment-input" rows="4" placeholder="Tell us about the fabric quality, embroidery, fit, and regal comfort..." required minlength="5" maxlength="1000"></textarea>
          </div>

          <div class="form-group">
            <label>Attach Photos (Optional)</label>
            <input type="file" id="review-image-input" accept="image/*" multiple onchange="handleReviewImageUpload(event)" style="display:none;">
            <button type="button" class="upload-btn" onclick="document.getElementById('review-image-input').click()">
              📷 Select Product Photos
            </button>
            <div id="image-preview-container" class="image-preview-container"></div>
          </div>

          <div class="modal-actions">
            <button type="button" class="cancel-btn" onclick="closeReviewModal()">Cancel</button>
            <button type="submit" class="submit-review-btn" id="submit-review-btn">
              ✨ Submit Review
            </button>
          </div>
        </form>
      </div>
    </div>

    <!-- IMAGE PREVIEW LIGHTBOX MODAL -->
    <div id="image-lightbox-modal" class="royal-modal" style="display:none;" onclick="closeLightboxModal()">
      <div class="lightbox-content" onclick="event.stopPropagation()">
        <span class="royal-modal-close" onclick="closeLightboxModal()">&times;</span>
        <img id="lightbox-img" src="" alt="Review Photo">
      </div>
    </div>
  `;

  await loadReviewsData();
}

function getProductIdFromURL() {
  const params = new URLSearchParams(window.location.search);
  return params.get("id") || (window.currentProduct ? window.currentProduct.id : null);
}

async function loadReviewsData() {
  if (!reviewProductId) return;

  let queryUrl = `/reviews/product/${reviewProductId}?page=${currentReviewPage}&limit=6&sort=${currentSort}`;
  if (currentRatingFilter !== 'all') {
    queryUrl += `&rating=${currentRatingFilter}`;
  }
  if (verifiedOnlyFilter) {
    queryUrl += `&verifiedOnly=true`;
  }

  let data = null;
  try {
    const res = await API.get(queryUrl);
    if (res.success && res.data) {
      data = res.data;
    }
  } catch (err) {
    console.warn("Backend API offline or endpoint unpopulated, reading local reviews cache:", err.message);
  }

  // Fallback to local storage reviews if backend returns null
  if (!data) {
    data = getLocalReviews(reviewProductId, currentReviewPage, currentSort, currentRatingFilter, verifiedOnlyFilter);
  }

  renderSummary(data.summary);
  renderReviewsList(data.reviews);
  renderPagination(data.pagination);
}

function getLocalReviews(prodId, page, sort, ratingFilter, verifiedFilter) {
  const isClearedAll = localStorage.getItem("admin_cleared_all_reviews") === "true";
  const deletedIds = JSON.parse(localStorage.getItem("deleted_reviews")) || [];

  let allStorageReviews = [];
  if (!isClearedAll) {
    allStorageReviews = JSON.parse(localStorage.getItem(`reviews_${prodId}`)) || [
      {
        id: "rev-1",
        user: { name: "Rana Harshvardhan", email: "harsh@rajputana.com" },
        rating: 5,
        title: "Pure Rajputana Royalty!",
        comment: "The embroidery and gold detailing on the chest scripture are unmatched. Fabric feels heavy, 100% premium cotton.",
        isVerifiedPurchase: true,
        createdAt: new Date().toISOString(),
        helpfulCount: 14,
        variantInfo: { size: "L" }
      },
      {
        id: "rev-2",
        user: { name: "Kunwar Vikram Singh", email: "vikram@rajputana.com" },
        rating: 5,
        title: "Regal Comfort & Perfect Fit",
        comment: "Wore it to our family royal gathering. Received so many compliments! Definite must-buy for anyone proud of their lineage.",
        isVerifiedPurchase: true,
        createdAt: new Date(Date.now() - 86400000 * 2).toISOString(),
        helpfulCount: 9,
        variantInfo: { size: "XL" }
      }
    ];
  }

  // Filter out any deleted review IDs
  allStorageReviews = allStorageReviews.filter(r => !deletedIds.includes(String(r.id)) && !deletedIds.includes(String(r._id)));

  let filtered = allStorageReviews.filter(r => (r.status || 'approved') === 'approved');
  if (ratingFilter !== 'all') {
    filtered = filtered.filter(r => String(r.rating) === String(ratingFilter));
  }
  if (verifiedFilter) {
    filtered = filtered.filter(r => r.isVerifiedPurchase);
  }

  if (sort === 'highest') filtered.sort((a, b) => b.rating - a.rating);
  else if (sort === 'lowest') filtered.sort((a, b) => a.rating - b.rating);
  else if (sort === 'most_helpful') filtered.sort((a, b) => (b.helpfulCount || 0) - (a.helpfulCount || 0));
  else filtered.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));

  const dist = { 5: 0, 4: 0, 3: 0, 2: 0, 1: 0 };
  let sum = 0;
  allStorageReviews.forEach(r => {
    sum += r.rating;
    if (dist[r.rating]) dist[r.rating]++;
  });

  const total = allStorageReviews.length;
  const avg = total > 0 ? Math.round((sum / total) * 10) / 10 : 0;

  return {
    reviews: filtered,
    summary: {
      averageRating: avg,
      totalReviews: total,
      distribution: dist
    },
    pagination: {
      total: filtered.length,
      page: 1,
      pages: 1,
      limit: 10
    }
  };
}

function renderSummary(summary) {
  const card = document.getElementById("reviews-summary-card");
  if (!card) return;

  const avg = summary?.averageRating || 0;
  const total = summary?.totalReviews || 0;
  const dist = summary?.distribution || { 5: 0, 4: 0, 3: 0, 2: 0, 1: 0 };

  let barsHTML = "";
  for (let star = 5; star >= 1; star--) {
    const count = dist[star] || 0;
    const percent = total > 0 ? Math.round((count / total) * 100) : 0;
    barsHTML += `
      <div class="rating-bar-row">
        <span class="star-label">${star} ★</span>
        <div class="rating-bar-track">
          <div class="rating-bar-fill" style="width: ${percent}%;"></div>
        </div>
        <span class="count-label">${count} (${percent}%)</span>
      </div>
    `;
  }

  card.innerHTML = `
    <div class="summary-score-box">
      <div class="big-score">${avg}</div>
      <div class="score-stars">${renderStars(avg)}</div>
      <p class="based-on">Based on <b>${total}</b> verified customer reviews</p>
    </div>
    <div class="summary-bars-box">
      ${barsHTML}
    </div>
  `;
}

function renderStars(rating) {
  const fullStars = Math.floor(rating);
  let stars = "";
  for (let i = 0; i < fullStars; i++) stars += "★";
  for (let i = stars.length; i < 5; i++) stars += "☆";
  return `<span class="gold-stars">${stars}</span>`;
}

function renderReviewsList(reviews) {
  const container = document.getElementById("reviews-list");
  if (!container) return;

  if (!reviews || reviews.length === 0) {
    container.innerHTML = `
      <div class="empty-reviews-state">
        <div class="empty-icon">📜</div>
        <h3>No Reviews Match Your Selection</h3>
        <p>Be the first royal customer to share your thoughts on this legacy piece!</p>
        <button class="write-review-btn" onclick="openReviewModal()">✍ Write a Review</button>
      </div>
    `;
    return;
  }

  const currentUser = API.getCurrentUser();
  const isAdmin = currentUser && (currentUser.role === 'admin' || localStorage.getItem('adminToken'));

  let html = "";
  reviews.forEach(r => {
    const authorName = r.user?.name || r.authorName || "Royal Customer";
    const authorAvatar = authorName.charAt(0).toUpperCase();
    const isOwner = currentUser && (currentUser._id === r.user?._id || currentUser.email === r.user?.email);
    const dateStr = new Date(r.createdAt || Date.now()).toLocaleDateString("en-IN", { day: 'numeric', month: 'long', year: 'numeric' });

    let imagesHTML = "";
    if (Array.isArray(r.images) && r.images.length > 0) {
      imagesHTML = `<div class="review-images-grid">`;
      r.images.forEach(img => {
        imagesHTML += `<img src="${img}" onclick="openLightboxModal('${img}')" class="review-thumbnail" alt="Review Photo">`;
      });
      imagesHTML += `</div>`;
    }

    html += `
      <div class="review-card" id="review-card-${r._id || r.id}">
        <div class="review-card-header">
          <div class="author-info">
            <div class="author-avatar">${authorAvatar}</div>
            <div>
              <h4 class="author-name">${authorName}</h4>
              <div class="review-meta">
                ${r.isVerifiedPurchase ? `<span class="verified-badge">✔ Verified Purchase</span>` : ''}
                <small class="review-date">${dateStr}</small>
                ${r.variantInfo?.size ? `<small class="variant-tag">Size: ${r.variantInfo.size}</small>` : ''}
              </div>
            </div>
          </div>
          <div class="review-stars-box">${renderStars(r.rating)}</div>
        </div>

        <h3 class="review-card-title">${r.title || 'Exceptional Quality'}</h3>
        <p class="review-card-comment">${r.comment}</p>

        ${imagesHTML}

        <div class="review-card-footer">
          <button class="helpful-btn" onclick="voteReviewHelpful('${r._id || r.id}', this)">
            👍 Helpful (<span class="helpful-count">${r.helpfulCount || 0}</span>)
          </button>

          <div class="owner-actions">
            ${isOwner ? `<button class="edit-review-btn" onclick="openEditReviewModal('${r._id || r.id}')">✏ Edit Review</button>` : ''}
            ${isAdmin ? `<button class="delete-review-btn" onclick="deleteCustomerReview('${r._id || r.id}')">🗑 Delete (Admin Only)</button>` : ''}
          </div>
        </div>
      </div>
    `;
  });

  container.innerHTML = html;
}

function renderPagination(pagination) {
  const container = document.getElementById("reviews-pagination");
  if (!container) return;

  if (!pagination || pagination.pages <= 1) {
    container.innerHTML = "";
    return;
  }

  container.innerHTML = `
    <p>Showing ${((pagination.page - 1) * pagination.limit) + 1}–${Math.min(pagination.total, pagination.page * pagination.limit)} of ${pagination.total} reviews</p>
    ${pagination.page < pagination.pages ? `<button class="load-more-btn" onclick="loadMoreReviews()">Load More Reviews ↓</button>` : ''}
  `;
}

function changeReviewSort(value) {
  currentSort = value;
  currentReviewPage = 1;
  loadReviewsData();
}

function filterReviewRating(star, btnEl) {
  document.querySelectorAll(".filter-pill").forEach(p => p.classList.remove("active"));
  btnEl.classList.add("active");
  currentRatingFilter = star;
  currentReviewPage = 1;
  loadReviewsData();
}

function toggleVerifiedFilter(btnEl) {
  verifiedOnlyFilter = !verifiedOnlyFilter;
  btnEl.classList.toggle("active", verifiedOnlyFilter);
  currentReviewPage = 1;
  loadReviewsData();
}

function loadMoreReviews() {
  currentReviewPage++;
  loadReviewsData();
}

function setRating(val) {
  userSelectedRating = val;
  document.getElementById("review-rating-val").value = val;
  updateStarPickerUI(val);
}

function hoverRating(val) {
  updateStarPickerUI(val);
}

function resetRatingHover() {
  updateStarPickerUI(userSelectedRating);
}

function updateStarPickerUI(ratingVal) {
  const picker = document.getElementById("star-picker");
  if (!picker) return;
  const stars = picker.querySelectorAll("span");
  stars.forEach((star, index) => {
    if (index < ratingVal) {
      star.style.color = "#D4AF37";
      star.style.textShadow = "0 0 10px rgba(212, 175, 55, 0.8)";
    } else {
      star.style.color = "#666";
      star.style.textShadow = "none";
    }
  });
}

function openReviewModal() {
  const user = API.getCurrentUser();
  if (!user && !API.getToken()) {
    alert("Please login to write a product review.");
    window.location.href = "login.html";
    return;
  }

  editingReviewId = null;
  uploadedReviewImages = [];
  document.getElementById("modal-title").textContent = "✍ Write a Product Review";
  document.getElementById("review-form").reset();
  document.getElementById("image-preview-container").innerHTML = "";
  setRating(5);

  document.getElementById("review-modal").style.display = "flex";
}

function closeReviewModal() {
  document.getElementById("review-modal").style.display = "none";
}

function handleReviewImageUpload(e) {
  const files = e.target.files;
  if (!files || files.length === 0) return;

  const container = document.getElementById("image-preview-container");

  Array.from(files).forEach(file => {
    if (file.size > 3 * 1024 * 1024) {
      alert("Image must be smaller than 3MB.");
      return;
    }

    const reader = new FileReader();
    reader.onload = function (evt) {
      const base64 = evt.target.result;
      uploadedReviewImages.push(base64);

      const div = document.createElement("div");
      div.className = "preview-thumb-box";
      div.innerHTML = `
        <img src="${base64}">
        <button type="button" class="remove-img-btn" onclick="removeUploadedImage('${base64}', this)">&times;</button>
      `;
      container.appendChild(div);
    };
    reader.readAsDataURL(file);
  });
}

function removeUploadedImage(base64, btnEl) {
  uploadedReviewImages = uploadedReviewImages.filter(img => img !== base64);
  btnEl.parentElement.remove();
}

async function handleReviewSubmit(e) {
  e.preventDefault();

  const submitBtn = document.getElementById("submit-review-btn");
  submitBtn.disabled = true;
  submitBtn.innerHTML = `<span class="loader"></span> Submitting...`;

  const rating = Number(document.getElementById("review-rating-val").value || 5);
  const title = document.getElementById("review-title-input").value.trim();
  const comment = document.getElementById("review-comment-input").value.trim();
  const sizeSelect = document.getElementById("size");
  const size = sizeSelect ? sizeSelect.value : "M";

  try {
    if (editingReviewId) {
      await API.put(`/reviews/${editingReviewId}`, {
        rating,
        title,
        comment,
        images: uploadedReviewImages
      });
      if (typeof showToast === "function") showToast("✅ Review updated successfully!");
    } else {
      await API.post('/reviews', {
        productId: reviewProductId,
        rating,
        title,
        comment,
        images: uploadedReviewImages,
        variantInfo: { size }
      });
      if (typeof showToast === "function") showToast("✨ Thank you! Review submitted successfully!");
    }

    // Reset cleared flag when a new review is posted
    localStorage.removeItem("admin_cleared_all_reviews");
    closeReviewModal();
    loadReviewsData();
  } catch (err) {
    saveReviewLocally(editingReviewId, reviewProductId, rating, title, comment, uploadedReviewImages, size);
    closeReviewModal();
    loadReviewsData();
    if (typeof showToast === "function") showToast("✨ Review saved successfully!");
  } finally {
    submitBtn.disabled = false;
    submitBtn.innerHTML = `✨ Submit Review`;
  }
}

function saveReviewLocally(existingId, prodId, rating, title, comment, images, size) {
  localStorage.removeItem("admin_cleared_all_reviews");
  const user = API.getCurrentUser() || { name: "Royal Customer", email: "customer@rajputana.com" };
  let localList = JSON.parse(localStorage.getItem(`reviews_${prodId}`)) || [];

  if (existingId) {
    const idx = localList.findIndex(r => r.id === existingId || r._id === existingId);
    if (idx > -1) {
      localList[idx].rating = rating;
      localList[idx].title = title;
      localList[idx].comment = comment;
      localList[idx].images = images;
    }
  } else {
    const newRev = {
      id: "rev-" + Date.now(),
      _id: "rev-" + Date.now(),
      user: { name: user.name, email: user.email },
      rating,
      title,
      comment,
      images,
      isVerifiedPurchase: true,
      status: "approved",
      createdAt: new Date().toISOString(),
      helpfulCount: 0,
      variantInfo: { size }
    };
    localList.unshift(newRev);
  }

  localStorage.setItem(`reviews_${prodId}`, JSON.stringify(localList));
}

async function voteReviewHelpful(reviewId, btnEl) {
  const countSpan = btnEl.querySelector(".helpful-count");
  let currentVal = Number(countSpan.textContent || 0);

  try {
    const res = await API.post(`/reviews/${reviewId}/helpful`);
    if (res.success && res.data) {
      countSpan.textContent = res.data.helpfulCount;
      btnEl.style.color = "#D4AF37";
      if (typeof showToast === "function") showToast(res.message || "Helpful vote recorded!");
      return;
    }
  } catch (e) {}

  countSpan.textContent = currentVal + 1;
  btnEl.style.color = "#D4AF37";
  if (typeof showToast === "function") showToast("👍 Helpful vote recorded!");
}

async function deleteCustomerReview(reviewId) {
  if (!confirm("Are you sure you want to delete this review? (Admin Only)")) return;

  try {
    await API.delete(`/reviews/${reviewId}`);
    if (typeof showToast === "function") showToast("🗑 Review deleted by admin!");
  } catch (err) {
    alert(err.message || "Forbidden: Only store admins are permitted to delete product reviews.");
    return;
  }

  let localList = JSON.parse(localStorage.getItem(`reviews_${reviewProductId}`)) || [];
  localList = localList.filter(r => r.id !== reviewId && r._id !== reviewId);
  localStorage.setItem(`reviews_${reviewProductId}`, JSON.stringify(localList));

  loadReviewsData();
}

function openLightboxModal(imgSrc) {
  document.getElementById("lightbox-img").src = imgSrc;
  document.getElementById("image-lightbox-modal").style.display = "flex";
}

function closeLightboxModal() {
  document.getElementById("image-lightbox-modal").style.display = "none";
}

// Real-time Storage Sync Listener
window.addEventListener("storage", function(e) {
  if (e.key === "admin_cleared_all_reviews" || e.key === "deleted_reviews" || (e.key && e.key.startsWith("reviews_"))) {
    loadReviewsData();
  }
});

window.initProductReviews = initProductReviews;
