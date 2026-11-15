// =========================================================
// BEARD BANNA — GOOGLE ANALYTICS 4 & PRIVACY CONSENT ENGINE
// Compliant with DPDP Act 2023 & International Privacy Standards
// =========================================================

(function () {
  'use strict';

  // Configurable Google Analytics 4 Measurement ID
  // To activate live analytics, set window.GA_MEASUREMENT_ID before this script loads
  // or configure VITE_GA_MEASUREMENT_ID during build.
  const GA_ID = window.GA_MEASUREMENT_ID ||
    (typeof process !== 'undefined' && process.env && process.env.VITE_GA_MEASUREMENT_ID) ||
    'G-XXXXXXXXXX';

  const CONSENT_KEY = 'bb_cookie_consent'; // 'all' | 'essential'
  const CONSENT_TIMESTAMP_KEY = 'bb_cookie_consent_ts';

  // Expose configuration globally
  window.BEARD_BANNA_GA_ID = GA_ID;

  // Initialize dataLayer safely
  window.dataLayer = window.dataLayer || [];
  function gtag() {
    window.dataLayer.push(arguments);
  }
  window.gtag = gtag;

  /**
   * Check user consent status
   * Returns: 'all' | 'essential' | null (undecided)
   */
  function getConsentStatus() {
    try {
      return localStorage.getItem(CONSENT_KEY);
    } catch (e) {
      return null;
    }
  }

  /**
   * Dynamically loads GA4 tag if consent is given
   */
  function loadGoogleAnalytics() {
    // Only load if valid measurement ID and not already injected
    if (!GA_ID || GA_ID === 'G-XXXXXXXXXX') {
      console.info(
        '%c[Beard Banna Analytics]%c GA4 Measurement ID is currently set to placeholder ("' + GA_ID +
        '"). To capture live visitor metrics, set window.GA_MEASUREMENT_ID = "G-YOURREALID".',
        'color: #fbbf24; font-weight: bold;',
        'color: inherit;'
      );
    }

    if (document.getElementById('bb-ga4-script')) return;

    gtag('js', new Date());
    gtag('config', GA_ID, {
      anonymize_ip: true,
      send_page_view: true,
      cookie_flags: 'SameSite=None;Secure'
    });

    if (GA_ID && GA_ID !== 'G-XXXXXXXXXX') {
      const script = document.createElement('script');
      script.id = 'bb-ga4-script';
      script.async = true;
      script.src = `https://www.googletagmanager.com/gtag/js?id=${encodeURIComponent(GA_ID)}`;
      document.head.appendChild(script);
    }
  }

  /**
   * Sanitize event payload to ensure NO sensitive customer data is ever sent
   */
  function sanitizeEventParams(params) {
    if (!params || typeof params !== 'object') return {};
    const sanitized = { ...params };

    // Explicitly forbidden PII / sensitive fields
    const sensitiveKeys = [
      'password', 'pass', 'pwd', 'token', 'secret',
      'full_address', 'street_address', 'address', 'shipping_address',
      'card_number', 'cvv', 'upi_pin', 'bank_account', 'aadhaar', 'pan'
    ];

    for (const key of Object.keys(sanitized)) {
      const lower = key.toLowerCase();
      if (sensitiveKeys.some(s => lower.includes(s))) {
        delete sanitized[key];
      }
    }
    return sanitized;
  }

  /**
   * Global Safe Event Tracker: window.trackGAEvent
   */
  window.trackGAEvent = function (eventName, eventParams) {
    if (!eventName) return;

    const consent = getConsentStatus();
    // In strict mode, only fire when consent is granted
    if (consent === 'essential') {
      // User opted for essential cookies only — suppress analytics tracking
      return;
    }

    const cleanParams = sanitizeEventParams(eventParams);

    // Guard against duplicate purchase tracking
    if (eventName === 'purchase' && cleanParams.transaction_id) {
      try {
        const trackedPurchases = JSON.parse(sessionStorage.getItem('bb_tracked_purchases') || '[]');
        if (trackedPurchases.includes(cleanParams.transaction_id)) {
          console.warn('[Beard Banna Analytics] Suppressed duplicate purchase event for order:', cleanParams.transaction_id);
          return;
        }
        trackedPurchases.push(cleanParams.transaction_id);
        sessionStorage.setItem('bb_tracked_purchases', JSON.stringify(trackedPurchases));
      } catch (e) {}
    }

    gtag('event', eventName, cleanParams);
  };

  /**
   * Render Royal Cookie Consent Banner
   */
  function renderConsentBanner() {
    if (document.getElementById('bb-cookie-banner')) return;

    const banner = document.createElement('div');
    banner.id = 'bb-cookie-banner';
    banner.className = 'bb-cookie-banner';
    banner.setAttribute('role', 'region');
    banner.setAttribute('aria-label', 'Cookie and Privacy Consent');

    banner.innerHTML = `
      <div class="bb-cookie-container">
        <div class="bb-cookie-content">
          <div class="bb-cookie-header">
            <span class="bb-cookie-crest">⚜</span>
            <strong>Royal Privacy & Heritage Experience</strong>
          </div>
          <p class="bb-cookie-text">
            The House of <b>BEARD BANNA</b> respects your digital sovereignty. We use essential cookies to secure your shopping bag and orders, alongside optional performance analytics to elevate our regal collection. In compliance with India's DPDP Act and global standards, you govern your data.
            <a href="privacy.html" class="bb-cookie-link" target="_blank" rel="noopener">Read Privacy Scriptures →</a>
          </p>
        </div>
        <div class="bb-cookie-actions">
          <button type="button" id="bb-cookie-essential-btn" class="bb-cookie-btn bb-cookie-btn-secondary">
            Essential Only
          </button>
          <button type="button" id="bb-cookie-accept-btn" class="bb-cookie-btn bb-cookie-btn-primary">
            Accept All ⚜
          </button>
        </div>
      </div>
    `;

    // Inject styles
    if (!document.getElementById('bb-cookie-style')) {
      const style = document.createElement('style');
      style.id = 'bb-cookie-style';
      style.textContent = `
        .bb-cookie-banner {
          position: fixed;
          bottom: 20px;
          left: 50%;
          transform: translateX(-50%);
          width: calc(100% - 32px);
          max-width: 960px;
          background: rgba(10, 14, 26, 0.96);
          border: 1px solid rgba(212, 175, 55, 0.35);
          border-radius: 12px;
          box-shadow: 0 12px 40px rgba(0, 0, 0, 0.7), 0 0 20px rgba(212, 175, 55, 0.15);
          backdrop-filter: blur(12px);
          -webkit-backdrop-filter: blur(12px);
          z-index: 99999;
          padding: 16px 22px;
          font-family: 'Plus Jakarta Sans', system-ui, -apple-system, sans-serif;
          animation: bbSlideUp 0.4s ease-out;
        }
        @keyframes bbSlideUp {
          from { opacity: 0; transform: translate(-50%, 20px); }
          to { opacity: 1; transform: translate(-50%, 0); }
        }
        .bb-cookie-container {
          display: flex;
          align-items: center;
          justify-content: space-between;
          gap: 20px;
          flex-wrap: wrap;
        }
        .bb-cookie-content {
          flex: 1 1 500px;
        }
        .bb-cookie-header {
          display: flex;
          align-items: center;
          gap: 8px;
          color: #fbbf24;
          font-family: 'Cinzel', serif;
          font-size: 0.98rem;
          font-weight: 700;
          letter-spacing: 0.5px;
          margin-bottom: 6px;
        }
        .bb-cookie-crest {
          font-size: 1.1rem;
          color: #d4af37;
        }
        .bb-cookie-text {
          font-size: 0.85rem;
          color: #cbd5e1;
          line-height: 1.5;
          margin: 0;
        }
        .bb-cookie-link {
          color: #fbbf24;
          text-decoration: underline;
          margin-left: 4px;
          font-weight: 500;
        }
        .bb-cookie-link:hover {
          color: #f5eedf;
        }
        .bb-cookie-actions {
          display: flex;
          align-items: center;
          gap: 10px;
          flex-wrap: wrap;
        }
        .bb-cookie-btn {
          cursor: pointer;
          font-family: 'Plus Jakarta Sans', sans-serif;
          font-size: 0.85rem;
          font-weight: 600;
          padding: 9px 18px;
          border-radius: 6px;
          transition: all 0.25s ease;
          border: 1px solid transparent;
        }
        .bb-cookie-btn-primary {
          background: linear-gradient(135deg, #d4af37, #b89628);
          color: #0a0e1a;
          box-shadow: 0 2px 10px rgba(212, 175, 55, 0.3);
        }
        .bb-cookie-btn-primary:hover {
          background: linear-gradient(135deg, #fbbf24, #d4af37);
          transform: translateY(-1px);
        }
        .bb-cookie-btn-secondary {
          background: rgba(30, 41, 59, 0.8);
          color: #cbd5e1;
          border-color: rgba(212, 175, 55, 0.25);
        }
        .bb-cookie-btn-secondary:hover {
          background: rgba(51, 65, 85, 0.9);
          color: #fff;
          border-color: rgba(212, 175, 55, 0.45);
        }
        @media (max-width: 640px) {
          .bb-cookie-banner {
            bottom: 12px;
            padding: 14px 16px;
          }
          .bb-cookie-actions {
            width: 100%;
            justify-content: flex-end;
          }
          .bb-cookie-btn {
            flex: 1;
            text-align: center;
          }
        }
      `;
      document.head.appendChild(style);
    }

    document.body.appendChild(banner);

    // Event listeners
    document.getElementById('bb-cookie-accept-btn')?.addEventListener('click', function () {
      localStorage.setItem(CONSENT_KEY, 'all');
      localStorage.setItem(CONSENT_TIMESTAMP_KEY, Date.now().toString());
      banner.remove();
      loadGoogleAnalytics();
      window.trackGAEvent('cookie_consent', { status: 'accepted_all' });
    });

    document.getElementById('bb-cookie-essential-btn')?.addEventListener('click', function () {
      localStorage.setItem(CONSENT_KEY, 'essential');
      localStorage.setItem(CONSENT_TIMESTAMP_KEY, Date.now().toString());
      banner.remove();
      // Remove any previously loaded analytics script if active
      const script = document.getElementById('bb-ga4-script');
      if (script) script.remove();
    });
  }

  /**
   * Helper allowing user to re-open cookie preferences from footer link
   */
  window.openCookiePreferences = function () {
    renderConsentBanner();
  };

  // Initialization lifecycle
  document.addEventListener('DOMContentLoaded', function () {
    const consent = getConsentStatus();
    if (consent === 'all') {
      loadGoogleAnalytics();
    } else if (consent === 'essential') {
      // User requested essential only; do not load GA4
    } else {
      // First visit: render consent banner
      setTimeout(renderConsentBanner, 800);
    }
  });

})();
