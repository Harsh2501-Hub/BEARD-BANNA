// ================================================================
// ADMIN INQUIRIES MANAGEMENT — LIVE SUPABASE INTEGRATED
// Zero mock data. Live database records & Supabase Realtime.
// ================================================================

let inquiries = [];
let inquiriesSubscription = null;

async function loadAdminInquiries() {
  const tbody = document.getElementById("inquiries-table-body");
  if (tbody) {
    tbody.innerHTML = `<tr><td colspan="8" style="text-align:center; padding: 25px; color:#94a3b8;">⏳ Loading inquiries from database...</td></tr>`;
  }

  try {
    if (!window.supabaseClient) {
      throw new Error("Supabase client not initialized");
    }

    // Ensure admin session if available
    if (typeof ensureAdminSupabaseSession === "function") {
      await ensureAdminSupabaseSession();
    }

    // Query inquiries from Supabase
    const { data, error } = await window.supabaseClient
      .from("inquiries")
      .select("*")
      .order("created_at", { ascending: false });

    if (error) {
      console.warn("[Admin Inquiries] Supabase query notice:", error.message);
      // Fallback to local cache if DB error
      const cached = JSON.parse(localStorage.getItem("inquiries") || "[]");
      inquiries = cached.filter(i => !i.id?.startsWith("INQ-981241")); // Filter out dummy data
    } else if (Array.isArray(data)) {
      inquiries = data.map(mapInquiryRecord);
      try {
        localStorage.setItem("inquiries", JSON.stringify(inquiries));
      } catch (e) {}
    }

  } catch (err) {
    console.error("[Admin Inquiries] Load failed:", err);
    const cached = JSON.parse(localStorage.getItem("inquiries") || "[]");
    inquiries = cached.filter(i => !i.id?.startsWith("INQ-981241"));
  }

  renderInquiries();
  updateInquiryStats();

  // Setup Realtime live listener once
  setupInquiriesRealtime();
}

function mapInquiryRecord(inq) {
  return {
    id: inq.inquiry_number || inq.id,
    _id: inq.id,
    name: inq.name || "Customer",
    email: inq.email || "",
    phone: inq.phone || "",
    orderNumber: inq.order_number || "N/A",
    subject: inq.subject || "General Inquiry",
    message: inq.message || "",
    status: inq.status || "New",
    date: inq.created_at ? new Date(inq.created_at).toLocaleDateString("en-IN") : new Date().toLocaleDateString("en-IN")
  };
}

function renderInquiries(list = inquiries) {
  const tbody = document.getElementById("inquiries-table-body");
  if (!tbody) return;
  tbody.innerHTML = "";

  if (!list || list.length === 0) {
    tbody.innerHTML = `<tr><td colspan="8" style="text-align:center; padding: 25px; color:#94a3b8;">📩 No customer inquiries found in database.</td></tr>`;
    return;
  }

  list.forEach(inq => {
    const isResolved = inq.status === "Resolved";
    tbody.innerHTML += `
      <tr id="inq-row-${inq._id || inq.id}">
        <td><strong style="color:#d4af37;">${inq.id}</strong></td>
        <td><strong>${escapeHtml(inq.name)}</strong></td>
        <td>
          <div>📧 <a href="mailto:${escapeHtml(inq.email)}" style="color:#38bdf8; text-decoration:none;">${escapeHtml(inq.email)}</a></div>
          <div>📞 <a href="tel:${escapeHtml(inq.phone)}" style="color:#fbbf24; text-decoration:none;"><strong>${escapeHtml(inq.phone)}</strong></a></div>
        </td>
        <td><span class="badge ${inq.orderNumber && inq.orderNumber !== 'N/A' ? 'active' : 'pending'}">${escapeHtml(inq.orderNumber)}</span></td>
        <td>
          <div><strong>${escapeHtml(inq.subject)}</strong></div>
          <small style="color:#94a3b8; display:block; max-width:320px; white-space:normal; line-height:1.4;">${escapeHtml(inq.message)}</small>
        </td>
        <td>${inq.date}</td>
        <td>
          <span class="status ${isResolved ? 'active' : 'pending'}" id="status-badge-${inq._id || inq.id}">
            ${isResolved ? '✅ Resolved' : '⏳ New'}
          </span>
        </td>
        <td>
          <button class="view-btn" style="padding:4px 8px; font-size:0.8rem; cursor:pointer;" onclick="toggleInquiryStatus('${inq._id || inq.id}')">
            ${isResolved ? '↺ Mark New' : '✅ Resolve'}
          </button>
          <button class="delete-btn" style="padding:4px 8px; font-size:0.8rem; margin-top:4px; cursor:pointer;" onclick="deleteInquiry('${inq._id || inq.id}')">🗑</button>
        </td>
      </tr>
    `;
  });
}

function updateInquiryStats() {
  const totalEl = document.getElementById("stat-total-inquiries");
  const newEl = document.getElementById("stat-new-inquiries");
  const resolvedEl = document.getElementById("stat-resolved-inquiries");

  if (totalEl) totalEl.textContent = inquiries.length;
  if (newEl) newEl.textContent = inquiries.filter(i => i.status !== "Resolved").length;
  if (resolvedEl) resolvedEl.textContent = inquiries.filter(i => i.status === "Resolved").length;
}

async function toggleInquiryStatus(targetId) {
  const inq = inquiries.find(i => String(i._id) === String(targetId) || String(i.id) === String(targetId));
  if (!inq) return;

  const nextStatus = inq.status === "Resolved" ? "New" : "Resolved";
  inq.status = nextStatus;
  renderInquiries();
  updateInquiryStats();

  // Persist to Supabase
  if (window.supabaseClient) {
    try {
      const matchCol = inq._id ? 'id' : 'inquiry_number';
      const matchVal = inq._id || inq.id;
      const { error } = await window.supabaseClient
        .from("inquiries")
        .update({ status: nextStatus, updated_at: new Date().toISOString() })
        .eq(matchCol, matchVal);

      if (error) console.warn("[Admin Inquiries] Status update notice:", error.message);
      else console.log("[Admin Inquiries] ✅ Status updated in database:", nextStatus);
    } catch (e) {
      console.warn("[Admin Inquiries] Supabase update error:", e);
    }
  }

  try { localStorage.setItem("inquiries", JSON.stringify(inquiries)); } catch (e) {}
  if (typeof showToast === "function") showToast(`Inquiry status updated to ${nextStatus}`);
}

async function deleteInquiry(targetId) {
  if (!confirm("Are you sure you want to delete this inquiry from the database?")) return;

  const inq = inquiries.find(i => String(i._id) === String(targetId) || String(i.id) === String(targetId));
  inquiries = inquiries.filter(i => String(i._id) !== String(targetId) && String(i.id) !== String(targetId));
  renderInquiries();
  updateInquiryStats();

  if (window.supabaseClient && inq) {
    try {
      const matchCol = inq._id ? 'id' : 'inquiry_number';
      const matchVal = inq._id || inq.id;
      await window.supabaseClient
        .from("inquiries")
        .delete()
        .eq(matchCol, matchVal);
      console.log("[Admin Inquiries] ✅ Deleted from database:", targetId);
    } catch (e) {
      console.warn("[Admin Inquiries] Delete error:", e);
    }
  }

  try { localStorage.setItem("inquiries", JSON.stringify(inquiries)); } catch (e) {}
  if (typeof showToast === "function") showToast("Inquiry deleted");
}

function setupInquiriesRealtime() {
  if (inquiriesSubscription || !window.supabaseClient) return;

  try {
    inquiriesSubscription = window.supabaseClient
      .channel("admin-inquiries-realtime")
      .on(
        "postgres_changes",
        { event: "INSERT", schema: "public", table: "inquiries" },
        payload => {
          console.log("[Admin Inquiries] ⚡ Realtime inquiry received:", payload.new);
          if (payload.new) {
            const newMapped = mapInquiryRecord(payload.new);
            if (!inquiries.some(i => String(i.id) === String(newMapped.id) || String(i._id) === String(newMapped._id))) {
              inquiries.unshift(newMapped);
              renderInquiries();
              updateInquiryStats();
              if (typeof showToast === "function") {
                showToast(`📩 New Inquiry from ${newMapped.name}!`);
              }
            }
          }
        }
      )
      .on(
        "postgres_changes",
        { event: "UPDATE", schema: "public", table: "inquiries" },
        payload => {
          if (payload.new) {
            const updated = mapInquiryRecord(payload.new);
            const idx = inquiries.findIndex(i => String(i._id) === String(updated._id) || String(i.id) === String(updated.id));
            if (idx !== -1) {
              inquiries[idx] = updated;
              renderInquiries();
              updateInquiryStats();
            }
          }
        }
      )
      .subscribe((status) => {
        console.log("[Admin Inquiries] Realtime subscription status:", status);
      });
  } catch (e) {
    console.warn("[Admin Inquiries] Realtime init error:", e);
  }
}

function escapeHtml(str) {
  if (!str) return "";
  return String(str)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}

const searchInput = document.getElementById("inquiry-search");
if (searchInput) {
  searchInput.addEventListener("input", function () {
    const q = this.value.toLowerCase().trim();
    if (!q) {
      renderInquiries(inquiries);
      return;
    }
    const filtered = inquiries.filter(i =>
      i.name.toLowerCase().includes(q) ||
      i.email.toLowerCase().includes(q) ||
      i.phone.includes(q) ||
      i.orderNumber.toLowerCase().includes(q) ||
      i.subject.toLowerCase().includes(q) ||
      i.id.toLowerCase().includes(q)
    );
    renderInquiries(filtered);
  });
}

document.addEventListener("DOMContentLoaded", loadAdminInquiries);
window.loadAdminInquiries = loadAdminInquiries;
window.toggleInquiryStatus = toggleInquiryStatus;
window.deleteInquiry = deleteInquiry;
