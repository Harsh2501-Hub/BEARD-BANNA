// ===============================
// CONTACT INQUIRIES HANDLER
// ===============================

const contactForm = document.getElementById("royal-contact-form");

if (contactForm) {
  contactForm.addEventListener("submit", async function (e) {
    e.preventDefault();

    const name = document.getElementById("inquiry-name")?.value.trim();
    const email = document.getElementById("inquiry-email")?.value.trim();
    const phone = document.getElementById("inquiry-phone")?.value.trim();
    const orderNumber = document.getElementById("inquiry-order")?.value.trim();
    const subject = document.getElementById("inquiry-subject")?.value.trim();
    const message = document.getElementById("inquiry-message")?.value.trim();

    if (!name || !email || !phone || !subject || !message) {
      alert("Please fill in all required fields (*).");
      return;
    }

    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      alert("Please enter a valid email address.");
      return;
    }

    if (!/^[6-9]\d{9}$/.test(phone)) {
      alert("Please enter a valid 10-digit mobile phone number.");
      return;
    }

    const inquiryObj = {
      id: "INQ-" + Date.now().toString().slice(-6),
      name,
      email,
      phone,
      orderNumber: orderNumber || "N/A",
      subject,
      message,
      status: "New",
      date: new Date().toLocaleDateString("en-IN") + " " + new Date().toLocaleTimeString("en-IN", { hour: '2-digit', minute: '2-digit' })
    };

    // Save to local storage for Admin Dashboard access
    const existingInquiries = JSON.parse(localStorage.getItem("inquiries")) || [];
    existingInquiries.unshift(inquiryObj);
    localStorage.setItem("inquiries", JSON.stringify(existingInquiries));

    // Post to backend if endpoint available
    try {
      await API.post('/contact', inquiryObj);
    } catch (err) {
      console.warn("Inquiry saved locally for Admin Dashboard");
    }

    if (typeof showToast === "function") {
      showToast("👑 Thank you! Your inquiry has been sent to Beard Banna.");
    } else {
      alert("👑 Thank you! Your inquiry has been sent to Beard Banna.");
    }

    contactForm.reset();
  });
}
