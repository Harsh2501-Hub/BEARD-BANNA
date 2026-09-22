// ===============================
// CONTACT INQUIRIES HANDLER - SUPABASE INTEGRATED
// ===============================

const contactForm = document.getElementById("royal-contact-form");

if (contactForm) {
  contactForm.addEventListener("submit", async function (e) {
    e.preventDefault();

    const submitBtn = contactForm.querySelector("button[type='submit']");
    const originalBtnText = submitBtn ? submitBtn.innerHTML : "✉ Send Royal Inquiry";

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
      alert("Please enter a valid 10-digit Indian mobile number.");
      return;
    }

    const inqNumber = "INQ-" + Date.now().toString().slice(-6);

    const inquiryPayload = {
      inquiry_number: inqNumber,
      name: name,
      email: email,
      phone: phone,
      order_number: orderNumber || "N/A",
      subject: subject,
      message: message,
      status: "New"
    };

    if (submitBtn) {
      submitBtn.disabled = true;
      submitBtn.innerHTML = "⏳ Sending to Royal Court...";
    }

    try {
      let savedToDb = false;

      // ── PRIMARY: Save to Supabase inquiries table ──
      if (window.supabaseClient) {
        const { data, error } = await window.supabaseClient
          .from("inquiries")
          .insert([inquiryPayload])
          .select()
          .single();

        if (error) {
          console.error("[Inquiry] Supabase insert error:", error);
          throw new Error(error.message || "Failed to save inquiry to database");
        }

        savedToDb = true;
        console.log("[Inquiry] ✅ Inquiry saved to Supabase:", inqNumber);
      } else {
        // Fallback to backend API if Supabase client not loaded
        try {
          await API.post("/contact", inquiryPayload);
          savedToDb = true;
        } catch (apiErr) {
          console.error("[Inquiry] API fallback failed:", apiErr);
          throw new Error("Database service unavailable");
        }
      }

      if (!savedToDb) {
        throw new Error("Unable to reach database");
      }

      // Also cache in localStorage for fast local access
      try {
        const localObj = {
          id: inqNumber,
          ...inquiryPayload,
          date: new Date().toLocaleDateString("en-IN")
        };
        const existingInquiries = JSON.parse(localStorage.getItem("inquiries")) || [];
        existingInquiries.unshift(localObj);
        localStorage.setItem("inquiries", JSON.stringify(existingInquiries));
      } catch (e) {}

      // Success UX
      const msg = `👑 Inquiry Sent Successfully!\n\nReference ID: ${inqNumber}\nOur Royal Support Team will contact you at ${email} shortly.`;
      if (typeof showToast === "function") {
        showToast(`✅ Inquiry Sent! Reference: ${inqNumber}`);
      }
      alert(msg);
      contactForm.reset();

    } catch (err) {
      console.error("[Inquiry] Submission failed:", err);
      alert(
        `❌ Inquiry Failed to Send\n\nError: ${err.message || "Network error"}\n` +
        `Please check your internet connection or email us directly at beardbanna07773@gmail.com`
      );
    } finally {
      if (submitBtn) {
        submitBtn.disabled = false;
        submitBtn.innerHTML = originalBtnText;
      }
    }
  });
}
