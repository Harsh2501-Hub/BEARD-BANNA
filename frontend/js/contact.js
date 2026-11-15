// ===============================
// CONTACT INQUIRIES HANDLER - SUPABASE INTEGRATED & SPAM HARDENED
// ===============================

const contactForm = document.getElementById("royal-contact-form");

if (contactForm) {
  // Set form load timestamp for human-speed bot detection
  const formTimeInput = document.getElementById("inquiry-form-time");
  if (formTimeInput) formTimeInput.value = Date.now().toString();

  contactForm.addEventListener("submit", async function (e) {
    e.preventDefault();

    // ── 1. HONEYPOT SPAM PROTECTION ──
    const honeypotVal = document.getElementById("inquiry-hp")?.value;
    if (honeypotVal) {
      console.warn("[Spam Protection] Bot trap triggered. Submission dropped.");
      window.location.href = "thank-you.html?ref=BOT-BLOCKED&type=inquiry";
      return;
    }

    // ── 2. BOT VELOCITY CHECK (< 2 seconds) ──
    const loadTime = Number(document.getElementById("inquiry-form-time")?.value || 0);
    if (loadTime > 0 && Date.now() - loadTime < 2000) {
      alert("Please take a moment before submitting your inquiry.");
      return;
    }

    // ── 3. CLIENT-SIDE RATE LIMITING (30s cooldown) ──
    const lastSubmitTime = Number(localStorage.getItem("bb_last_inquiry_ts") || 0);
    const cooldownMs = 30000;
    if (Date.now() - lastSubmitTime < cooldownMs) {
      const waitSec = Math.ceil((cooldownMs - (Date.now() - lastSubmitTime)) / 1000);
      alert(`⏳ Please wait ${waitSec} seconds before sending another inquiry to the Royal Court.`);
      return;
    }

    const submitBtn = contactForm.querySelector("button[type='submit']");
    const originalBtnText = submitBtn ? submitBtn.innerHTML : "✉ Send Royal Inquiry";

    const name = (document.getElementById("inquiry-name")?.value || "").trim();
    const email = (document.getElementById("inquiry-email")?.value || "").trim().toLowerCase();
    const phone = (document.getElementById("inquiry-phone")?.value || "").trim();
    const orderNumber = (document.getElementById("inquiry-order")?.value || "").trim();
    const subject = (document.getElementById("inquiry-subject")?.value || "").trim();
    const message = (document.getElementById("inquiry-message")?.value || "").trim();

    if (!name || !email || !phone || !subject || !message) {
      alert("Please fill in all required fields (*).");
      return;
    }

    if (name.length < 2 || name.length > 80) {
      alert("Please enter a valid name (2 to 80 characters).");
      return;
    }

    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) || email.length > 100) {
      alert("Please enter a valid email address.");
      return;
    }

    if (!/^[6-9]\d{9}$/.test(phone)) {
      alert("Please enter a valid 10-digit Indian mobile number (e.g. 9876543210).");
      return;
    }

    if (message.length < 10 || message.length > 2000) {
      alert("Please enter a detailed message between 10 and 2000 characters.");
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

      // Record successful submit timestamp for rate limiting
      localStorage.setItem("bb_last_inquiry_ts", Date.now().toString());

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

      // Track key event in Google Analytics 4
      if (typeof window.trackGAEvent === "function") {
        window.trackGAEvent("form_submit", {
          form_name: "royal_contact_inquiry",
          inquiry_id: inqNumber,
          subject: subject
        });
      }

      // Store in sessionStorage to verify on Thank-You page
      try {
        sessionStorage.setItem("bb_last_inquiry", JSON.stringify({
          ref: inqNumber,
          name: name,
          email: email
        }));
      } catch (e) {}

      contactForm.reset();

      // Redirect to dedicated /thank-you confirmation page
      window.location.href = `thank-you.html?ref=${encodeURIComponent(inqNumber)}&type=inquiry`;

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
