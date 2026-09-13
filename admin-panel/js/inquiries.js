// ===============================
// ADMIN INQUIRIES MANAGEMENT
// ===============================

let inquiries = JSON.parse(localStorage.getItem("inquiries")) || [
  {
    id: "INQ-981241",
    name: "Vikram Singh",
    email: "vikram@email.com",
    phone: "9876543210",
    orderNumber: "ORD-1001",
    subject: "Order Tracking Query",
    message: "When will my Royal Warrior Tee be delivered to Vadodara?",
    status: "New",
    date: new Date().toLocaleDateString("en-IN")
  }
];

function loadAdminInquiries() {
  const localInquiries = JSON.parse(localStorage.getItem("inquiries")) || [];
  if (localInquiries.length > 0) {
    inquiries = localInquiries;
  }
  renderInquiries();
  updateInquiryStats();
}

function renderInquiries(list = inquiries) {
  const tbody = document.getElementById("inquiries-table-body");
  if (!tbody) return;
  tbody.innerHTML = "";

  if (list.length === 0) {
    tbody.innerHTML = `<tr><td colspan="8" style="text-align:center; padding: 20px;">📩 No customer inquiries found.</td></tr>`;
    return;
  }

  list.forEach(inq => {
    tbody.innerHTML += `
      <tr>
        <td><strong>${inq.id}</strong></td>
        <td>${inq.name}</td>
        <td>
          <div>📧 ${inq.email}</div>
          <div>📞 <strong>${inq.phone}</strong></div>
        </td>
        <td><span class="badge pending">${inq.orderNumber || 'N/A'}</span></td>
        <td>
          <div><strong>${inq.subject}</strong></div>
          <small style="color:#94a3b8; display:block; max-width:280px;">${inq.message}</small>
        </td>
        <td>${inq.date}</td>
        <td>
          <span class="status ${inq.status === 'Resolved' ? 'active' : 'pending'}">${inq.status || 'New'}</span>
        </td>
        <td>
          <button class="view-btn" style="padding:4px 8px; font-size:0.8rem;" onclick="toggleInquiryStatus('${inq.id}')">
            ${inq.status === 'Resolved' ? '↺ Mark New' : '✅ Resolve'}
          </button>
          <button class="delete-btn" style="padding:4px 8px; font-size:0.8rem; margin-top:4px;" onclick="deleteInquiry('${inq.id}')">🗑</button>
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

function toggleInquiryStatus(id) {
  const inq = inquiries.find(i => String(i.id) === String(id));
  if (!inq) return;

  inq.status = inq.status === "Resolved" ? "New" : "Resolved";
  localStorage.setItem("inquiries", JSON.stringify(inquiries));
  renderInquiries();
  updateInquiryStats();
}

function deleteInquiry(id) {
  if (!confirm("Are you sure you want to delete this inquiry?")) return;
  inquiries = inquiries.filter(i => String(i.id) !== String(id));
  localStorage.setItem("inquiries", JSON.stringify(inquiries));
  renderInquiries();
  updateInquiryStats();
}

const searchInput = document.getElementById("inquiry-search");
if (searchInput) {
  searchInput.addEventListener("input", function () {
    const q = this.value.toLowerCase().trim();
    const filtered = inquiries.filter(i =>
      i.name.toLowerCase().includes(q) ||
      i.email.toLowerCase().includes(q) ||
      i.phone.includes(q) ||
      i.orderNumber.toLowerCase().includes(q) ||
      i.subject.toLowerCase().includes(q)
    );
    renderInquiries(filtered);
  });
}

document.addEventListener("DOMContentLoaded", loadAdminInquiries);
